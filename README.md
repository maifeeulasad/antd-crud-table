<div align="center">

# antd-crud-table

**A typed, schema-driven CRUD table for React — built on [antd](https://ant.design) and [ProComponents](https://procomponents.ant.design).**

Describe your columns once and get a paginated, searchable, sortable table with a
create/edit form, delete confirmations, bulk actions and export — wired to static
data, a REST API, `localStorage`, or anything you implement yourself.

[![npm](https://img.shields.io/npm/v/antd-crud-table?color=1677ff)](https://www.npmjs.com/package/antd-crud-table)
[![license](https://img.shields.io/npm/l/antd-crud-table?color=52c41a)](./LICENSE)
[![React](https://img.shields.io/badge/react-18%20%7C%2019-61dafb)](https://react.dev)
[![types](https://img.shields.io/badge/types-strict-3178c6)](https://www.typescriptlang.org)

[**Live demo**](https://maifeeulasad.github.io/antd-crud-table/) ·
[**Storybook**](https://maifeeulasad.github.io/antd-crud-table/storybook/) ·
[**API reference**](https://maifeeulasad.github.io/antd-crud-table/api/) ·
[**Changelog**](./CHANGELOG.md)

</div>

---

## Why

Most table libraries hand you a grid and leave the CRUD to you. This one takes a
column schema and derives the whole surface from it — the cell renderer, the form
control, the validation, and the value conversion in both directions.

```tsx
<CrudTable<User, 'id'>
  title="Users"
  rowKey="id"
  columns={[
    { dataIndex: 'name',  title: 'Name',  fieldType: 'string', formConfig: { required: true } },
    { dataIndex: 'email', title: 'Email', fieldType: 'email' },
    { dataIndex: 'joined', title: 'Joined', fieldType: 'date' },
  ]}
  hookConfig={{
    api: {
      baseUrl: '/api',
      endpoints: { list: '/users', create: '/users', update: '/users', remove: '/users' },
    },
  }}
/>
```

That renders a searchable, sortable, paginated table with a working create/edit
form, confirmed deletes, and CSV/JSON/Excel export.

## Highlights

- **Strictly typed.** `dataIndex` is bound to `keyof T`, record ids are `T[K]`, and
  `customRender`/`transform` receive that property's own type. No `any` in the
  public API.
- **20 field types** — each one entry in a registry declaring its cell renderer,
  form control, implied validation and value round-trip.
- **Four data strategies** behind one `CrudDataSource` interface: static, REST,
  `localStorage`, or your own. Swap backends without touching your columns.
- **Localized.** Every string is overridable, and the table follows the antd
  `ConfigProvider` around it.
- **Export** to CSV, JSON and Excel, covering the whole filtered result set —
  with CSV formula injection neutralised.
- **Zero runtime dependencies.** Everything is a peer you already have.

## Installation

```bash
npm install antd-crud-table
```

```bash
pnpm add antd-crud-table
```

### Peer dependencies

| Package | Version |
|---|---|
| `react`, `react-dom` | `^18` or `^19` |
| `antd` | `^6.3.6` |
| `@ant-design/icons` | `^6` |
| `@ant-design/pro-components` | `^2.8.10` |
| `dayjs` | `^1.11.13` |

### Stylesheet

The build extracts CSS to a separate file, so **import it once** — importing the
component alone leaves the table unstyled:

```ts
import 'antd-crud-table/styles.css';
```

## Quick start

```tsx
import { CrudTable } from 'antd-crud-table';
import type { CrudColumn } from 'antd-crud-table';
import 'antd-crud-table/styles.css';

interface User {
  id: number;
  name: string;
  email: string;
  status: 'active' | 'inactive';
  joined: string;
}

const columns: CrudColumn<User>[] = [
  { dataIndex: 'name', title: 'Name', fieldType: 'string', formConfig: { required: true } },
  { dataIndex: 'email', title: 'Email', fieldType: 'email' },
  {
    dataIndex: 'status',
    title: 'Status',
    fieldType: 'enum',
    enumOptions: {
      active: { text: 'Active', color: 'green' },
      inactive: { text: 'Inactive', color: 'red' },
    },
  },
  { dataIndex: 'joined', title: 'Joined', fieldType: 'date' },
];

export const Users = () => (
  <CrudTable<User, 'id'>
    title="Users"
    rowKey="id"
    columns={columns}
    defaultPageSize={10}
    enableBulkOperations
    hookConfig={{
      api: {
        baseUrl: '/api',
        endpoints: { list: '/users', create: '/users', update: '/users', remove: '/users' },
      },
    }}
  />
);
```

The second type parameter is the row key. It is what makes ids typed: `remove(id)`
takes a `number` here, not `any`.

## Data strategies

Every strategy implements the same `CrudDataSource<T, K>` interface, so the
columns and behaviour are identical and only the wiring differs.

### Static data

```tsx
hookConfig={{ staticData: users }}
```

In-memory, seeded once. Edits persist for the session. Good for demos, fixtures
and tests.

### REST API

```tsx
hookConfig={{
  api: {
    baseUrl: '/api',
    endpoints: { list: '/users', create: '/users', update: '/users', remove: '/users' },
  },
}}
```

Endpoints default to `/list`, `/create`, `/update` and `/delete` under `baseUrl`,
so a conventional collection needs them stated as above. Paging defaults to
`current`/`pageSize`, and updates to `PUT {update}/:id`. For an API that
speaks a different dialect, `paramNames`, `methods`, `serializeRequest` and
`parseResponse` cover most of it declaratively — see
**[REST dialect recipes](./docs/rest-recipes.md)** for offset/limit, Django REST
Framework, JSON:API and auth.

Failures throw `RestError`, carrying `status` and `body` so you can branch on a
422 rather than parsing a message.

### localStorage

```tsx
hookConfig={{ storageKey: 'my-users', initialData: seed }}
```

Persists across reloads and stamps `createdAt` / `updatedAt`.

### Your own

```tsx
hookConfig={{
  operations: {
    list: async (query) => ({ items: await db.find(query), total: await db.count() }),
    create: async (draft) => db.insert(draft),
    update: async (id, draft) => db.update(id, draft),
    remove: async (id) => db.delete(id),
  },
}}
```

Omitted operations fail with a message naming what is missing, rather than on
`undefined`. For full control, construct a `CrudDataSource` and pass it as
`dataSource`.

## Columns

```ts
interface CrudColumnFor<T, K extends keyof T> {
  dataIndex: K;                                   // must be a real key of T
  title: string;                                  // header, and the form label
  fieldType?: FieldType;                          // defaults to 'string'
  enumOptions?: Record<string, EnumOption>;       // for 'enum'
  customRender?: (value: T[K], record: T) => ReactNode;
  formConfig?: {
    required?: boolean;
    component?: ReactNode;                        // replace the control entirely
    transform?: (value: T[K]) => T[K];            // applied before writing
    rules?: FormRule[];                           // antd validation rules
  };
  fieldEditable?: boolean;                        // default true
  searchable?: boolean;                           // default true
}
```

`CrudColumn<T>` is the union across every key of `T`, so an array annotated
`CrudColumn<User>[]` keeps each column's callbacks bound to its own property type.
Naming a property that does not exist on `T` is a compile error.

### Field types

| Type | Cell | Form control |
|---|---|---|
| `string` | text | `Input` |
| `textarea` | truncated text | `Input.TextArea` |
| `number` | locale-grouped | `InputNumber` |
| `money` | currency | `InputNumber` (2 dp) |
| `percent` | percentage | `InputNumber` with `%` |
| `boolean` | Yes/No tag | `Switch` |
| `enum` | coloured tag | `Select` |
| `date` | formatted datetime | `DatePicker` |
| `time` | time | `TimePicker` |
| `dateRange` | `start ~ end` | `RangePicker` |
| `email` | `mailto:` link | `Input` + email rule |
| `url` | external link | `Input` + url rule |
| `password` | `••••••••` | `Input.Password` |
| `rating` | `Rate` | `Rate` |
| `progress` | `Progress` | `InputNumber` |
| `tags` | tag list | tag `Select` |
| `image` | thumbnail | `Input` |
| `color` | swatch + hex | `ColorPicker` |
| `json` | inline code | monospace `TextArea` |
| `custom` | your `customRender` | your `formConfig.component` |

Each type is one entry in `fieldRegistry` declaring its renderer, control,
validation and `toFormValue`/`fromFormValue` conversion — so a value survives the
round-trip into the edit form and back. Browse them all in the
[Storybook](https://maifeeulasad.github.io/antd-crud-table/storybook/).

**Security note:** `password` values are masked in the table and excluded from
exports. `url`, `email` and `image` render only `http`/`https` (plus `mailto:`)
targets — a `javascript:` value renders as inert text rather than a clickable
link.

## Options

| Prop | Type | Default | Description |
|---|---|---|---|
| `title` | `string` | — | Header, and the export filename |
| `rowKey` | `K` | — | Identity property |
| `columns` | `CrudColumn<T>[]` | — | Column definitions |
| `hookConfig` | `UseCrudTableOptions<T, K>` | — | Data strategy |
| `defaultPageSize` | `number` | `10` | Rows per page |
| `enableBulkOperations` | `boolean` | `false` | Row selection and bulk delete |
| `enableColumnSettings` | `boolean` | `true` | Column visibility and density |
| `enableExport` | `boolean` | `true` | Export menu entries |
| `exportScope` | `'all' \| 'page'` | `'all'` | Whole result set, or visible rows |
| `customActions` | `(record, actions) => ReactNode[]` | — | Extra row controls |
| `locale` | `PartialCrudTableLocale` | English | String overrides |

## Localization

The table follows the antd `ConfigProvider` around it, so setting your app locale
once localizes pagination, date pickers, empty states and the ProTable chrome:

```tsx
import { ConfigProvider } from 'antd';
import frFR from 'antd/locale/fr_FR';

<ConfigProvider locale={frFR}>
  <CrudTable {...config} />
</ConfigProvider>
```

**With no `ConfigProvider` in the tree the table supplies English itself** — antd
components otherwise fall back to their own built-in defaults.

The library's own wording comes from the `locale` prop. Supply only what you want
to change; anything omitted stays English:

```tsx
<CrudTable
  locale={{
    actions: 'Aktionen',
    edit: 'Bearbeiten',
    delete: 'Löschen',
    create: 'Neu',
    confirmDeleteTitle: 'Wirklich löschen?',
    deleteSelected: (count) => `${count} entfernen`,
  }}
  {...config}
/>
```

Interpolated strings are functions rather than templates with placeholders, so a
translation cannot silently drop a value or reorder its arguments. The full
contract is `CrudTableLocale`; `enUS` is the exported default.

## Export

The toolbar menu writes **the whole filtered result set**, not just the visible
page, using the data source's `listAll`. The labels state which they will do —
`Export all as CSV` or `Export page as CSV` when the source cannot list without
pagination. Set `exportScope: 'page'` to opt out.

| Format | Output |
|---|---|
| `csv` | `.csv`, formula-injection safe |
| `json` | `.json`, the raw records |
| `excel` | `.xls`, Excel 2003 SpreadsheetML |

Cells beginning `=`, `+`, `-`, `@`, tab or CR are prefixed so spreadsheets treat
them as text. Quoting alone does not prevent evaluation, and row content in a CRUD
table is exactly the untrusted input an attacker controls. Genuine numbers are
left alone.

> **Excel note:** `excel` emits SpreadsheetML in a `.xls` file rather than OOXML,
> which would mean taking on a ZIP implementation. Excel 2016+ shows a
> format/extension mismatch prompt on open; the file is intact. Use CSV if you
> need a prompt-free export.

## Using the hook directly

`useCrudTable` works without the table when you want your own UI:

```tsx
const crud = useCrudTable<User, 'id'>('id', { storageKey: 'users' });

crud.state;                 // { loading, error, data, total, page, pageSize }
await crud.create({ name: 'Ada' });
await crud.update(1, { name: 'Ada L.' });
await crud.remove(1);
```

`onSuccess` and `onError` fire for every operation — including list failures, with
the original `Error` rather than a flattened string.

## Documentation

| | |
|---|---|
| [Live demo](https://maifeeulasad.github.io/antd-crud-table/) | Every strategy, running |
| [Storybook](https://maifeeulasad.github.io/antd-crud-table/storybook/) | One story per field type |
| [API reference](https://maifeeulasad.github.io/antd-crud-table/api/) | Generated from the types |
| [REST recipes](./docs/rest-recipes.md) | Non-default API dialects |
| [Migration guide](./MIGRATION.md) | Upgrading from 0.5.x |
| [Changelog](./CHANGELOG.md) | Release history |

## Development

```bash
pnpm install
pnpm dev              # demo app
pnpm storybook        # component playground
pnpm test             # unit and component tests
pnpm test:coverage    # with enforced thresholds
pnpm lint
pnpm build:lib        # the published package
pnpm build:site       # demo + storybook + api reference
```

Contributions are welcome. Tests and lint run on every pull request against both
React 18 and 19.

## License

[MIT](./LICENSE) © [Maifee Ul Asad](https://github.com/maifeeulasad)
