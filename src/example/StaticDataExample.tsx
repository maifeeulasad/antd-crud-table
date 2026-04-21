import './../App.css';
import { message, Button } from 'antd';
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

const StaticDataExample = () => (
  <div style={{ marginBottom: '2rem', border: '1px solid #e8e8e8', padding: '1rem', borderRadius: '8px' }}>
    <h2>Example 1: Static Data (In-Memory)</h2>
    <p style={{ color: '#666', marginBottom: '1rem' }}>Data resets on page refresh. Perfect for demos and prototypes.</p>
    <CrudTableLazy<User>
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

export default StaticDataExample;
