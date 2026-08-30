import type { Meta, StoryObj } from '@storybook/react-vite';

import CrudTable from '../lib/CrudTable';
import type { CrudColumn } from '../lib/CrudTable';
import { LocalStorageDataSource, RestDataSource, StaticDataSource } from '../lib/core';
import type { CrudDataSource, CrudPage } from '../lib/core';

interface User {
  id: number;
  name: string;
  email: string;
  status: string;
}

const users: User[] = Array.from({ length: 23 }, (_, i) => ({
  id: i + 1,
  name: `Person ${i + 1}`,
  email: `person${i + 1}@example.com`,
  status: i % 3 === 0 ? 'inactive' : 'active',
}));

const columns: CrudColumn<User>[] = [
  { dataIndex: 'name', title: 'Name', fieldType: 'string', formConfig: { required: true } },
  { dataIndex: 'email', title: 'Email', fieldType: 'email' },
  {
    dataIndex: 'status',
    title: 'Status',
    fieldType: 'enum',
    enumOptions: { active: { text: 'Active', color: 'green' }, inactive: { text: 'Inactive', color: 'red' } },
  },
];

/** Answers from an in-memory fixture after a delay, standing in for a network. */
const fakeApi = (): typeof fetch => {
  const store = new StaticDataSource<User, 'id'>(users, 'id');
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), 'http://storybook.local');
    await new Promise((resolve) => setTimeout(resolve, 400));

    if (!init?.method || init.method === 'GET') {
      const page: CrudPage<User> = await store.list({
        page: Number(url.searchParams.get('current') ?? 1),
        pageSize: Number(url.searchParams.get('pageSize') ?? 10),
      });
      return new Response(JSON.stringify({ data: page.items, total: page.total }), { status: 200 });
    }
    return new Response(JSON.stringify(users[0]), { status: 200 });
  }) as typeof fetch;
};

const meta = {
  title: 'Data strategies',
  component: CrudTable,
  parameters: {
    docs: {
      description: {
        component:
          'The same table over each data strategy. Every one implements CrudDataSource, ' +
          'so the columns and behaviour are identical and only the wiring differs.',
      },
    },
  },
} satisfies Meta<typeof CrudTable>;

export default meta;
type Story = StoryObj<typeof meta>;

export const StaticData: Story = {
  name: 'Static fixture',
  render: () => (
    <CrudTable<User, 'id'>
      title="Users (static)"
      rowKey="id"
      columns={columns}
      defaultPageSize={5}
      enableBulkOperations
      hookConfig={{ staticData: users }}
    />
  ),
};

export const LocalStorage: Story = {
  name: 'localStorage (persists across reloads)',
  render: () => (
    <CrudTable<User, 'id'>
      title="Users (localStorage)"
      rowKey="id"
      columns={columns}
      defaultPageSize={5}
      hookConfig={{ storageKey: 'storybook-users', initialData: users.slice(0, 8) }}
    />
  ),
};

export const Rest: Story = {
  name: 'REST (simulated latency)',
  render: () => (
    <CrudTable<User, 'id'>
      title="Users (REST)"
      rowKey="id"
      columns={columns}
      defaultPageSize={5}
      hookConfig={{
        api: {
          baseUrl: '/api',
          endpoints: { list: '/users', create: '/users', update: '/users', remove: '/users' },
          fetchImpl: fakeApi(),
        },
      }}
    />
  ),
};

export const CustomOperations: Story = {
  name: 'Custom operations (read-only)',
  render: () => (
    <CrudTable<User, 'id'>
      title="Users (read-only source)"
      rowKey="id"
      columns={columns}
      defaultPageSize={5}
      hookConfig={{
        // Only `list` is supplied; the write paths report which operation is
        // missing rather than failing on undefined.
        operations: {
          list: async (query) => ({
            items: users.slice((query.page - 1) * query.pageSize, query.page * query.pageSize),
            total: users.length,
          }),
        },
      }}
    />
  ),
};

export const ConsumerOwnedSource: Story = {
  name: 'Consumer-owned data source',
  render: () => {
    const source: CrudDataSource<User, 'id'> = new LocalStorageDataSource<User, 'id'>(
      'storybook-owned',
      'id',
      users.slice(0, 5),
    );
    return (
      <CrudTable<User, 'id'>
        title="Users (injected source)"
        rowKey="id"
        columns={columns}
        defaultPageSize={5}
        hookConfig={{ dataSource: source }}
      />
    );
  },
};

export const UuidKeys: Story = {
  name: 'UUID row keys',
  render: () => {
    interface Doc { uuid: string; title: string }
    const source = new StaticDataSource<Doc, 'uuid'>(
      [{ uuid: 'a3f9-1111', title: 'Existing document' }],
      'uuid',
    );
    return (
      <CrudTable<Doc, 'uuid'>
        title="Documents (string keys)"
        rowKey="uuid"
        columns={[{ dataIndex: 'title', title: 'Title', fieldType: 'string' }]}
        hookConfig={{ dataSource: source }}
      />
    );
  },
};

export const RestWithRenamedParams: Story = {
  name: 'REST with a different dialect',
  render: () => {
    const source = new RestDataSource<User, 'id'>({
      baseUrl: '/api',
      endpoints: { list: '/users', create: '/users', update: '/users', remove: '/users' },
      paramNames: { page: 'page', pageSize: 'limit', sortBy: 'order_by', sortOrder: 'direction' },
      methods: { update: 'PATCH' },
      fetchImpl: fakeApi(),
    });
    return (
      <CrudTable<User, 'id'>
        title="Users (page/limit, PATCH)"
        rowKey="id"
        columns={columns}
        defaultPageSize={5}
        hookConfig={{ dataSource: source }}
      />
    );
  },
};
