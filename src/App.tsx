import './App.css'
import CrudTableExperimental from '../lib/CrudTableExperimental';
import { ConfigProvider, Button } from 'antd';
import enUS from 'antd/locale/en_US';
import CrudTableLazy from '../lib/CrudTableLazy';

interface User {
  id: number;
  name: string;
  age: number;
  createdAt: string;
  status: 'active' | 'inactive';
  isAdmin: boolean;
  email?: string;
}

const mockUsers: User[] = [
  { id: 1, name: 'Jane Smith 1', age: 30, createdAt: '2023-01-01T10:00:00Z', status: 'active', isAdmin: true, email: 'jane1@example.com' },
  { id: 2, name: 'John Doe 2', age: 25, createdAt: '2023-02-01T10:00:00Z', status: 'inactive', isAdmin: false, email: 'john2@example.com' },
  { id: 3, name: 'Alice Johnson 3', age: 28, createdAt: '2023-03-01T10:00:00Z', status: 'active', isAdmin: false, email: 'alice3@example.com' },
  { id: 4, name: 'Bob Wilson 4', age: 35, createdAt: '2023-04-01T10:00:00Z', status: 'active', isAdmin: true, email: 'bob4@example.com' },
  { id: 5, name: 'Carol Brown 5', age: 32, createdAt: '2023-05-01T10:00:00Z', status: 'inactive', isAdmin: false, email: 'carol5@example.com' },
  { id: 6, name: 'David Davis 6', age: 29, createdAt: '2023-06-01T10:00:00Z', status: 'active', isAdmin: false, email: 'david6@example.com' },
  { id: 7, name: 'Eva Garcia 7', age: 27, createdAt: '2023-07-01T10:00:00Z', status: 'active', isAdmin: true, email: 'eva7@example.com' },
  { id: 8, name: 'Frank Miller 8', age: 31, createdAt: '2023-08-01T10:00:00Z', status: 'inactive', isAdmin: false, email: 'frank8@example.com' },
];

// Example 1: Static Data Approach
const StaticDataExample = () => (
  <div style={{ marginBottom: '2rem' }}>
    <h2>Example 1: Static Data</h2>
    <CrudTableExperimental<User>
      title="User Management (Static Data)"
      rowKey="id"
      defaultPageSize={5}
      enableBulkOperations={true}
      hookConfig={{
        staticData: mockUsers,
        optimisticUpdates: true,
        onSuccess: (operation, data) => {
          console.log(`${operation} completed:`, data);
        },
        onError: (operation, error) => {
          console.error(`${operation} failed:`, error);
        },
      }}
      customActions={(record, actions) => [
        <Button
          key="custom"
          type="link"
          size="small"
          onClick={() => {
            console.log('Custom action for:', record);
          }}
        >
          Custom
        </Button>
      ]}
      columns={[
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
      ]}
    />
  </div>
);

// Example 2: API-based Approach
const ApiBasedExample = () => (
  <div style={{ marginBottom: '2rem' }}>
    <h2>Example 2: API Integration</h2>
    <CrudTableExperimental<User>
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
              data: Array.isArray(data) ? data.slice(0, 5) : [data], // Limit to 5 for demo
              total: Array.isArray(data) ? Math.min(data.length, 5) : 1,
              success: true,
            }),
            request: (data) => ({
              ...data,
              // Transform data before sending to API
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
        },
        {
          dataIndex: 'website',
          title: 'Website',
          fieldType: 'string',
        },
      ]}
    />
  </div>
);

// Example 3: Custom Operations Approach
const CustomOperationsExample = () => (
  <div style={{ marginBottom: '2rem' }}>
    <h2>Example 3: Custom Operations</h2>
    <CrudTableExperimental<User>
      title="User Management (Custom Operations)"
      rowKey="id"
      defaultPageSize={5}
      hookConfig={{
        operations: {
          getList: async (params) => {
            console.log('Custom getList called with:', params);
            // Custom logic here - could be IndexedDB, localStorage, etc.
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

            // Custom create logic (e.g., save to IndexedDB)
            return newUser;
          },
          update: async (id, data) => {
            console.log('Custom update called:', id, data);
            // Custom update logic
            return { id, ...data } as User;
          },
          delete: async (id) => {
            console.log('Custom delete called:', id);
            // Custom delete logic
          },
        },
        enableCache: true,
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
          customRender: (value, record) => (
            <span style={{ color: record.isAdmin ? 'blue' : 'gray' }}>
              {record.isAdmin ? '👑 Admin' : '👤 User'}
            </span>
          ),
          searchable: false,
          fieldEditable: false,
        },
      ]}
    />
  </div>
);

// Example 4: Old implmentation (for reference)
interface User {
  id: number;
  name: string;
  age: number;
  createdAt: string;
  status: 'active' | 'inactive';
  isAdmin: boolean;
}

const data: User[] = [
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
  // @ts-ignore
  static async getList(params: any): Promise<{ data: User[]; total: number }> {
    // todo
    return {
      data,
      total: data.length,
    }
  }

  static async create(data: Partial<User>) {
    // todo
    return data as User;
  }

  static async update(id: number, data: Partial<User>) {
    // todo
    return { id, ...data } as User;
  }

  // @ts-ignore
  static async delete(id: number) {
    // todo
  }
}

const OldUserTableExample = () => (
  <div style={{ marginBottom: '2rem' }}>
    <h2>Example 4: User Management(Old Implementation)</h2>
    <CrudTableLazy<User>
      title="User Management(Old Implementation)"
      rowKey="id"
      // defaultPageSize={10}
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
          dataIndex: 'age2',
          title: 'Age2',
          fieldType: 'number',
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
    <div style={{ padding: '2rem' }}>
      <h1>Enhanced CRUD Table Examples</h1>
      <p>This demonstrates the new hook-based approach with three different data source strategies:</p>
      <StaticDataExample />
      <ApiBasedExample />
      <CustomOperationsExample />
      <OldUserTableExample />
    </div>
  </ConfigProvider>
);

export default App;
