

# 🧩 `antd-crud-table` – A Dynamic React Table Generator with Forms 🚀

`CrudTable` is a highly flexible and powerful React component built using `antd` and `@ant-design/pro-components`. It provides a declarative way to render editable, paginated tables with form support, data fetching, sorting, filtering, and custom rendering. Perfect for building admin dashboards and data management UIs with minimal boilerplate.

---

## 📦 Installation

Install dependencies with:

```bash
npm install antd-crud-table
```

---

## ⚙️ Usage Example

```tsx
import CrudTable, { CrudTableConfig } from 'antd-crud-table';

const userService = {
  getList: async () => ({ data: [], total: 0 }),
  create: async (data) => data,
  update: async (id, data) => data,
  delete: async (id) => {},
};

const config: CrudTableConfig<any> = {
  title: 'User Management',
  rowKey: 'id',
  service: userService,
  columns: [
    {
      title: 'Name',
      dataIndex: 'name',
      fieldType: 'string',
      fieldEditable: true,
      formConfig: { required: true },
    },
    {
      title: 'Status',
      dataIndex: 'status',
      fieldType: 'enum',
      enumOptions: {
        active: { text: 'Active' },
        inactive: { text: 'Inactive' },
      },
      formConfig: { required: true },
    },
  ],
};

export default function Admin() {
  return <CrudTable {...config} />;
}
```

---

## 🏆 Features

- 🎨 **Customizable Column Types** (`string`, `number`, `boolean`, `date`, `enum`, `custom`)
- ✅ **Integrated Create/Edit Modal Form**  
- 🚀 **ProTable-based Sorting, Pagination & Filtering**  
- 🔁 **Refetching and Action Toolbar**  
- 🧠 **Custom Transform & Render Logic per Field**  
- 📆 **Built-in Date/Time Formatting with `date-fns` + `dayjs`**  
- 🧰 **Typesafe Configuration with TypeScript Support**  
- 🔐 **Editable Field Controls (per column)**  
- 🧼 **Clean, Formatted Layout with Row Differentiation Support**

---

## 🛠️ Props

### `CrudTableConfig<T>`
| Prop | Type | Description |
|------|------|-------------|
| `columns` | `CrudColumn<T>[]` | Column definitions including types and rendering logic |
| `service` | `{ getList, create, update, delete }` | API service methods for data fetching and CRUD |
| `rowKey` | `keyof T` | Unique key for each row |
| `title` | `string` | Table header title |
| `defaultPageSize?` | `number` | Optional default page size (default is 5) |

### `CrudColumn<T>`
Extends `ProColumns<T>` with:

| Prop | Type | Description |
|------|------|-------------|
| `fieldType` | `"string" \| "number" \| "boolean" \| "date" \| "enum" \| "custom"` | Field type |
| `enumOptions?` | `Record<string, { text: string }>` | Options for enum dropdown |
| `formConfig?` | `{ required?: boolean, component?: ReactNode, transform?: fn }` | Form field behavior |
| `fieldEditable?` | `boolean` | Whether the field is editable in form |
| `customRender?` | `(value, record) => ReactNode` | Custom render function for custom fields |

---

## 📁 Styling

Customize row striping using `.row-differentiator` in `CrudTable.css`:

```css
.row-differentiator {
  background-color: #fafafa;
}
```

---

## 📌 Notes

- Date fields are handled via `dayjs` in the form and `date-fns` for display.
- All requests are async with error handling via `antd`'s `message` API.
- Add your own export logic or additional toolbar buttons as needed.

---

🎉 Build elegant CRUD interfaces faster than ever with `antd-crud-table`!


---

## References

 - NPM: https://www.npmjs.com/package/antd-crud-table/
 - GitHub: https://github.com/maifeeulasad/antd-crud-table/
 - GitHub page (Live Demo): https://maifeeulasad.github.io/antd-crud-table/