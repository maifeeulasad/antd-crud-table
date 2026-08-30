import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from 'antd';

import CrudTable from '../lib/CrudTable';
import type { CrudColumn } from '../lib/CrudTable';
import type { CrudDataSource } from '../lib/core';

interface Task {
  id: number;
  title: string;
  done: boolean;
  priority: string;
}

const tasks: Task[] = Array.from({ length: 12 }, (_, i) => ({
  id: i + 1,
  title: `Task ${i + 1}`,
  done: i % 2 === 0,
  priority: ['low', 'medium', 'high'][i % 3],
}));

const columns: CrudColumn<Task>[] = [
  { dataIndex: 'title', title: 'Title', fieldType: 'string', formConfig: { required: true } },
  { dataIndex: 'done', title: 'Done', fieldType: 'boolean' },
  {
    dataIndex: 'priority',
    title: 'Priority',
    fieldType: 'enum',
    enumOptions: {
      low: { text: 'Low', color: 'blue' },
      medium: { text: 'Medium', color: 'orange' },
      high: { text: 'High', color: 'red' },
    },
  },
];

const meta = {
  title: 'Table options',
  component: CrudTable,
  parameters: {
    docs: {
      description: {
        component: 'Toolbar flags, custom row actions, export scope and error handling.',
      },
    },
  },
} satisfies Meta<typeof CrudTable>;

export default meta;
type Story = StoryObj<typeof meta>;

const table = (props: Partial<Parameters<typeof CrudTable<Task, 'id'>>[0]>) => (
  <CrudTable<Task, 'id'>
    title="Tasks"
    rowKey="id"
    columns={columns}
    defaultPageSize={5}
    hookConfig={{ staticData: tasks }}
    {...props}
  />
);

export const Defaults: Story = {
  name: 'Defaults',
  render: () => table({}),
};

export const BulkOperations: Story = {
  name: 'Bulk operations',
  render: () => table({ enableBulkOperations: true }),
};

export const WithoutColumnSettings: Story = {
  name: 'Column settings disabled',
  render: () => table({ enableColumnSettings: false }),
};

export const WithoutExport: Story = {
  name: 'Export disabled',
  render: () => table({ enableExport: false }),
};

export const PageScopedExport: Story = {
  name: 'Export scoped to the visible page',
  render: () => table({ exportScope: 'page' }),
};

export const CustomActions: Story = {
  name: 'Custom row actions',
  render: () =>
    table({
      customActions: (record, actions) => [
        <Button
          key="toggle"
          type="link"
          size="small"
          onClick={() => void actions.update(record.id, { done: !record.done })}
        >
          {record.done ? 'Reopen' : 'Complete'}
        </Button>,
      ],
    }),
};

export const ReadOnlyColumns: Story = {
  name: 'Non-editable and non-searchable columns',
  render: () =>
    table({
      columns: [
        { dataIndex: 'title', title: 'Title', fieldType: 'string' },
        // Visible in the table, fixed in the form.
        { dataIndex: 'priority', title: 'Priority (read-only)', fieldType: 'string', fieldEditable: false },
        { dataIndex: 'done', title: 'Done (not searchable)', fieldType: 'boolean', searchable: false },
      ],
    }),
};

export const FailingSource: Story = {
  name: 'Failing data source',
  render: () => {
    const failing: CrudDataSource<Task, 'id'> = {
      list: async () => {
        throw new Error('The backend is unavailable');
      },
      create: async () => tasks[0],
      update: async () => tasks[0],
      remove: async () => undefined,
    };
    return table({
      hookConfig: {
        dataSource: failing,
        onError: (operation, error) => console.error(operation, error.message),
      },
    });
  },
};
