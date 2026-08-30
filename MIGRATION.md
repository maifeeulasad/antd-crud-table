# Migration guide

## 0.5.x → 0.6.0

0.6.0 makes the public API strictly typed and replaces the closure-based data
strategies with classes behind a single `CrudDataSource` interface. Every break
below is a compile error, not a silent behaviour change — TypeScript will point
at each call site.

### 1. Components take a row-key type parameter

`rowKey` is now part of the type, so ids carry the property's real type instead
of `any`.

```diff
- <CrudTable<User> rowKey="id" … />
+ <CrudTable<User, 'id'> rowKey="id" … />
```

### 2. `DataType` is gone

`DataType` was `Record<string, any>` and constrained every generic in the
library to it. Record types are now constrained to `object`, so plain
interfaces work directly.

```diff
- import type { DataType } from 'antd-crud-table';
- interface User extends DataType { id: number; name: string }
+ interface User { id: number; name: string }
```

### 3. `columns` entries are bound to a key

`CrudColumn<T>` is now a union over `keyof T`, so `dataIndex` must name a real
property and `customRender` / `transform` receive that property's type.
Annotations of the form `CrudColumn<User>[]` keep working unchanged.

A column naming a property that does not exist on `T` is now a compile error —
previously it silently rendered blank.

`title` must be a `string` (it doubles as the form label). For a decorated
header, use ProTable's `renderFormItem` or supply `formConfig.component`.

`formConfig.rules` is typed as antd's `FormRule[]` rather than `any[]`.

### 4. Operations renamed and restructured

The `operations` bag now matches the `CrudDataSource` interface.

| 0.5.x | 0.6.0 |
|---|---|
| `getList(params)` | `list(query)` |
| `delete(id)` | `remove(id)` |
| `{ data, total, success }` | `{ items, total }` |
| `params.current` | `query.page` |
| `params.<field>` | `query.filters.<field>` |
| `params.sortBy` / `sortOrder` | `query.sort[]` |

```diff
  hookConfig={{
    operations: {
-     getList: async (params) => {
-       const rows = all.filter(u => params.name ? u.name.includes(params.name) : true);
-       return { data: rows.slice(0, params.pageSize), total: rows.length, success: true };
-     },
-     delete: async (id) => { await api.destroy(id); },
+     list: async (query) => {
+       const needle = query.filters?.name;
+       const rows = needle ? all.filter(u => u.name.includes(String(needle))) : all;
+       return { items: rows.slice(0, query.pageSize), total: rows.length };
+     },
+     remove: async (id) => { await api.destroy(id); },
    },
  }}
```

### 5. REST configuration

```diff
  api: {
    baseUrl: '/api',
    endpoints: {
      list: '/users',
-     delete: '/users',
+     remove: '/users',
    },
-   transform: {
-     response: (data) => ({ data: data.rows, total: data.count, success: true }),
-     request: (data) => ({ payload: data }),
-   },
+   parseResponse: (payload) => ({ items: payload.rows, total: payload.count }),
+   serializeRequest: (draft) => ({ payload: draft }),
  }
```

New in 0.6.0: `paramNames` renames pagination and sort parameters, and
`methods` selects the HTTP verb per operation — so an API that does not speak
`current` / `pageSize` / `PUT` no longer needs a hand-written `operations` bag.

### 5b. Export format renamed

`'xlsx'` is now `'excel'`, and `exportToXLSX` is now `exportToExcel`.

```diff
- exportData({ data, columns, format: 'xlsx' });
+ exportData({ data, columns, format: 'excel' });
```

The output is unchanged — Excel 2003 SpreadsheetML written to a `.xls` file.
Only the name changed, because `xlsx` promised OOXML, which this library does
not produce and will not without taking on a ZIP implementation.

**Known limitation:** because the content is SpreadsheetML and the extension is
`.xls`, Excel 2016 and later show *"The file format and extension of
'export.xls' don't match. The file could be corrupted or unsafe."* on open. The
file is intact and opens correctly once confirmed. Use CSV if you need an
export that opens without a prompt.

### 6. Hook return shape

| 0.5.x | 0.6.0 |
|---|---|
| `actions.delete(id)` | `actions.remove(id)` |
| `actions.operations` | `actions.dataSource` |
| `state.current` | `state.page` |
| `state.error: string \| null` | `state.error: Error \| null` |
| `setCurrentPage(n)` | `setPage(n)` |

`onError` now receives a real `Error` rather than an unknown thrown value, and
**fires for list failures** — the initial load, pagination, sorting and search.
In 0.5.x it only fired for mutations, so the failures that mattered most were
silent.

### 7. `useLocalStorageCrud` options

The fourth argument is `UseLocalStorageCrudOptions` rather than
`UseLocalStorageCrudConfig`; the fields are unchanged.

### 8. Behaviour changes worth knowing

**One list request per mutation.** 0.5.x refreshed inside the hook *and*
reloaded through `actionRef`, issuing two. If you relied on `state.data`
updating after a mutation while also using `CrudTable`, read from the table's
own request pipeline instead, or set `refreshAfterMutation: true` explicitly.

**Inline `staticData` now persists.** The dataset is seeded once into the
source rather than rebuilt from the array's identity, so created and edited
rows survive parent re-renders. Changing `staticData` after mount no longer
replaces the data — construct a `StaticDataSource` yourself and pass it as
`dataSource` if you need to swap datasets.

**Non-numeric ids no longer collide.** String and UUID row keys previously all
generated `1`. They now get unique values. Datasets with mixed key types throw
rather than colliding silently; pass `generateId` for those.

**Column filters and search values merge** instead of search silently
overwriting the filter for the same key.

**Bulk delete reports partial failure** and keeps failed rows selected, rather
than clearing the selection and reporting success.

**Sorting collates by locale**, so `['Alice', 'bob', 'Dave']` rather than
capitals-first.

### 8b. React 19

`peerDependencies` now accept `^18.0.0 || ^19.0.0`. Nothing to change if you are
on 18; React 19 users no longer need `--force` or an override.

### 8c. Default exports removed from utility modules

`useCrudTable`, `useLocalStorageCrud` and `exportData` no longer have default
exports — the named exports already existed, and the mix meant CJS consumers
reached them through `.default`.

```diff
- import useCrudTable from 'antd-crud-table/hooks/useCrudTable';
+ import { useCrudTable } from 'antd-crud-table/hooks/useCrudTable';
```

`import CrudTable from 'antd-crud-table'` is unchanged.

### 8d. Stylesheet import

Not a change, but frequently missed and previously undocumented: the build
extracts CSS to a separate file, so it has to be imported once.

```ts
import 'antd-crud-table/styles.css';
```

### 8e. Localization

Not a break, but a behaviour change worth knowing: the table now follows the
surrounding antd `ConfigProvider` instead of pinning ProTable to English. If
your app sets a non-English locale, the table's chrome will now follow it.

With no provider present the table supplies English, which is what previously
leaked antd's Chinese defaults into the pagination and modal footer.

`FieldTypeDefinition` hooks take an extra `locale` argument — `column(col,
locale)`, `formControl(col, disabled, locale)` and `rules(col, locale)`. This
only affects code that registers custom field types or calls the registry
directly.

### 9. New capabilities

- `dataSource` strategy — construct and own a source directly
- `storageKey` strategy on `useCrudTable`, without the wrapper hook
- `generateId` to override identity assignment
- `notifications: false` to suppress the built-in toasts
- `enableColumnSettings` now actually works (it was declared but never read)
- `listAll()` for exporting beyond the current page
