import './App.css'
import CrudTableExperimentalLazy from '../lib/CrudTableExperimentalLazy';
import { useLocalStorageCrud } from '../lib/hooks/useLocalStorageCrud';
import { exportToCSV, exportToJSON } from '../lib/utils/exportData';
import { ConfigProvider, Button, Space, message } from 'antd';
import enUS from 'antd/locale/en_US';
import CrudTableLazy from '../lib/CrudTableLazy';
import type { CrudColumn } from '../lib/CrudTable';

interface User {
  id: number;
  name: string;
  age: number;
  createdAt: string;
  status: 'active' | 'inactive';
  isAdmin: boolean;
  email?: string;
  phone?: string;
  website?: string;
  customField?: string;
}

const initialUsers: User[] = [
  { id: 1, name: 'Jane Smith 1', age: 30, createdAt: '2023-01-01T10:00:00Z', status: 'active', isAdmin: true, email: 'jane1@example.com' },
  { id: 2, name: 'John Doe 2', age: 25, createdAt: '2023-02-01T10:00:00Z', status: 'inactive', isAdmin: false, email: 'john2@example.com' },
  { id: 3, name: 'Alice Johnson 3', age: 28, createdAt: '2023-03-01T10:00:00Z', status: 'active', isAdmin: false, email: 'alice3@example.com' },
  { id: 4, name: 'Bob Wilson 4', age: 35, createdAt: '2023-04-01T10:00:00Z', status: 'active', isAdmin: true, email: 'bob4@example.com' },
  { id: 5, name: 'Carol Brown 5', age: 32, createdAt: '2023-05-01T10:00:00Z', status: 'inactive', isAdmin: false, email: 'carol5@example.com' },
  { id: 6, name: 'David Davis 6', age: 29, createdAt: '2023-06-01T10:00:00Z', status: 'active', isAdmin: false, email: 'david6@example.com' },
  { id: 7, name: 'Eva Garcia 7', age: 27, createdAt: '2023-07-01T10:00:00Z', status: 'active', isAdmin: true, email: 'eva7@example.com' },
  { id: 8, name: 'Frank Miller 8', age: 31, createdAt: '2023-08-01T10:00:00Z', status: 'inactive', isAdmin: false, email: 'frank8@example.com' },
];

const mockUsers: User[] = [...initialUsers];

const userColumns: CrudColumn<User>[] = [
  {
    dataIndex: 'name',
    title: 'Full Name',
    fieldType: 'string',
    formConfig: {
      required: true,
      rules: [
        { required: true, message: 'Name is required' },
        { min: 2, message: 'Name must be at least 2 characters' }
      ]
    },
  },
  {
    dataIndex: 'email',
    title: 'Email',
    fieldType: 'string',
    formConfig: {
      required: true,
      rules: [
        { required: true, message: 'Email is required' },
        { type: 'email', message: 'Please enter a valid email' }
      ]
    },
  },
  {
    dataIndex: 'age',
    title: 'Age',
    fieldType: 'number',
    formConfig: {
      rules: [
        { type: 'number', min: 18, max: 99, message: 'Age must be between 18 and 99' }
      ]
    },
  },
  {
    dataIndex: 'createdAt',
    title: 'Created At',
    fieldType: 'date',
    searchable: false,
  },
  {
    dataIndex: 'status',
    title: 'Status',
    fieldType: 'enum',
    enumOptions: {
      active: { text: 'Active', color: 'green' },
      inactive: { text: 'Inactive', color: 'orange' },
    },
    formConfig: { required: true },
  },
  {
    dataIndex: 'isAdmin',
    title: 'Administrator',
    fieldType: 'boolean',
    searchable: false,
  },
];

// Example 1: Static Data Approach
const StaticDataExample = () => (
  <div style={{ marginBottom: '2rem', border: '1px solid #e8e8e8', padding: '1rem', borderRadius: '8px' }}>
    <h2>Example 1: Static Data (In-Memory)</h2>
    <p style={{ color: '#666', marginBottom: '1rem' }}>Data resets on page refresh. Perfect for demos and prototypes.</p>
    <CrudTableExperimentalLazy<User>
      title="User Management (Static Data)"
      rowKey="id"
      defaultPageSize={5}
      enableBulkOperations={true}
      hookConfig={{
        staticData: [...mockUsers],
        optimisticUpdates: true,
        onSuccess: (operation, data) => {
          console.log(`${operation} completed:`, data);
        },
        onError: (operation, error) => {
          console.error(`${operation} failed:`, error);
        },
      }}
      customActions={(record) => [
        <Button
          key="view"
          type="link"
          size="small"
          onClick={() => {
            message.info(`Viewing: ${record.name}`);
          }}
        >
          View
        </Button>
      ]}
      columns={userColumns}
    />
  </div>
);

// Example 2: API-based Approach
const ApiBasedExample = () => (
  <div style={{ marginBottom: '2rem', border: '1px solid #e8e8e8', padding: '1rem', borderRadius: '8px' }}>
    <h2>Example 2: API Integration</h2>
    <p style={{ color: '#666', marginBottom: '1rem' }}>Connect to any REST API with automatic request/response transformation.</p>
    <CrudTableExperimentalLazy<User>
      title="User Management (API Integration)"
      rowKey="id"
      defaultPageSize={5}
      hookConfig={{
        api: {
          baseUrl: 'https://jsonplaceholder.typicode.com',
          endpoints: {
            list: '/users',
            create: '/users',
            update: '/users',
            delete: '/users',
          },
          transform: {
            response: (data) => ({
              data: Array.isArray(data) ? data.slice(0, 5) : [data],
              total: Array.isArray(data) ? Math.min(data.length, 5) : 1,
              success: true,
            }),
          },
        },
        onSuccess: (operation, data) => {
          console.log(`API ${operation} completed:`, data);
        },
        onError: (operation, error) => {
          console.error(`API ${operation} failed:`, error);
        },
      }}
      columns={[
        {
          dataIndex: 'name',
          title: 'Name',
          fieldType: 'string',
          formConfig: { required: true },
        },
        {
          dataIndex: 'email',
          title: 'Email',
          fieldType: 'string',
          formConfig: { required: true },
        },
        {
          dataIndex: 'phone',
          title: 'Phone',
          fieldType: 'string',
          searchable: false,
        },
        {
          dataIndex: 'website',
          title: 'Website',
          fieldType: 'string',
          searchable: false,
        },
      ]}
    />
  </div>
);

// Example 3: Custom Operations Approach
const CustomOperationsExample = () => (
  <div style={{ marginBottom: '2rem', border: '1px solid #e8e8e8', padding: '1rem', borderRadius: '8px' }}>
    <h2>Example 3: Custom Operations (IndexedDB, GraphQL, etc.)</h2>
    <p style={{ color: '#666', marginBottom: '1rem' }}>Full control with custom CRUD operations for any data source.</p>
    <CrudTableExperimentalLazy<User>
      title="User Management (Custom Operations)"
      rowKey="id"
      defaultPageSize={5}
      hookConfig={{
        operations: {
          getList: async (params) => {
            console.log('Custom getList called with:', params);
            const filteredData = mockUsers.filter(user =>
              params.name ? user.name.toLowerCase().includes(params.name.toLowerCase()) : true
            );
            return {
              data: filteredData.slice(0, params.pageSize || 5),
              total: filteredData.length,
              success: true,
            };
          },
          create: async (data) => {
            console.log('Custom create called with:', data);
            const newUser = {
              id: Date.now(),
              ...data,
              createdAt: new Date().toISOString(),
            } as User;
            return newUser;
          },
          update: async (id, data) => {
            console.log('Custom update called:', id, data);
            return { id, ...data } as User;
          },
          delete: async (id) => {
            console.log('Custom delete called:', id);
          },
        },
        optimisticUpdates: false,
      }}
      columns={[
        {
          dataIndex: 'name',
          title: 'Name',
          fieldType: 'string',
          formConfig: { required: true },
        },
        {
          dataIndex: 'age',
          title: 'Age',
          fieldType: 'number',
        },
        {
          dataIndex: 'status',
          title: 'Status',
          fieldType: 'enum',
          enumOptions: {
            active: { text: 'Active', color: 'green' },
            inactive: { text: 'Inactive', color: 'red' },
          },
        },
        {
          dataIndex: 'customField',
          title: 'Custom Render',
          fieldType: 'custom',
          customRender: (_, record) => (
            <span style={{ color: record.isAdmin ? '#1890ff' : '#999' }}>
              {record.isAdmin ? 'Admin' : 'User'}
            </span>
          ),
          searchable: false,
          fieldEditable: false,
        },
      ]}
    />
  </div>
);

// Example 4: LocalStorage Persistence
const LocalStorageExample = () => {
  const storageKey = 'antd-crud-demo-users';
  const crud = useLocalStorageCrud<User>('id', storageKey, initialUsers, {
    defaultPageSize: 5,
    optimisticUpdates: true,
    onSuccess: (operation, data) => {
      console.log(`LocalStorage ${operation}:`, data);
    },
  });

  const handleExport = (format: 'csv' | 'json') => {
    const data = crud.state.data;
    const columns = userColumns.map(col => ({
      title: String(col.title),
      dataIndex: String(col.dataIndex),
      fieldType: col.fieldType,
      enumOptions: col.enumOptions,
    }));
    if (format === 'csv') {
      exportToCSV({ data, columns, filename: 'users-export' });
    } else {
      exportToJSON({ data, columns, filename: 'users-export' });
    }
    message.success(`Exported to ${format.toUpperCase()}`);
  };

  return (
    <div style={{ marginBottom: '2rem', border: '1px solid #52c41a', padding: '1rem', borderRadius: '8px' }}>
      <h2>Example 4: LocalStorage Persistence</h2>
      <p style={{ color: '#666', marginBottom: '1rem' }}>
        Data persists across page refreshes using browser localStorage.
        Changes you make will be saved!
      </p>
      <Space style={{ marginBottom: '1rem' }}>
        <Button onClick={() => handleExport('csv')}>Export CSV</Button>
        <Button onClick={() => handleExport('json')}>Export JSON</Button>
        <Button onClick={() => {
          localStorage.removeItem(storageKey);
          window.location.reload();
        }} danger>Reset Data</Button>
      </Space>
      <CrudTableExperimentalLazy<User>
        title="User Management (LocalStorage)"
        rowKey="id"
        defaultPageSize={5}
        enableBulkOperations={true}
        hookConfig={{
          operations: {
            getList: async (params) => {
              const data = crud.state.data;
              const filtered = data.filter((item: User) =>
                params.name ? item.name.toLowerCase().includes(params.name.toLowerCase()) : true
              );
              const start = ((params.current || 1) - 1) * (params.pageSize || 10);
              return {
                data: filtered.slice(start, start + (params.pageSize || 10)),
                total: filtered.length,
                success: true,
              };
            },
            create: async (data) => {
              const newItem = { id: Date.now(), ...data, createdAt: new Date().toISOString() } as User;
              await crud.create(newItem);
              return newItem;
            },
            update: async (id, data) => {
              await crud.update(id, data);
              return { id, ...data } as User;
            },
            delete: async (id) => {
              await crud.delete(id);
            },
          },
          optimisticUpdates: true,
        }}
        customActions={(record) => [
          <Button
            key="view"
            type="link"
            size="small"
            onClick={() => {
              message.info(`Email: ${record.email}`);
            }}
          >
            View Email
          </Button>
        ]}
        columns={userColumns}
      />
    </div>
  );
};

// Example 5: Old implementation (for reference)
let data: User[] = [
  { id: 1, name: 'Jane Smith 1', age: 30, createdAt: '2023-01-01', status: 'active', isAdmin: true },
  { id: 2, name: 'Jane Smith 2', age: 25, createdAt: '2023-02-01', status: 'inactive', isAdmin: false },
  { id: 3, name: 'Jane Smith 3', age: 25, createdAt: '2023-02-01', status: 'inactive', isAdmin: false },
  { id: 4, name: 'Jane Smith 4', age: 25, createdAt: '2023-02-01', status: 'inactive', isAdmin: false },
  { id: 5, name: 'Jane Smith 5', age: 25, createdAt: '2023-02-01', status: 'inactive', isAdmin: false },
  { id: 6, name: 'Jane Smith 6', age: 25, createdAt: '2023-02-01', status: 'inactive', isAdmin: false },
  { id: 7, name: 'Jane Smith 7', age: 25, createdAt: '2023-02-01', status: 'inactive', isAdmin: false },
  { id: 8, name: 'Jane Smith 8', age: 25, createdAt: '2023-02-01', status: 'inactive', isAdmin: false },
  { id: 9, name: 'Jane Smith 9', age: 25, createdAt: '2023-02-01', status: 'inactive', isAdmin: false },
  { id: 10, name: 'Jane Smith 10', age: 25, createdAt: '2023-02-01', status: 'inactive', isAdmin: false },
  { id: 11, name: 'Jane Smith 11', age: 25, createdAt: '2023-02-01', status: 'inactive', isAdmin: false },
  { id: 12, name: 'Jane Smith 12', age: 25, createdAt: '2023-02-01', status: 'inactive', isAdmin: false },
]

class UserService {
  static async getList(): Promise<{ data: User[]; total: number }> {
    return {
      data,
      total: data.length,
    }
  }

  static async create(itemData: Partial<User>) {
    return itemData as User;
  }

  static async update(id: number, itemData: Partial<User>) {
    return { id, ...itemData } as User;
  }

  static async delete(id: number) {
    data = data.filter((item) => item.id !== id);
  }
}

const OldUserTableExample = () => (
  <div style={{ marginBottom: '2rem', border: '1px solid #999', padding: '1rem', borderRadius: '8px', opacity: 0.8 }}>
    <h2>Example 5: Legacy Service-Based Implementation</h2>
    <p style={{ color: '#666', marginBottom: '1rem' }}>Original implementation using service pattern.</p>
    <CrudTableLazy<User>
      title="User Management (Legacy)"
      rowKey="id"
      service={UserService}
      columns={[
        {
          dataIndex: 'name',
          title: 'Name',
          fieldType: 'string',
          formConfig: { required: true },
        },
        {
          dataIndex: 'age',
          title: 'Age',
          fieldType: 'number',
          fieldEditable: false,
        },
        {
          dataIndex: 'createdAt',
          title: 'Created At',
          fieldType: 'date',
        },
        {
          dataIndex: 'status',
          title: 'Status',
          fieldType: 'enum',
          enumOptions: {
            active: { text: 'Active' },
            inactive: { text: 'Inactive' },
          },
        },
        {
          dataIndex: 'isAdmin',
          title: 'Administrator',
          fieldType: 'boolean',
        },
      ]}
    />
  </div>
);

const App = () => (
  <ConfigProvider locale={enUS}>
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>AntD CRUD Table</h1>
        <p style={{ color: '#666', fontSize: '1.1rem' }}>
          A powerful React library for creating editable, paginated tables with form support
        </p>      
      </div>

      <LocalStorageExample />
      <StaticDataExample />
      <ApiBasedExample />
      <CustomOperationsExample />
      <OldUserTableExample />

      <div style={{ marginTop: '2rem', padding: '1rem', background: '#f5f5f5', borderRadius: '8px' }}>
        <h3>Features</h3>
        <ul>
          <li><strong>Multiple Data Sources:</strong> Static data, REST API, localStorage, IndexedDB, GraphQL</li>
          <li><strong>Field Types:</strong> String, Number, Date, Boolean, Enum, Custom</li>
          <li><strong>Operations:</strong> Create, Read, Update, Delete with validation</li>
          <li><strong>Export:</strong> CSV, JSON, XLSX support</li>
          <li><strong>Bulk Operations:</strong> Multi-select and batch delete</li>
          <li><strong>Custom Actions:</strong> Add your own row-level buttons</li>
          <li><strong>Optimistic Updates:</strong> Instant UI feedback</li>
          <li><strong>Full TypeScript:</strong> Complete type definitions</li>
        </ul>
      </div>
    </div>
  </ConfigProvider>
);

export default App;
