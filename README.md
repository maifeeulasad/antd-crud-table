

# 🧩 `antd-crud-table` – A Dynamic React Table Generator with Forms 🚀

`antd-crud-table` is a highly flexible and powerful React library built using `antd` and `@ant-design/pro-components`. It provides both a declarative component-based approach and a modern hook-based architecture for creating editable, paginated tables with form support, data fetching, sorting, filtering, and custom rendering. Perfect for building admin dashboards and data management UIs with minimal boilerplate.

## 🆕 Enhanced 📋 API Reference

### CrudTableExperimental Props (Enhanced)

| Prop | Type | Description |
|------|------|-------------|
| `title` | `string` | Table header title |
| `rowKey` | `keyof T` | Unique identifier for each row |
| `columns` | `CrudColumn<T>[]` | Column definitions with enhanced features |
| `hookConfig` | `UseCrudTableConfig<T>` | Hook configuration for data operations |
| `defaultPageSize?` | `number` | Initial page size (default: 10) |
| `enableBulkOperations?` | `boolean` | Enable bulk select/delete (default: false) |
| `customActions?` | `(record, actions) => ReactNode[]` | Custom row actions |ased Architecture**

The experimental version introduces a powerful hook-based architecture with multiple data source strategies:
- **Static Data**: Perfect for prototypes and small datasets
- **API Integration**: REST API support with automatic request handling
- **Custom Operations**: Full control with GraphQL, IndexedDB, or custom logic
- **Built-in State Management**: Loading states, error handling, optimistic updates

---

## 📦 Installation

```bash
npm install antd-crud-table
```

**Peer Dependencies:**
```bash
npm install react react-dom antd @ant-design/pro-components
```

---

## 🚀 Quick Start

Choose your preferred approach:

### Modern Approach (Experimental) - Hook-Based

```tsx
import { CrudTableExperimental } from 'antd-crud-table';

// Static data example
const UserManagement = () => (
  <CrudTableExperimental<User>
    title="User Management"
    rowKey="id"
    hookConfig={{
      staticData: users, // Your data array
      optimisticUpdates: true,
    }}
    columns={[
      {
        title: 'Name',
        dataIndex: 'name',
        fieldType: 'string',
        formConfig: { required: true },
      },
      {
        title: 'Status',
        dataIndex: 'status',
        fieldType: 'enum',
        enumOptions: {
          active: { text: 'Active', color: 'green' },
          inactive: { text: 'Inactive', color: 'orange' },
        },
      },
    ]}
  />
);
```

### Classic Approach (Original) - Service-Based

```tsx
import { CrudTable } from 'antd-crud-table';

const userService = {
  getList: async () => ({ data: [], total: 0 }),
  create: async (data) => data,
  update: async (id, data) => data,
  delete: async (id) => {},
};

const UserTable = () => (
  <CrudTable
    title="User Management"
    rowKey="id"
    service={userService}
    columns={[
      {
        title: 'Name',
        dataIndex: 'name',
        fieldType: 'string',
        fieldEditable: true,
        formConfig: { required: true },
      },
    ]}
  />
);
```

---

## 🎯 **Enhanced Features (Experimental)**

### 1. **Multiple Data Source Strategies**

#### Static Data (Perfect for Prototyping)
```tsx
<CrudTableExperimental
  hookConfig={{
    staticData: mockUsers,
    optimisticUpdates: true,
  }}
  // ... other props
/>
```

#### API Integration (Production Ready)
```tsx
<CrudTableExperimental
  hookConfig={{
    api: {
      baseUrl: 'https://api.example.com',
      endpoints: {
        list: '/users',
        create: '/users', 
        update: '/users',
        delete: '/users',
      },
      headers: {
        'Authorization': 'Bearer your-token',
      },
      transform: {
        response: (data) => ({
          data: data.users,
          total: data.totalCount,
        }),
        request: (data) => ({
          ...data,
          updatedAt: new Date().toISOString(),
        }),
      },
    },
    onSuccess: (operation, data) => {
      console.log(`${operation} completed`, data);
    },
    onError: (operation, error) => {
      console.error(`${operation} failed`, error);
    },
  }}
  // ... other props
/>
```

#### Custom Operations (Maximum Flexibility)
```tsx
<CrudTableExperimental
  hookConfig={{
    operations: {
      getList: async (params) => {
        const result = await myGraphQLQuery(params);
        return {
          data: result.users,
          total: result.totalCount,
          success: true,
        };
      },
      create: async (data) => await myCreateMutation(data),
      update: async (id, data) => await myUpdateMutation(id, data),
      delete: async (id) => await myDeleteMutation(id),
    },
  }}
  // ... other props
/>
```

### 2. **Advanced Features**

#### Bulk Operations
```tsx
<CrudTableExperimental
  enableBulkOperations={true}
  // Automatically adds bulk select and delete functionality
/>
```

#### Custom Actions
```tsx
<CrudTableExperimental
  customActions={(record, actions) => [
    <Button
      key="export"
      onClick={() => exportUser(record)}
    >
      Export
    </Button>,
    <Button
      key="clone"
      onClick={() => actions.create({...record, id: undefined})}
    >
      Clone
    </Button>
  ]}
/>
```

#### Enhanced Validation
```tsx
columns={[
  {
    dataIndex: 'email',
    title: 'Email',
    fieldType: 'string',
    formConfig: {
      required: true,
      rules: [
        { required: true, message: 'Email is required' },
        { type: 'email', message: 'Invalid email format' },
        { 
          validator: async (_, value) => {
            const exists = await checkEmailExists(value);
            if (exists) throw new Error('Email already exists');
          }
        }
      ],
    },
  },
]}
```

### 3. **Custom Hooks**

Create your own specialized hooks for different use cases:

#### Example 1: useUserCrud - Specialized User Management
```tsx
import { useCrudTable, type UseCrudTableConfig } from 'antd-crud-table';

#### Example 1: useUserCrud - Specialized User Management
```tsx
import { useCrudTable, type UseCrudTableConfig } from 'antd-crud-table';

export const useUserCrud = (baseConfig?: Partial<UseCrudTableConfig<any>['api']>) => {
  const config: UseCrudTableConfig<any> = {
    api: {
      baseUrl: '/api/users',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
      },
      transform: {
        request: (data) => ({
          ...data,
          // Add default values or transformations
          updatedAt: new Date().toISOString(),
        }),
        response: (data) => ({
          data: data.users || data.data || [],
          total: data.total || data.count || 0,
          success: true,
        }),
      },
      ...baseConfig,
    },
    defaultPageSize: 10,
    optimisticUpdates: true,
    onSuccess: (operation, data) => {
      console.log(`User ${operation} completed:`, data);
    },
    onError: (operation, error) => {
      console.error(`User ${operation} failed:`, error);
      // Could add toast notifications, error reporting, etc.
    },
  };

  return useCrudTable('id', config);
};
```

#### Example 2: useLocalStorageCrud - Local Storage Persistence
```tsx
export const useLocalStorageCrud = <T extends Record<string, any>>(
  storageKey: string,
  rowKey: keyof T,
  initialData: T[] = []
) => {
  const getStoredData = (): T[] => {
    try {
      const stored = localStorage.getItem(storageKey);
      return stored ? JSON.parse(stored) : initialData;
    } catch {
      return initialData;
    }
  };

  const setStoredData = (data: T[]) => {
    localStorage.setItem(storageKey, JSON.stringify(data));
  };

  return useCrudTable(rowKey, {
    operations: {
      getList: async (params) => {
        const data = getStoredData();
        const { current = 1, pageSize = 10, ...filters } = params;
        
        // Apply filters
        let filteredData = data;
        Object.entries(filters).forEach(([key, value]) => {
          if (value !== undefined && value !== null && value !== '') {
            filteredData = filteredData.filter(item =>
              String(item[key]).toLowerCase().includes(String(value).toLowerCase())
            );
          }
        });
        
        // Apply pagination
        const start = (current - 1) * pageSize;
        const paginatedData = filteredData.slice(start, start + pageSize);
        
        return {
          data: paginatedData,
          total: filteredData.length,
          success: true,
        };
      },
      
      create: async (newItem) => {
        const data = getStoredData();
        const maxId = Math.max(...data.map(item => Number(item[rowKey]) || 0), 0);
        const created = { 
          [rowKey]: maxId + 1, 
          ...newItem,
          createdAt: new Date().toISOString(),
        } as T;
        
        data.push(created);
        setStoredData(data);
        return created;
      },
      
      update: async (id, updateData) => {
        const data = getStoredData();
        const index = data.findIndex(item => item[rowKey] === id);
        if (index === -1) throw new Error('Item not found');
        
        data[index] = { 
          ...data[index], 
          ...updateData,
          updatedAt: new Date().toISOString(),
        };
        setStoredData(data);
        return data[index];
      },
      
      delete: async (id) => {
        const data = getStoredData();
        const filtered = data.filter(item => item[rowKey] !== id);
        setStoredData(filtered);
      },
    },
    optimisticUpdates: true,
  });
};
```

#### Example 3: useRealtimeCrud - WebSocket Integration
```tsx
#### Example 3: useRealtimeCrud - WebSocket Integration
```tsx
export const useRealtimeCrud = <T extends Record<string, any>>(
  rowKey: keyof T,
  websocketUrl: string,
  apiConfig: UseCrudTableConfig<T>['api']
) => {
  const config: UseCrudTableConfig<T> = {
    api: apiConfig,
    optimisticUpdates: false, // Disable optimistic updates for realtime
  };
  
  const crud = useCrudTable(rowKey, config);

  // In a real implementation, you would set up WebSocket listeners here
  // useEffect(() => {
  //   const ws = new WebSocket(websocketUrl);
  //   
  //   ws.onmessage = (event) => {
  //     const { type, data } = JSON.parse(event.data);
  //     switch (type) {
  //       case 'created':
  //       case 'updated':
  //       case 'deleted':
  //         crud.refresh(); // Refresh data when changes occur
  //         break;
  //     }
  //   };
  //   
  //   return () => ws.close();
  // }, [websocketUrl]);

  return crud;
};
```

#### Example 4: useInfiniteScrollCrud - Infinite Scrolling
```tsx
#### Example 4: useInfiniteScrollCrud - Infinite Scrolling
```tsx
export const useInfiniteScrollCrud = <T extends Record<string, any>>(
  rowKey: keyof T,
  baseConfig: UseCrudTableConfig<T>
) => {
  // This would extend the base hook with infinite scroll capabilities
  // Implementation would handle cursor-based pagination, data accumulation, etc.
  
  const config: UseCrudTableConfig<T> = {
    ...baseConfig,
    // Add infinite scroll specific configuration
  };
  
  return useCrudTable(rowKey, config);
};
```

#### Example 5: useCachedCrud - Advanced Caching
```tsx
#### Example 5: useCachedCrud - Advanced Caching
```tsx
export const useCachedCrud = <T extends Record<string, any>>(
  rowKey: keyof T,
  cacheKey: string,
  baseConfig: UseCrudTableConfig<T>
) => {
  const config: UseCrudTableConfig<T> = {
    ...baseConfig,
    enableCache: true,
    // In a real implementation, you might integrate with:
    // - React Query
    // - SWR  
    // - Redux Toolkit Query
    // - Apollo Client
    // etc.
  };
  
  return useCrudTable(rowKey, config);
};
};
```

#### Usage Examples
```tsx
// Using the specialized hooks
const UserTable = () => {
  const userCrud = useUserCrud();
  
  return (
    <CrudTableExperimental
      title="Users" 
      rowKey="id"
      hookConfig={userCrud}
      columns={userColumns}
    />
  );
};

const OfflineTable = () => {
  const offlineCrud = useLocalStorageCrud<User>('users-cache', 'id', mockUsers);
  
  return (
    <CrudTableExperimental
      title="Offline Users" 
      rowKey="id"
      hookConfig={offlineCrud}
      columns={userColumns}
    />
  );
};

const RealtimeTable = () => {
  const realtimeCrud = useRealtimeCrud<User>(
    'id',
    'wss://api.example.com/ws',
    { baseUrl: '/api/users' }
  );
  
  return (
    <CrudTableExperimental
      title="Realtime Users" 
      rowKey="id"
      hookConfig={realtimeCrud}
      columns={userColumns}
    />
  );
};
```

---

## 🏆 Complete Feature Set

### Core Features
- 🎨 **Multiple Column Types**: `string`, `number`, `boolean`, `date`, `enum`, `custom`
- ✅ **Integrated Create/Edit Modal Forms** with validation
- 🚀 **ProTable Integration**: Sorting, pagination & filtering built-in
- 🔁 **Real-time Data Operations** with loading states
- 🧠 **Custom Transform & Render Logic** per field
- 📆 **Smart Date/Time Handling** with `date-fns` + `dayjs`
- 🧰 **Full TypeScript Support** with generics
- 🔐 **Field-Level Edit Controls** 
- 🧼 **Professional UI** with row differentiation

### Enhanced Features (Experimental)
- 🪝 **Hook-Based Architecture** with `useCrudTable`
- 🔌 **Multiple Data Sources**: Static, API, or custom operations
- ⚡ **Built-in State Management**: Loading, error states, optimistic updates
- 🔧 **Extensible Design**: Create custom hooks for your domain
- 📊 **Performance Optimized**: Caching, lazy loading, optimistic updates
- 🎛️ **Bulk Operations**: Select and delete multiple rows
- 🎯 **Custom Actions**: Add your own row-level actions
- 🔍 **Advanced Search**: Configurable column-level search
- ✨ **Enhanced Validation**: Complex form validation rules

---

## API Reference

### CrudTableV2 Props (Enhanced)

| Prop | Type | Description |
|------|------|-------------|
| `title` | `string` | Table header title |
| `rowKey` | `keyof T` | Unique identifier for each row |
| `columns` | `CrudColumn<T>[]` | Column definitions with enhanced features |
| `hookConfig` | `UseCrudTableConfig<T>` | Hook configuration for data operations |
| `defaultPageSize?` | `number` | Initial page size (default: 10) |
| `enableBulkOperations?` | `boolean` | Enable bulk select/delete (default: false) |
| `customActions?` | `(record, actions) => ReactNode[]` | Custom row actions |

### CrudColumn<T> (Enhanced)

| Prop | Type | Description |
|------|------|-------------|
| `dataIndex` | `keyof T` | Field key in your data |
| `title` | `string` | Column header text |
| `fieldType` | `FieldType` | `"string" \| "number" \| "boolean" \| "date" \| "enum" \| "custom"` |
| `fieldEditable?` | `boolean` | Whether field can be edited (default: true) |
| `searchable?` | `boolean` | Whether field appears in search (default: true) |
| `enumOptions?` | `Record<string, {text: string, color?: string}>` | Options for enum fields |
| `customRender?` | `(value, record) => ReactNode` | Custom display renderer |
| `formConfig?` | `FormConfig` | Form field configuration |

### FormConfig

| Prop | Type | Description |
|------|------|-------------|
| `required?` | `boolean` | Whether field is required |
| `rules?` | `FormRule[]` | Ant Design validation rules |
| `component?` | `ReactNode` | Custom form component |
| `transform?` | `(value) => any` | Transform value before saving |

### UseCrudTableConfig<T>

Choose one approach:

```tsx
// Static data approach
{
  staticData: T[];
  optimisticUpdates?: boolean;
}

// API approach  
{
  api: {
    baseUrl: string;
    endpoints?: {...};
    headers?: Record<string, string>;
    transform?: {...};
  };
}

// Custom operations approach
{
  operations: {
    getList: (params) => Promise<{data: T[], total: number}>;
    create: (data: Partial<T>) => Promise<T>;
    update: (id, data: Partial<T>) => Promise<T>;
    delete: (id) => Promise<void>;
  };
}
```

### Legacy CrudTable Props (Original)

| Prop | Type | Description |
|------|------|-------------|
| `columns` | `CrudColumn<T>[]` | Column definitions |
| `service` | `CrudService<T>` | Service object with CRUD methods |
| `rowKey` | `keyof T` | Unique key for each row |
| `title` | `string` | Table header title |
| `defaultPageSize?` | `number` | Optional default page size (default: 5) |

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

## 🔄 Migration Guide

### Upgrading from Original to Experimental

**Original (Service-Based):**
```tsx
<CrudTable
  title="Users"
  rowKey="id"
  service={UserService}
  columns={columns}
/>
```

**Experimental (Hook-Based):**
```tsx
<CrudTableExperimental
  title="Users" 
  rowKey="id"
  hookConfig={{
    operations: UserService, // Reuse existing service
    // Or choose new approaches:
    // staticData: users,
    // api: { baseUrl: '/api' },
  }}
  columns={columns}
/>
```

### Breaking Changes in Experimental
- ✅ **Fully backward compatible**: Original components still work
- 🔄 **New import**: `CrudTableExperimental` for enhanced version
- 🎛️ **Service → hookConfig**: More flexible configuration
- 📊 **Enhanced props**: Additional optional features

### Lazy Loading Options

For better performance with code splitting:

```tsx
// Standard lazy loading
import { CrudTableLazy } from 'antd-crud-table';

// Experimental lazy loading  
import { CrudTableExperimentalLazy } from 'antd-crud-table';

<CrudTableExperimentalLazy
  title="Users"
  rowKey="id" 
  hookConfig={hookConfig}
  columns={columns}
/>
```

---

## 🎨 Column Type Examples

### String Field
```tsx
{
  dataIndex: 'name',
  title: 'Full Name',
  fieldType: 'string',
  formConfig: {
    required: true,
    rules: [
      { min: 2, message: 'Name must be at least 2 characters' }
    ]
  },
}
```

### Number Field
```tsx
{
  dataIndex: 'age',
  title: 'Age',
  fieldType: 'number',
  formConfig: {
    rules: [
      { type: 'number', min: 0, max: 120, message: 'Invalid age' }
    ]
  },
}
```

### Date Field
```tsx
{
  dataIndex: 'createdAt',
  title: 'Created Date',
  fieldType: 'date',
  searchable: false, // Exclude from search
}
```

### Boolean Field  
```tsx
{
  dataIndex: 'isActive',
  title: 'Active Status',
  fieldType: 'boolean',
}
```

### Enum Field
```tsx
{
  dataIndex: 'status',
  title: 'Status',
  fieldType: 'enum',
  enumOptions: {
    active: { text: 'Active', color: 'green' },
    pending: { text: 'Pending', color: 'orange' },
    inactive: { text: 'Inactive', color: 'red' },
  },
}
```

### Custom Field
```tsx
{
  dataIndex: 'customField',
  title: 'Custom Display',
  fieldType: 'custom',
  customRender: (value, record) => (
    <div>
      <Avatar src={record.avatar} />
      <span>{record.name}</span>
    </div>
  ),
  formConfig: {
    component: <MyCustomInput />,
  },
}
```

---

## 🧪 Testing

The hook-based architecture enables easy testing:

```tsx
import { renderHook, act } from '@testing-library/react';
import { useCrudTable } from 'antd-crud-table';

test('should handle CRUD operations', async () => {
  const mockData = [
    { id: 1, name: 'John', age: 30 }
  ];

  const { result } = renderHook(() => 
    useCrudTable('id', {
      staticData: mockData,
    })
  );

  await act(async () => {
    const created = await result.current.create({ 
      name: 'Jane', 
      age: 25 
    });
    expect(created).toBeTruthy();
  });

  expect(result.current.state.data).toHaveLength(2);
});
```

---

## 🚀 Performance Tips

### 1. **Use Static Data for Prototyping**
```tsx
// Perfect for demos and development
hookConfig={{ staticData: mockData }}
```

### 2. **Enable Optimistic Updates**
```tsx
// For better UX with reliable backends
hookConfig={{ 
  api: {...},
  optimisticUpdates: true 
}}
```

### 3. **Implement Proper Caching**
```tsx
// Custom hook with caching
const useUserCrud = () => {
  return useCrudTable('id', {
    enableCache: true,
    // ... other config
  });
};
```

### 4. **Lazy Load Components**
```tsx
import { CrudTableLazy } from 'antd-crud-table';
// Component will be loaded when needed
```

---

## 🔮 Roadmap

### Coming Soon
- 🌐 **WebSocket Integration**: Real-time updates
- 📊 **Virtual Scrolling**: Handle thousands of rows
- 📤 **Export Functionality**: CSV/Excel export
- 🎨 **Theme Support**: Multiple UI themes
- 🔍 **Advanced Filters**: Complex filtering UI
- 📱 **Mobile Optimization**: Better mobile experience

### Community Requests
- 🔧 **Plugin System**: Extensible architecture
- 📈 **Analytics Integration**: Built-in tracking
- 🌍 **i18n Support**: Multi-language support

---

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md).

### Development Setup
```bash
git clone https://github.com/maifeeulasad/antd-crud-table
cd antd-crud-table
npm install
npm run dev
```

---

## 📄 License

MIT License - feel free to use in personal and commercial projects.

---

🎉 Build elegant CRUD interfaces faster than ever with `antd-crud-table`!


---

## References

 - NPM: https://www.npmjs.com/package/antd-crud-table/
 - GitHub: https://github.com/maifeeulasad/antd-crud-table/
 - GitHub page (Live Demo): https://maifeeulasad.github.io/antd-crud-table/