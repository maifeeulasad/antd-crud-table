# Changelog

All notable changes to this project are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

Everything below lands as **0.6.0**. It is a breaking release; see
[MIGRATION.md](./MIGRATION.md), where every break is a compile error rather than
a silent behaviour change.

### Security

- CSV and Excel exports no longer carry formula injection. Quoting a cell does
  not stop a spreadsheet evaluating it, so a stored value beginning `=`, `+`,
  `-`, `@`, tab or CR is now prefixed to mark it as text. Genuinely numeric
  values are left alone.
- `url`, `email` and `image` columns render only allowlisted schemes. React 18
  warns about a `javascript:` href but still renders it, so a stored value could
  become a click-to-execute link. Rejected values render as inert text.

### Added

- `CrudDataSource<T, K>` interface with `StaticDataSource`,
  `LocalStorageDataSource`, `RestDataSource` and `CustomDataSource`
  implementations, all usable and testable without React.
- `dataSource` strategy, for supplying a source you construct and own.
- `storageKey` strategy on `useCrudTable`, without the wrapper hook.
- `generateId` for overriding identity assignment.
- `notifications: false` to suppress the built-in toasts.
- `exportScope` for choosing between the whole result set and the visible page.
- `paramNames` and `methods` on the REST source, plus protected `buildListUrl`,
  `buildRecordPath` and `serializeSort` seams for subclassing.
- `RestError` carrying the HTTP status and response body.
- React 19 support alongside 18, verified against both.

### Changed

- **Breaking.** `DataType` (`Record<string, any>`) is gone; record types are
  constrained to `object`, so plain interfaces work without an index signature.
- **Breaking.** Components take a row-key type parameter: `CrudTable<User, 'id'>`.
- **Breaking.** `CrudColumn<T>` is distributed over `keyof T`, binding
  `dataIndex` to a real property. `title` must be a string.
- **Breaking.** Operations renamed to match the data-source interface:
  `getList` → `list`, `delete` → `remove`, `{ data, total }` → `{ items, total }`.
- **Breaking.** Hook surface: `delete` → `remove`, `operations` → `dataSource`,
  `state.current` → `state.page`, `setCurrentPage` → `setPage`, and
  `state.error` is an `Error` rather than a string.
- **Breaking.** REST config: `endpoints.delete` → `endpoints.remove`,
  `transform.response` → `parseResponse`, `transform.request` → `serializeRequest`.
- **Breaking.** Export format `'xlsx'` → `'excel'`, `exportToXLSX` → `exportToExcel`.
  The output is unchanged: Excel 2003 SpreadsheetML in a `.xls` file. Only the
  name changed, because `xlsx` promised OOXML this library does not produce.
- **Breaking.** Redundant default exports removed from `useCrudTable`,
  `useLocalStorageCrud` and `exportData`; use the named exports. The barrel's
  default export of `CrudTable` is unchanged.
- `onError` receives a real `Error`, and now fires for list failures — the
  initial load, pagination, sorting and search.
- Export covers the whole filtered result set rather than the visible page, and
  the menu states which it will do.
- Sorting collates by locale, so ordering is alphabetical rather than
  capitals-first.
- `@typescript-eslint/no-explicit-any` is an error rather than a warning.

### Fixed

- Mutations issued two list requests each: the hook refreshed while the table
  also reloaded, and the hook's copy was then discarded.
- `onError` never fired for the primary list load, and the underlying error was
  replaced with a fixed string.
- An inline `staticData` literal discarded every created and edited row whenever
  the parent re-rendered.
- Non-numeric row keys all generated id `1`, producing duplicate keys and
  sending `update`/`remove` to the wrong record.
- Search values silently overwrote column filters for the same key.
- Bulk delete reported success when individual deletes failed, and cleared the
  selection regardless.
- `enableColumnSettings` was declared but never read.
- The create/edit modal rendered Chinese OK and Cancel buttons.
- Hook callbacks were recreated on every render, defeating their memoization.
- Test type declarations were being published in the package.

### Packaging

- `sideEffects: ["*.css"]` and an `engines.node` floor declared.
- Rollup's export mode stated explicitly, removing the mixed-export warnings.
- README documents the required stylesheet import, which it never did.
