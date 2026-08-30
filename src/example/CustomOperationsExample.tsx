import './../App.css';
import CrudTableLazy from '../../lib/CrudTableLazy';

interface User {
  id: number;
  name: string;
  age: number;
  status: 'active' | 'inactive';
  isAdmin: boolean;
  customField?: string;
}

const mockUsers: User[] = [
  { id: 1, name: 'Jane Smith 1', age: 30, status: 'active', isAdmin: true },
  { id: 2, name: 'John Doe 2', age: 25, status: 'inactive', isAdmin: false },
  { id: 3, name: 'Alice Johnson 3', age: 28, status: 'active', isAdmin: false },
  { id: 4, name: 'Bob Wilson 4', age: 35, status: 'active', isAdmin: true },
  { id: 5, name: 'Carol Brown 5', age: 32, status: 'inactive', isAdmin: false },
  { id: 6, name: 'David Davis 6', age: 29, status: 'active', isAdmin: false },
  { id: 7, name: 'Eva Garcia 7', age: 27, status: 'active', isAdmin: true },
  { id: 8, name: 'Frank Miller 8', age: 31, status: 'inactive', isAdmin: false },
];

const CustomOperationsExample = () => (
  <div style={{ marginBottom: '2rem', border: '1px solid #e8e8e8', padding: '1rem', borderRadius: '8px' }}>
    <h2>Example 3: Custom Operations (IndexedDB, GraphQL, etc.)</h2>
    <p style={{ color: '#666', marginBottom: '1rem' }}>Full control with custom CRUD operations for any data source.</p>
    <CrudTableLazy<User, 'id'>
      title="User Management (Custom Operations)"
      rowKey="id"
      defaultPageSize={5}
      hookConfig={{
        operations: {
          list: async (query) => {
            const needle = query.filters?.name;
            const matched = needle
              ? mockUsers.filter((user) =>
                  user.name.toLowerCase().includes(String(needle).toLowerCase()),
                )
              : mockUsers;
            return { items: matched.slice(0, query.pageSize), total: matched.length };
          },
          create: async (draft) => ({ id: Date.now(), ...draft }) as User,
          update: async (id, draft) => ({ ...draft, id }) as User,
          remove: async () => undefined,
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

export default CustomOperationsExample;
