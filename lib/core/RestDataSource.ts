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

/**
 * An HTTP verb.
 *
 * The common ones are listed so they autocomplete, but any string is accepted:
 * a closed union cannot describe every API, and being unable to send the verb
 * a server expects is not a constraint worth enforcing.
 */
export type HttpMethod =
  | 'GET'
  | 'POST'
  | 'PUT'
  | 'PATCH'
  | 'DELETE'
  | (string & Record<never, never>);

/** HTTP verbs used per mutating operation. */
export interface RestMethods {
  /** Verb for creating a record. Defaults to `POST`. */
  create: HttpMethod;
  /** Verb for updating a record. Defaults to `PUT`. */
  update: HttpMethod;
  /** Verb for deleting a record. Defaults to `DELETE`. */
  remove: HttpMethod;
}

/** Which operation a request belongs to. */
export type RestOperation = 'list' | 'create' | 'update' | 'remove';

/** Query-string values a caller can attach to a request. */
export type RestQueryValue = string | number | boolean;

/**
 * What a request is for, handed to every call-time hook.
 *
 * Carrying the operation and its subject is what lets one hook serve all four
 * - an `Idempotency-Key` on create, an `If-Match` built from the id on update,
 * a fresh token on everything.
 */
export interface RestRequestContext<T, K extends keyof T> {
  operation: RestOperation;
  /** Present for `update` and `remove`. */
  id?: T[K];
  /** Present for `create` and `update`. */
  draft?: CrudDraft<T>;
  /** Present for `list`. */
  query?: CrudQuery<T>;
}

/**
 * Per-request adjustments, resolved at call time.
 *
 * Returned from {@link RestDataSourceOptions.configureRequest}, which may be
 * async - so a token can be awaited from a refresh call rather than captured
 * when the source was constructed.
 */
export interface RestRequestOverrides {
  /** Merged over the static headers. */
  headers?: Record<string, string>;
  /** Replaces the verb this operation would otherwise use. */
  method?: HttpMethod;
  /** Merged over the static query parameters. */
  query?: Record<string, RestQueryValue>;
  /** Passed through to `fetch` - `credentials`, `mode`, `cache`, `signal`, ... */
  init?: Omit<RequestInit, 'method' | 'body' | 'headers'>;
}

/** Everything needed to point a {@link RestDataSource} at an API. */
export interface RestDataSourceOptions<T, K extends keyof T = keyof T> {
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
  /** Appended to every request's query string, merged with generated parameters. */
  query?: Readonly<Record<string, RestQueryValue>>;
  /**
   * Passed through to `fetch` on every request.
   *
   * This is where `credentials: 'include'` for cookie auth lives, along with
   * `mode`, `cache`, `redirect` and a long-lived `signal`.
   */
  init?: Omit<RequestInit, 'method' | 'body' | 'headers'>;
  /**
   * Adjusts a request as it is made.
   *
   * Runs per call and may be async, so it covers what static options cannot:
   * a rotating or awaited token, a header only one operation sends, a verb
   * chosen from the payload. Its result is merged over the static options.
   */
  configureRequest?: (
    context: RestRequestContext<T, K>,
  ) => RestRequestOverrides | Promise<RestRequestOverrides>;
  /** Maps a draft onto the request body. Defaults to sending the draft as-is. */
  serializeRequest?: (draft: CrudDraft<T>, context: RestRequestContext<T, K>) => unknown;
  /** Maps a list response onto a page. Required when the API wraps its payload. */
  parseResponse?: (payload: unknown) => CrudPage<T>;
  /**
   * Maps a create or update response onto the stored record.
   *
   * The inbound counterpart to `serializeRequest`. Without it a write response
   * is taken as the record itself, so an API that answers `{ data: { ... } }`
   * hands back the envelope.
   */
  parseRecord?: (payload: unknown, context: RestRequestContext<T, K>) => T;
  /** Injected for testing; defaults to the global `fetch`. */
  fetchImpl?: typeof fetch;
}

/**
 * Append a query string to a path that may already carry one.
 *
 * Appending `?` unconditionally produced URLs with two question marks when an
 * endpoint already had a parameter of its own, which servers read as part of
 * the preceding value rather than as a separator.
 */
const appendQuery = (path: string, params: URLSearchParams): string => {
  const encoded = params.toString();
  if (encoded === '') return path;
  return `${path}${path.includes('?') ? '&' : '?'}${encoded}`;
};

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
  /** Appended to every request's query string. */
  protected readonly query: Readonly<Record<string, RestQueryValue>>;
  /** Passed through to `fetch` on every request. */
  protected readonly init: Omit<RequestInit, 'method' | 'body' | 'headers'>;
  /** Resolves per-request adjustments at call time. */
  protected readonly configureRequest?: (
    context: RestRequestContext<T, K>,
  ) => RestRequestOverrides | Promise<RestRequestOverrides>;
  /** Maps a draft onto the request body. */
  protected readonly serializeRequest: (
    draft: CrudDraft<T>,
    context: RestRequestContext<T, K>,
  ) => unknown;
  /** Maps a list payload onto a page, when the API wraps its results. */
  protected readonly parseResponse?: (payload: unknown) => CrudPage<T>;
  /** Maps a create or update response onto the stored record. */
  protected readonly parseRecord?: (payload: unknown, context: RestRequestContext<T, K>) => T;
  private readonly fetchImpl: typeof fetch;

  constructor(options: RestDataSourceOptions<T, K> = {}) {
    this.baseUrl = options.baseUrl ?? '';
    this.endpoints = { ...DEFAULT_ENDPOINTS, ...options.endpoints };
    this.paramNames = { ...DEFAULT_PARAM_NAMES, ...options.paramNames };
    this.methods = { ...DEFAULT_METHODS, ...options.methods };
    this.headers = options.headers ?? {};
    this.query = options.query ?? {};
    this.init = options.init ?? {};
    this.configureRequest = options.configureRequest;
    this.serializeRequest = options.serializeRequest ?? ((draft) => draft);
    this.parseResponse = options.parseResponse;
    this.parseRecord = options.parseRecord;
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

  /**
   * Encode filters as query parameters.
   *
   * Each filter is sent under its own field name, which suits an API that
   * filters per column. An API with a single search parameter - `?q=` is the
   * common shape - wants them combined instead, so this is a seam rather than
   * inline, matching {@link serializeSort}.
   */
  protected serializeFilters(filters: CrudQuery<T>['filters'], params: URLSearchParams): void {
    for (const [field, value] of Object.entries(filters ?? {})) {
      if (value !== undefined && value !== null && value !== '') {
        params.set(field, String(value));
      }
    }
  }

  /** Build the list URL, including pagination, sort and filters. */
  protected buildListUrl(query: CrudQuery<T>): string {
    const params = new URLSearchParams();
    params.set(this.paramNames.page, String(query.page));
    params.set(this.paramNames.pageSize, String(query.pageSize));
    this.serializeSort(query.sort, params);
    this.serializeFilters(query.filters, params);

    return appendQuery(this.endpoints.list, params);
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
  protected async request(
    path: string,
    context: RestRequestContext<T, K>,
    init: RequestInit = {},
  ): Promise<unknown> {
    // Resolved per call rather than at construction, so an awaited or rotating
    // token is as expressible as a fixed one.
    const overrides = (await this.configureRequest?.(context)) ?? {};

    const params = new URLSearchParams();
    for (const [key, value] of Object.entries({ ...this.query, ...overrides.query })) {
      params.set(key, String(value));
    }

    const url = appendQuery(`${this.baseUrl}${path}`, params);

    const response = await this.fetchImpl(url, {
      ...this.init,
      ...overrides.init,
      ...init,
      method: overrides.method ?? init.method,
      headers: {
        'Content-Type': 'application/json',
        ...this.headers,
        ...overrides.headers,
        ...init.headers,
      },
    });

    if (!response.ok) {
      throw new RestError(response.status, await response.text().catch(() => ''), url);
    }

    if (response.status === 204) return undefined;

    const text = await response.text();
    return text === '' ? undefined : (JSON.parse(text) as unknown);
  }

  /** Interpret a create or update response. */
  protected toRecord(payload: unknown, context: RestRequestContext<T, K>): T {
    return this.parseRecord ? this.parseRecord(payload, context) : (payload as T);
  }

  async list(query: CrudQuery<T>): Promise<CrudPage<T>> {
    const context: RestRequestContext<T, K> = { operation: 'list', query };
    return this.toPage(await this.request(this.buildListUrl(query), context));
  }

  async create(draft: CrudDraft<T>): Promise<T> {
    const context: RestRequestContext<T, K> = { operation: 'create', draft };
    const payload = await this.request(this.endpoints.create, context, {
      method: this.methods.create,
      body: JSON.stringify(this.serializeRequest(draft, context)),
    });
    return this.toRecord(payload, context);
  }

  async update(id: T[K], draft: CrudDraft<T>): Promise<T> {
    const context: RestRequestContext<T, K> = { operation: 'update', id, draft };
    const payload = await this.request(this.buildRecordPath(this.endpoints.update, id), context, {
      method: this.methods.update,
      body: JSON.stringify(this.serializeRequest(draft, context)),
    });
    return this.toRecord(payload, context);
  }

  async remove(id: T[K]): Promise<void> {
    const context: RestRequestContext<T, K> = { operation: 'remove', id };
    await this.request(this.buildRecordPath(this.endpoints.remove, id), context, {
      method: this.methods.remove,
    });
  }
}
