import { describe, it, expect, vi } from 'vitest';

import { RestDataSource, RestError } from './RestDataSource';
import type { CrudPage } from './types';

interface User { id: number; name: string }

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

/** Records calls and replies with a scripted queue of responses. */
const stubFetch = (...responses: Response[]) => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const queue = [...responses];
  const impl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), init });
    return queue.shift() ?? json({});
  }) as unknown as typeof fetch;
  return { impl, calls };
};

describe('RestDataSource', () => {
  it('builds a list url with pagination, sort and filters', async () => {
    const { impl, calls } = stubFetch(json({ data: [], total: 0 }));
    const source = new RestDataSource<User, 'id'>({ baseUrl: '/api', fetchImpl: impl });

    await source.list({
      page: 2,
      pageSize: 25,
      sort: [{ field: 'name', direction: 'descend' }],
      filters: { name: 'ali' },
    });

    const url = new URL(calls[0].url, 'http://x');
    expect(url.pathname).toBe('/api/list');
    expect(url.searchParams.get('current')).toBe('2');
    expect(url.searchParams.get('pageSize')).toBe('25');
    expect(url.searchParams.get('sortBy')).toBe('name');
    expect(url.searchParams.get('sortOrder')).toBe('descend');
    expect(url.searchParams.get('name')).toBe('ali');
  });

  // Regression guard: building a full url early and prefixing baseUrl again in
  // the fetch helper is how a relative base ended up duplicated in the path.
  it('applies baseUrl exactly once', async () => {
    const { impl, calls } = stubFetch(json([]));
    await new RestDataSource<User, 'id'>({ baseUrl: '/api', fetchImpl: impl }).list({ page: 1, pageSize: 10 });

    expect(calls[0].url.startsWith('/api/list')).toBe(true);
    expect(calls[0].url).not.toContain('/api/api');
  });

  it('omits empty filter values from the query string', async () => {
    const { impl, calls } = stubFetch(json([]));
    const source = new RestDataSource<User, 'id'>({ fetchImpl: impl });

    await source.list({ page: 1, pageSize: 10, filters: { name: '' } });

    expect(calls[0].url).not.toContain('name=');
  });

  it('accepts a bare array response', async () => {
    const { impl } = stubFetch(json([{ id: 1, name: 'a' }, { id: 2, name: 'b' }]));
    const page = await new RestDataSource<User, 'id'>({ fetchImpl: impl }).list({ page: 1, pageSize: 10 });

    expect(page.items).toHaveLength(2);
    expect(page.total).toBe(2);
  });

  it('accepts the { data, total } envelope', async () => {
    const { impl } = stubFetch(json({ data: [{ id: 1, name: 'a' }], total: 57 }));
    const page = await new RestDataSource<User, 'id'>({ fetchImpl: impl }).list({ page: 1, pageSize: 10 });

    expect(page.total).toBe(57);
  });

  it('uses a supplied parseResponse for unusual envelopes', async () => {
    const { impl } = stubFetch(json({ results: { rows: [{ id: 9, name: 'z' }], count: 3 } }));
    const parseResponse = (payload: unknown): CrudPage<User> => {
      const { results } = payload as { results: { rows: User[]; count: number } };
      return { items: results.rows, total: results.count };
    };

    const page = await new RestDataSource<User, 'id'>({ fetchImpl: impl, parseResponse }).list({
      page: 1,
      pageSize: 10,
    });

    expect(page.items[0].id).toBe(9);
    expect(page.total).toBe(3);
  });

  it('explains an unrecognised envelope instead of returning undefined rows', async () => {
    const { impl } = stubFetch(json({ mystery: true }));
    await expect(
      new RestDataSource<User, 'id'>({ fetchImpl: impl }).list({ page: 1, pageSize: 10 }),
    ).rejects.toThrow(/Provide `parseResponse`/);
  });

  it('throws a RestError carrying the status and body', async () => {
    const { impl } = stubFetch(new Response('{"field":"name"}', { status: 422 }));
    const source = new RestDataSource<User, 'id'>({ baseUrl: '/api', fetchImpl: impl });

    const error = await source.list({ page: 1, pageSize: 10 }).then(
      () => { throw new Error('expected the request to reject'); },
      (caught: unknown) => caught,
    );

    expect(error).toBeInstanceOf(RestError);
    expect((error as RestError).status).toBe(422);
    expect((error as RestError).body).toBe('{"field":"name"}');
    expect((error as RestError).message).toContain('/api/list');
  });

  it('sends configured methods and headers', async () => {
    const { impl, calls } = stubFetch(json({ id: 1, name: 'a' }));
    const source = new RestDataSource<User, 'id'>({
      fetchImpl: impl,
      methods: { update: 'PATCH' },
      headers: { Authorization: 'Bearer t' },
    });

    await source.update(1, { name: 'a' });

    expect(calls[0].init?.method).toBe('PATCH');
    expect(calls[0].url).toContain('/update/1');
    const headers = calls[0].init?.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer t');
    expect(headers['Content-Type']).toBe('application/json');
  });

  it('renames pagination params for APIs with a different vocabulary', async () => {
    const { impl, calls } = stubFetch(json([]));
    const source = new RestDataSource<User, 'id'>({
      fetchImpl: impl,
      paramNames: { page: 'page', pageSize: 'limit' },
    });

    await source.list({ page: 3, pageSize: 50 });

    const url = new URL(calls[0].url, 'http://x');
    expect(url.searchParams.get('page')).toBe('3');
    expect(url.searchParams.get('limit')).toBe('50');
    expect(url.searchParams.has('current')).toBe(false);
  });

  it('percent-encodes ids in the path', async () => {
    const { impl, calls } = stubFetch(json({}));
    await new RestDataSource<{ id: string; name: string }, 'id'>({ fetchImpl: impl }).remove('a/b c');

    expect(calls[0].url).toContain('/delete/a%2Fb%20c');
  });

  it('tolerates an empty 204 body on remove', async () => {
    const { impl } = stubFetch(new Response(null, { status: 204 }));
    await expect(new RestDataSource<User, 'id'>({ fetchImpl: impl }).remove(1)).resolves.toBeUndefined();
  });

  it('maps the draft through serializeRequest', async () => {
    const { impl, calls } = stubFetch(json({ id: 1, name: 'a' }));
    const source = new RestDataSource<User, 'id'>({
      fetchImpl: impl,
      serializeRequest: (draft) => ({ payload: draft }),
    });

    await source.create({ name: 'a' });

    expect(JSON.parse(String(calls[0].init?.body))).toEqual({ payload: { name: 'a' } });
  });

  it('is extensible by subclass for non-standard url shapes', async () => {
    const { impl, calls } = stubFetch(json({ id: 1, name: 'a' }));

    class QueryParamIds extends RestDataSource<User, 'id'> {
      protected buildRecordPath(endpoint: string, id: number): string {
        return `${endpoint}?id=${id}`;
      }
    }

    await new QueryParamIds({ fetchImpl: impl }).update(7, { name: 'a' });

    expect(calls[0].url).toBe('/update?id=7');
  });
});

// #64: the source could express a PATCH verb and a fixed header, and very
// little else that a real API asks for.
describe('request configuration', () => {
  it('accepts any verb, not a closed union', async () => {
    const { impl, calls } = stubFetch(json({}));
    await new RestDataSource<User, 'id'>({ fetchImpl: impl, methods: { create: 'PATCH' } }).create({
      name: 'a',
    });

    expect(calls[0].init?.method).toBe('PATCH');
  });

  it('resolves headers per call, so an awaited token works', async () => {
    const { impl, calls } = stubFetch(json([]), json([]));
    let issued = 0;
    const source = new RestDataSource<User, 'id'>({
      fetchImpl: impl,
      configureRequest: async () => {
        issued += 1;
        await Promise.resolve();
        return { headers: { Authorization: `Bearer token-${issued}` } };
      },
    });

    await source.list({ page: 1, pageSize: 10 });
    await source.list({ page: 1, pageSize: 10 });

    expect((calls[0].init?.headers as Record<string, string>).Authorization).toBe('Bearer token-1');
    expect((calls[1].init?.headers as Record<string, string>).Authorization).toBe('Bearer token-2');
  });

  it('sends a header for one operation only', async () => {
    const { impl, calls } = stubFetch(json({}), json([]));
    const source = new RestDataSource<User, 'id'>({
      fetchImpl: impl,
      configureRequest: ({ operation }) =>
        operation === 'create' ? { headers: { 'Idempotency-Key': 'k1' } } : {},
    });

    await source.create({ name: 'a' });
    await source.list({ page: 1, pageSize: 10 });

    expect((calls[0].init?.headers as Record<string, string>)['Idempotency-Key']).toBe('k1');
    expect((calls[1].init?.headers as Record<string, string>)['Idempotency-Key']).toBeUndefined();
  });

  it('builds a conditional header from the id under update', async () => {
    const { impl, calls } = stubFetch(json({}));
    await new RestDataSource<User, 'id'>({
      fetchImpl: impl,
      configureRequest: ({ operation, id }) =>
        operation === 'update' ? { headers: { 'If-Match': `"${String(id)}"` } } : {},
    }).update(7, { name: 'a' });

    expect((calls[0].init?.headers as Record<string, string>)['If-Match']).toBe('"7"');
  });

  it('passes RequestInit fields through to fetch', async () => {
    const { impl, calls } = stubFetch(json([]));
    await new RestDataSource<User, 'id'>({
      fetchImpl: impl,
      init: { credentials: 'include', cache: 'no-store' },
    }).list({ page: 1, pageSize: 10 });

    expect(calls[0].init?.credentials).toBe('include');
    expect(calls[0].init?.cache).toBe('no-store');
  });

  it('honours an AbortSignal', async () => {
    const controller = new AbortController();
    const impl = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      return json([]);
    }) as unknown as typeof fetch;

    controller.abort();
    await expect(
      new RestDataSource<User, 'id'>({ fetchImpl: impl, init: { signal: controller.signal } }).list({
        page: 1,
        pageSize: 10,
      }),
    ).rejects.toThrow(/Abort/);
  });

  it('appends static query parameters to every operation', async () => {
    const { impl, calls } = stubFetch(json([]), json({}));
    const source = new RestDataSource<User, 'id'>({
      fetchImpl: impl,
      query: { 'api-version': '2024-01' },
    });

    await source.list({ page: 1, pageSize: 10 });
    await source.remove(3);

    expect(calls[0].url).toContain('api-version=2024-01');
    expect(calls[1].url).toContain('api-version=2024-01');
  });

  // Appending `?` unconditionally produced two question marks, which a server
  // reads as part of the preceding value rather than as a separator.
  it('merges with a query string already present on the endpoint', async () => {
    const { impl, calls } = stubFetch(json([]));
    await new RestDataSource<User, 'id'>({
      fetchImpl: impl,
      endpoints: { list: '/rows?view=compact' },
    }).list({ page: 1, pageSize: 10 });

    expect(calls[0].url.split('?').length - 1).toBe(1);
    const url = new URL(calls[0].url, 'http://x');
    expect(url.searchParams.get('view')).toBe('compact');
    expect(url.searchParams.get('current')).toBe('1');
  });

  it('maps a create response through parseRecord', async () => {
    const { impl } = stubFetch(json({ data: { id: 9, name: 'wrapped' } }));
    const created = await new RestDataSource<User, 'id'>({
      fetchImpl: impl,
      parseRecord: (payload) => (payload as { data: User }).data,
    }).create({ name: 'wrapped' });

    expect(created).toEqual({ id: 9, name: 'wrapped' });
  });

  it('gives serializeRequest the operation it is serialising for', async () => {
    const { impl, calls } = stubFetch(json({}));
    await new RestDataSource<User, 'id'>({
      fetchImpl: impl,
      serializeRequest: (draft, context) => ({ op: context.operation, attributes: draft }),
    }).update(1, { name: 'a' });

    expect(JSON.parse(String(calls[0].init?.body))).toEqual({
      op: 'update',
      attributes: { name: 'a' },
    });
  });

  it('lets overrides replace the configured verb', async () => {
    const { impl, calls } = stubFetch(json({}));
    await new RestDataSource<User, 'id'>({
      fetchImpl: impl,
      methods: { update: 'PUT' },
      configureRequest: () => ({ method: 'PATCH' }),
    }).update(1, { name: 'a' });

    expect(calls[0].init?.method).toBe('PATCH');
  });

  it('filters are a seam, so a single search parameter is a small override', async () => {
    const { impl, calls } = stubFetch(json([]));

    class SingleSearchParam extends RestDataSource<User, 'id'> {
      protected serializeFilters(
        filters: { readonly [P in keyof User]?: string | number | boolean } | undefined,
        params: URLSearchParams,
      ): void {
        const first = Object.values(filters ?? {}).find((v) => v !== undefined && v !== '');
        if (first !== undefined) params.set('q', String(first));
      }
    }

    await new SingleSearchParam({ fetchImpl: impl }).list({
      page: 1,
      pageSize: 10,
      filters: { name: 'ada' },
    });

    const url = new URL(calls[0].url, 'http://x');
    expect(url.searchParams.get('q')).toBe('ada');
    expect(url.searchParams.has('name')).toBe(false);
  });
});
