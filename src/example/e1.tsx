import './App.css';
import { useLocalStorageCrud } from '../../lib/hooks/useLocalStorageCrud';
import { exportToCSV, exportToJSON } from '../../lib/utils/exportData';
import { Button, Space, message } from 'antd';
import CrudTableLazy from '../../lib/CrudTableLazy';
import type { CrudColumn } from '../../lib/CrudTable';

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
      <CrudTableLazy<User>
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

export default LocalStorageExample;
