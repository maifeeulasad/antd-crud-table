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
| `methods` | HTTP verb per operation — any string, not a closed union |
| `headers` | Sent with every request |
| `query` | Query parameters appended to every request |
| `init` | `RequestInit` passthrough — `credentials`, `mode`, `cache`, `signal` |
| `configureRequest` | Per-call adjustments, may be async |
| `serializeRequest` | Maps a draft onto the request body |
| `parseResponse` | Maps a list payload onto `{ items, total }` |
| `parseRecord` | Maps a create/update payload onto the record |

## What you override

| Method | Purpose |
|---|---|
| `buildListUrl(query)` | Full list path and query string |
| `serializeFilters(filters, params)` | Filter encoding |
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

## Recipe 5 — auth, versioning and conditional writes

`configureRequest` runs per call and may be async, which is what makes a
rotating token, a per-operation header and a conditional write expressible
without a subclass.

```ts
new RestDataSource<User, 'id'>({
  baseUrl: '/api',
  endpoints: { list: '/users', create: '/users', update: '/users', remove: '/users' },
  methods: { update: 'PATCH' },
  headers: { 'X-Api-Version': '2024-01' },   // fixed, every request
  query:   { 'api-key': 'demo' },            // appended to every request
  init:    { credentials: 'include' },       // cookie auth

  configureRequest: async ({ operation, id, draft }) => {
    // Awaited per call, so an expired token refreshes mid-session.
    const headers: Record<string, string> = {
      Authorization: `Bearer ${await tokens.current()}`,
    };

    // One operation only.
    if (operation === 'create') headers['Idempotency-Key'] = keyFor(draft);
    if (operation === 'update') headers['If-Match'] = `"${revisionOf(id)}"`;

    return { headers };
  },

  serializeRequest: (draft) => ({ data: { attributes: draft } }),
  parseResponse: (payload) => {
    const { data, meta } = payload as { data: User[]; meta: { total_count: number } };
    return { items: data, total: meta.total_count };
  },
  // Writes are enveloped too; without this the envelope comes back as the record.
  parseRecord: (payload) => (payload as { data: User }).data,
});
```

`configureRequest` is merged **over** the static options, so it can also replace
the verb for a single call.

## Recipe 6 — one search parameter instead of one per column

By default each filter is sent under its own field name. An API with a single
`?q=` overrides one seam:

```ts
class SingleSearchParam extends RestDataSource<User, 'id'> {
  protected serializeFilters(filters: CrudQuery<User>['filters'], params: URLSearchParams): void {
    const first = Object.values(filters ?? {}).find((v) => v !== undefined && v !== '');
    if (first !== undefined) params.set('q', String(first));
  }
}
```

## Verified against a real server

The recipes above are unit-tested, and the awkward-API shape is additionally
exercised end to end against the dev server under `backend/` — bearer auth with
expiring tokens, a required version header, PATCH updates, conditional writes,
idempotent creates and enveloped payloads:

```bash
pnpm test:integration
```

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
