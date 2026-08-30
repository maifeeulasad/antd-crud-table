import './../App.css';
import CrudTableLazy from '../../lib/CrudTableLazy';

interface User {
  id: number;
  name: string;
  email?: string;
  phone?: string;
  website?: string;
}

const ApiBasedExample = () => (
  <div style={{ marginBottom: '2rem', border: '1px solid #e8e8e8', padding: '1rem', borderRadius: '8px' }}>
    <h2>Example 2: API Integration</h2>
    <p style={{ color: '#666', marginBottom: '1rem' }}>Connect to any REST API with automatic request/response transformation.</p>
    <CrudTableLazy<User, 'id'>
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
            remove: '/users',
          },
          parseResponse: (payload) => {
            const rows = Array.isArray(payload) ? (payload as User[]) : [payload as User];
            return { items: rows.slice(0, 5), total: Math.min(rows.length, 5) };
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

export default ApiBasedExample;
