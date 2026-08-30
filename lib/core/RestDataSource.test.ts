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
