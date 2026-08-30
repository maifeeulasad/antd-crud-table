/**
 * Worked examples for common REST dialects.
 *
 * These double as the documentation in docs/rest-recipes.md - keeping them as
 * tests means the recipes cannot drift from the API they describe.
 */
import { describe, it, expect, vi } from 'vitest';

import { RestDataSource } from './RestDataSource';
import type { CrudPage, CrudSort } from './types';

interface Article {
  id: number;
  title: string;
  author: string;
}

const respond = (body: unknown): Response =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });

const recorder = (body: unknown) => {
  const urls: string[] = [];
  const inits: (RequestInit | undefined)[] = [];
  const impl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    urls.push(String(input));
    inits.push(init);
    return respond(body);
  }) as unknown as typeof fetch;
  return { impl, urls, inits };
};

describe('recipe: offset and limit', () => {
  // Many APIs page by row offset rather than page number.
  class OffsetLimitSource extends RestDataSource<Article, 'id'> {
    protected buildListUrl(query: Parameters<RestDataSource<Article, 'id'>['list']>[0]): string {
      const params = new URLSearchParams({
        offset: String((query.page - 1) * query.pageSize),
        limit: String(query.pageSize),
      });
      this.serializeSort(query.sort, params);
      return `${this.endpoints.list}?${params.toString()}`;
    }
  }

  it('translates page and pageSize into offset and limit', async () => {
    const { impl, urls } = recorder({ data: [], total: 0 });
    const source = new OffsetLimitSource({ baseUrl: '/api', fetchImpl: impl });

    await source.list({ page: 3, pageSize: 20 });

    const url = new URL(urls[0], 'http://x');
    expect(url.searchParams.get('offset')).toBe('40');
    expect(url.searchParams.get('limit')).toBe('20');
  });
});

describe('recipe: Django REST Framework', () => {
  // DRF pages with page/page_size and wraps results in { count, results }.
  const source = (impl: typeof fetch) =>
    new RestDataSource<Article, 'id'>({
      baseUrl: '/api',
      endpoints: { list: '/articles', create: '/articles', update: '/articles', remove: '/articles' },
      paramNames: { page: 'page', pageSize: 'page_size', sortBy: 'ordering', sortOrder: 'ignored' },
      methods: { update: 'PATCH' },
      parseResponse: (payload): CrudPage<Article> => {
        const { count, results } = payload as { count: number; results: Article[] };
        return { items: results, total: count };
      },
      fetchImpl: impl,
    });

  it('reads the count/results envelope', async () => {
    const { impl } = recorder({ count: 57, results: [{ id: 1, title: 'a', author: 'b' }] });

    const page = await source(impl).list({ page: 1, pageSize: 10 });

    expect(page.total).toBe(57);
    expect(page.items).toHaveLength(1);
  });

  it('uses page_size and PATCH', async () => {
    const { impl, urls, inits } = recorder({ count: 0, results: [] });
    const rest = source(impl);

    await rest.list({ page: 2, pageSize: 25 });
    expect(new URL(urls[0], 'http://x').searchParams.get('page_size')).toBe('25');

    await rest.update(7, { title: 'x' });
    expect(inits[1]?.method).toBe('PATCH');
    expect(urls[1]).toBe('/api/articles/7');
  });
});

describe('recipe: JSON:API', () => {
  // JSON:API nests pagination under page[...] and sorts with a signed field.
  class JsonApiSource extends RestDataSource<Article, 'id'> {
    protected serializeSort(
      sort: readonly CrudSort<Article>[] | undefined,
      params: URLSearchParams,
    ): void {
      const primary = sort?.[0];
      if (!primary) return;
      // JSON:API expresses descending as a leading minus.
      params.set('sort', `${primary.direction === 'descend' ? '-' : ''}${String(primary.field)}`);
    }

    protected buildListUrl(query: Parameters<RestDataSource<Article, 'id'>['list']>[0]): string {
      const params = new URLSearchParams({
        'page[number]': String(query.page),
        'page[size]': String(query.pageSize),
      });
      this.serializeSort(query.sort, params);
      return `${this.endpoints.list}?${params.toString()}`;
    }
  }

  it('nests pagination and signs the sort field', async () => {
    const { impl, urls } = recorder({ data: [], total: 0 });
    const source = new JsonApiSource({ baseUrl: '/api', fetchImpl: impl });

    await source.list({
      page: 2,
      pageSize: 15,
      sort: [{ field: 'title', direction: 'descend' }],
    });

    const url = new URL(urls[0], 'http://x');
    expect(url.searchParams.get('page[number]')).toBe('2');
    expect(url.searchParams.get('page[size]')).toBe('15');
    expect(url.searchParams.get('sort')).toBe('-title');
  });
});

describe('recipe: bearer auth and an envelope-wrapped write', () => {
  it('sends a token and unwraps the created record', async () => {
    const { impl, inits } = recorder({ data: { id: 9, title: 'made', author: 'me' } });
    const source = new RestDataSource<Article, 'id'>({
      baseUrl: '/api',
      headers: { Authorization: 'Bearer token-123' },
      serializeRequest: (draft) => ({ data: { attributes: draft } }),
      fetchImpl: impl,
    });

    await source.create({ title: 'made' });

    const headers = inits[0]?.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer token-123');
    expect(JSON.parse(String(inits[0]?.body))).toEqual({ data: { attributes: { title: 'made' } } });
  });
});
