# REST dialect recipes

`RestDataSource` defaults to ProTable's vocabulary — `current` / `pageSize`,
`sortBy` / `sortOrder=ascend|descend`, `PUT /update/:id`. Real APIs vary, so
the pieces that vary are configurable, and the parts that cannot be expressed
declaratively are `protected` methods you override.

Every example here is compiled and asserted in
[`lib/core/RestDataSource.recipes.test.ts`](../lib/core/RestDataSource.recipes.test.ts),
so these recipes cannot drift from the API they describe.

## What is configurable without subclassing

| Option | Purpose |
|---|---|
| `baseUrl` | Prefixed to every request, exactly once |
| `endpoints` | Paths for `list` / `create` / `update` / `remove` |
| `paramNames` | Query-parameter names for page, size, sort field and direction |
| `methods` | HTTP verb per mutating operation |
| `headers` | Sent with every request |
| `serializeRequest` | Maps a draft onto the request body |
| `parseResponse` | Maps a list payload onto `{ items, total }` |

## What you override

| Method | Purpose |
|---|---|
| `buildListUrl(query)` | Full list path and query string |
| `buildRecordPath(endpoint, id)` | How a single record is addressed |
| `serializeSort(sort, params)` | Sort encoding |
| `request(path, init)` | Transport, error handling, retries |

---

## Recipe 1 — offset and limit

Paging by row offset rather than page number.

```ts
class OffsetLimitSource extends RestDataSource<Article, 'id'> {
  protected buildListUrl(query: CrudQuery<Article>): string {
    const params = new URLSearchParams({
      offset: String((query.page - 1) * query.pageSize),
      limit: String(query.pageSize),
    });
    this.serializeSort(query.sort, params);
    return `${this.endpoints.list}?${params.toString()}`;
  }
}
```

Page 3 at 20 per page requests `?offset=40&limit=20`.

## Recipe 2 — Django REST Framework

DRF pages with `page` / `page_size` and wraps results in `{ count, results }`.
No subclass needed — this is all declarative.

```ts
new RestDataSource<Article, 'id'>({
  baseUrl: '/api',
  endpoints: {
    list: '/articles', create: '/articles',
    update: '/articles', remove: '/articles',
  },
  paramNames: { page: 'page', pageSize: 'page_size', sortBy: 'ordering', sortOrder: 'ignored' },
  methods: { update: 'PATCH' },
  parseResponse: (payload) => {
    const { count, results } = payload as { count: number; results: Article[] };
    return { items: results, total: count };
  },
});
```

## Recipe 3 — JSON:API

Pagination nests under `page[...]`, and sort direction is a leading minus
rather than a separate parameter.

```ts
class JsonApiSource extends RestDataSource<Article, 'id'> {
  protected serializeSort(
    sort: readonly CrudSort<Article>[] | undefined,
    params: URLSearchParams,
  ): void {
    const primary = sort?.[0];
    if (!primary) return;
    params.set('sort', `${primary.direction === 'descend' ? '-' : ''}${String(primary.field)}`);
  }

  protected buildListUrl(query: CrudQuery<Article>): string {
    const params = new URLSearchParams({
      'page[number]': String(query.page),
      'page[size]': String(query.pageSize),
    });
    this.serializeSort(query.sort, params);
    return `${this.endpoints.list}?${params.toString()}`;
  }
}
```

## Recipe 4 — bearer auth and envelope-wrapped writes

```ts
new RestDataSource<Article, 'id'>({
  baseUrl: '/api',
  headers: { Authorization: `Bearer ${token}` },
  serializeRequest: (draft) => ({ data: { attributes: draft } }),
});
```

For a token that changes during the session, override `request` instead so it
is read per call rather than captured at construction:

```ts
class AuthedSource extends RestDataSource<Article, 'id'> {
  protected async request(path: string, init: RequestInit = {}): Promise<unknown> {
    return super.request(path, {
      ...init,
      headers: { ...init.headers, Authorization: `Bearer ${getCurrentToken()}` },
    });
  }
}
```

---

## Errors

A non-2xx response throws `RestError`, carrying the status and the raw body so
a caller can branch on it rather than parsing a message string.

```ts
try {
  await source.create(draft);
} catch (error) {
  if (error instanceof RestError && error.status === 422) {
    const problems = JSON.parse(error.body);
    // surface field-level validation
  }
}
```

## Multi-column sort

`serializeSort` receives the full ordered list but sends only the first entry
by default: `sortBy` / `sortOrder` is a single-sort shape, and inventing an
encoding would guess at a convention your server may not share. Override it to
send them all:

```ts
protected serializeSort(sort, params) {
  if (!sort?.length) return;
  params.set('sort', sort.map((s) => `${s.direction === 'descend' ? '-' : ''}${String(s.field)}`).join(','));
}
```
