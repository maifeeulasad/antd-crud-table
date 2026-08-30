import type { CrudDataSource, CrudDraft, CrudPage, CrudQuery, CrudSort } from './types';

/** Paths appended to `baseUrl` for each operation. */
export interface RestEndpoints {
  /** Path listing records. */
  list: string;
  /** Path accepting a new record. */
  create: string;
  /** Path for updating one record; the id is appended by `buildRecordPath`. */
  update: string;
  /** Path for deleting one record; the id is appended by `buildRecordPath`. */
  remove: string;
}

/** Query-string parameter names, for APIs that do not speak ProTable's vocabulary. */
export interface RestParamNames {
  /** Parameter carrying the 1-based page number. Defaults to `current`. */
  page: string;
  /** Parameter carrying the page size. Defaults to `pageSize`. */
  pageSize: string;
  /** Parameter carrying the field to sort by. Defaults to `sortBy`. */
  sortBy: string;
  /** Parameter carrying the sort direction. Defaults to `sortOrder`. */
  sortOrder: string;
}

/** HTTP verbs used per mutating operation. */
export interface RestMethods {
  /** Verb for creating a record. Defaults to `POST`. */
  create: 'POST' | 'PUT';
  /** Verb for updating a record. Defaults to `PUT`. */
  update: 'PUT' | 'PATCH' | 'POST';
  /** Verb for deleting a record. Defaults to `DELETE`. */
  remove: 'DELETE' | 'POST';
}

/** Everything needed to point a {@link RestDataSource} at an API. */
export interface RestDataSourceOptions<T> {
  /** Prefixed to every request path, exactly once. */
  baseUrl?: string;
  /** Overrides for the per-operation paths. */
  endpoints?: Partial<RestEndpoints>;
  /** Overrides for query-parameter names, for APIs with another vocabulary. */
  paramNames?: Partial<RestParamNames>;
  /** Overrides for the HTTP verb used by each mutating operation. */
  methods?: Partial<RestMethods>;
  /** Sent with every request, merged over the default content type. */
  headers?: Readonly<Record<string, string>>;
  /** Maps a draft onto the request body. Defaults to sending the draft as-is. */
  serializeRequest?: (draft: CrudDraft<T>) => unknown;
  /** Maps a list response onto a page. Required when the API wraps its payload. */
  parseResponse?: (payload: unknown) => CrudPage<T>;
  /** Injected for testing; defaults to the global `fetch`. */
  fetchImpl?: typeof fetch;
}

const DEFAULT_ENDPOINTS: RestEndpoints = {
  list: '/list',
  create: '/create',
  update: '/update',
  remove: '/delete',
};

const DEFAULT_PARAM_NAMES: RestParamNames = {
  page: 'current',
  pageSize: 'pageSize',
  sortBy: 'sortBy',
  sortOrder: 'sortOrder',
};

const DEFAULT_METHODS: RestMethods = {
  create: 'POST',
  update: 'PUT',
  remove: 'DELETE',
};

/**
 * Raised when the server answers with a non-2xx status.
 *
 * Carries the status and the raw body so consumers can branch on a 409 or
 * surface a validation payload, rather than receiving a flattened string.
 */
export class RestError extends Error {
  /** The HTTP status the server responded with. */
  readonly status: number;
  /** The raw response body, for reading a validation payload. */
  readonly body: string;

  constructor(status: number, body: string, url: string) {
    super(`Request to ${url} failed with status ${status}`);
    this.name = 'RestError';
    this.status = status;
    this.body = body;
  }
}

/**
 * A source over a REST API.
 *
 * URL and payload construction live in `protected` methods rather than inline,
 * so an API that does not match the default dialect is a small subclass
 * instead of a full reimplementation of the strategy.
 */
export class RestDataSource<T extends object, K extends keyof T> implements CrudDataSource<T, K> {
  /** Prefixed to every request path, exactly once. */
  protected readonly baseUrl: string;
  /** Resolved per-operation paths. */
  protected readonly endpoints: RestEndpoints;
  /** Resolved query-parameter names. */
  protected readonly paramNames: RestParamNames;
  /** Resolved HTTP verbs. */
  protected readonly methods: RestMethods;
  /** Headers sent with every request. */
  protected readonly headers: Readonly<Record<string, string>>;
  /** Maps a draft onto the request body. */
  protected readonly serializeRequest: (draft: CrudDraft<T>) => unknown;
  /** Maps a list payload onto a page, when the API wraps its results. */
  protected readonly parseResponse?: (payload: unknown) => CrudPage<T>;
  private readonly fetchImpl: typeof fetch;

  constructor(options: RestDataSourceOptions<T> = {}) {
    this.baseUrl = options.baseUrl ?? '';
    this.endpoints = { ...DEFAULT_ENDPOINTS, ...options.endpoints };
    this.paramNames = { ...DEFAULT_PARAM_NAMES, ...options.paramNames };
    this.methods = { ...DEFAULT_METHODS, ...options.methods };
    this.headers = options.headers ?? {};
    this.serializeRequest = options.serializeRequest ?? ((draft) => draft);
    this.parseResponse = options.parseResponse;
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis);
  }

  /**
   * Encode sort instructions as query parameters.
   *
   * Only the first instruction is sent: `sortBy`/`sortOrder` is a single-sort
   * shape, and inventing a multi-sort encoding would guess at a convention the
   * server may not share. Override to support one.
   */
  protected serializeSort(sort: readonly CrudSort<T>[] | undefined, params: URLSearchParams): void {
    const primary = sort?.[0];
    if (!primary) return;
    params.set(this.paramNames.sortBy, String(primary.field));
    params.set(this.paramNames.sortOrder, primary.direction);
  }

  /** Build the list URL, including pagination, sort and filters. */
  protected buildListUrl(query: CrudQuery<T>): string {
    const params = new URLSearchParams();
    params.set(this.paramNames.page, String(query.page));
    params.set(this.paramNames.pageSize, String(query.pageSize));
    this.serializeSort(query.sort, params);

    for (const [field, value] of Object.entries(query.filters ?? {})) {
      if (value !== undefined && value !== null && value !== '') {
        params.set(field, String(value));
      }
    }

    return `${this.endpoints.list}?${params.toString()}`;
  }

  /** Path addressing a single record. Override for `?id=` style APIs. */
  protected buildRecordPath(endpoint: string, id: T[K]): string {
    return `${endpoint}/${encodeURIComponent(String(id))}`;
  }

  /**
   * Interpret a list payload.
   *
   * Without a `parseResponse`, accepts either a bare array or the
   * `{ data, total }` shape the previous implementation assumed.
   */
  protected toPage(payload: unknown): CrudPage<T> {
    if (this.parseResponse) return this.parseResponse(payload);

    if (Array.isArray(payload)) {
      return { items: payload as T[], total: payload.length };
    }

    if (payload !== null && typeof payload === 'object') {
      const record = payload as { data?: unknown; total?: unknown };
      if (Array.isArray(record.data)) {
        const items = record.data as T[];
        return { items, total: typeof record.total === 'number' ? record.total : items.length };
      }
    }

    throw new Error(
      'Unrecognised list response. Provide `parseResponse` to map it to { items, total }.',
    );
  }

  /**
   * Single point where `baseUrl`, headers and error handling are applied.
   *
   * Every request goes through here so `baseUrl` is prefixed exactly once -
   * building a full URL earlier and prefixing again is how it ended up
   * duplicated for relative bases.
   */
  protected async request(path: string, init: RequestInit = {}): Promise<unknown> {
    const url = `${this.baseUrl}${path}`;
    const response = await this.fetchImpl(url, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...this.headers, ...init.headers },
    });

    if (!response.ok) {
      throw new RestError(response.status, await response.text().catch(() => ''), url);
    }

    if (response.status === 204) return undefined;

    const text = await response.text();
    return text === '' ? undefined : (JSON.parse(text) as unknown);
  }

  async list(query: CrudQuery<T>): Promise<CrudPage<T>> {
    return this.toPage(await this.request(this.buildListUrl(query)));
  }

  async create(draft: CrudDraft<T>): Promise<T> {
    return (await this.request(this.endpoints.create, {
      method: this.methods.create,
      body: JSON.stringify(this.serializeRequest(draft)),
    })) as T;
  }

  async update(id: T[K], draft: CrudDraft<T>): Promise<T> {
    return (await this.request(this.buildRecordPath(this.endpoints.update, id), {
      method: this.methods.update,
      body: JSON.stringify(this.serializeRequest(draft)),
    })) as T;
  }

  async remove(id: T[K]): Promise<void> {
    await this.request(this.buildRecordPath(this.endpoints.remove, id), {
      method: this.methods.remove,
    });
  }
}
