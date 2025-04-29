import './App.css'
import CrudTableLazy from '../lib/CrudTableLazy';
// import CrudTable from '../lib/CrudTable';
import { ConfigProvider } from 'antd';
import enUS from 'antd/locale/en_US';

interface User {
  id: number;
  name: string;
  age: number;
  createdAt: string;
  status: 'active' | 'inactive';
  isAdmin: boolean;
}

class UserService {
  // @ts-ignore
  static async getList(params: any): Promise<{ data: User[]; total: number }> {
    // todo
    return {
      data: [
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
      ],
      total: 2,
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

const UserTable = () => (
  <CrudTableLazy<User>
    title="User Management"
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
);

const App = () => <ConfigProvider locale={enUS}>
  <UserTable />
</ConfigProvider>

// eslint-disable-next-line import/no-default-export
export default App;
