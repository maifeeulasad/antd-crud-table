import { PlusOutlined, EllipsisOutlined } from '@ant-design/icons';
import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { ProTable, ProConfigProvider } from '@ant-design/pro-components';
import { Button, Dropdown, Tag, message } from 'antd';
import { useRef } from 'react';
import type { SortOrder } from 'antd/es/table/interface';
import { format, parseISO } from 'date-fns';

type DataType = Record<string, any>;
type FieldType = 'string' | 'number' | 'date' | 'boolean' | 'enum' | 'custom';

interface CrudColumn<T extends DataType> extends ProColumns<T> {
  fieldType?: FieldType;
  enumOptions?: Record<string, { text: string;[key: string]: any }>;
  customRender?: (value: any, record: T) => React.ReactNode;
  formConfig?: {
    required?: boolean;
    component?: React.ReactNode;
    transform?: (value: any) => any;
  };
}

interface CrudTableConfig<T extends DataType> {
  columns: CrudColumn<T>[];
  service: {
    getList: (params: any) => Promise<{ data: T[]; total: number }>;
    create: (data: Partial<T>) => Promise<T>;
    update: (id: any, data: Partial<T>) => Promise<T>;
    delete: (id: any) => Promise<void>;
  };
  rowKey: keyof T;
  title: string;
  defaultPageSize?: number;
}

const CrudTable = <T extends DataType>(config: CrudTableConfig<T>) => {
  const actionRef = useRef<ActionType>(null);
  const { columns, service, rowKey, title, defaultPageSize = 5 } = config;

  const enhancedColumns: ProColumns<T>[] = (columns || []).map((col) => {
    const baseColumn: ProColumns<T> = {
      ...col,
      dataIndex: col.dataIndex as string,
      title: col.title,
    };

    switch (col.fieldType) {
      case 'date':
        return {
          ...baseColumn,
          valueType: 'dateTime',
          render: (_, record) => (
            <span>
              {format(parseISO(record[col.dataIndex as string]), 'yyyy-MM-dd HH:mm')}
            </span>
          ),
        };
      case 'enum':
        return {
          ...baseColumn,
          valueType: 'select',
          valueEnum: col.enumOptions,
        };
      case 'number':
        return {
          ...baseColumn,
          valueType: 'digit',
        };
      case 'boolean':
        return {
          ...baseColumn,
          valueType: 'switch',
          render: (_, record) => (
            <Tag color={record[col.dataIndex as string] ? 'green' : 'red'}>
              {record[col.dataIndex as string] ? 'Yes' : 'No'}
            </Tag>
          ),
        };
      case 'custom':
        return {
          ...baseColumn,
          render: (_, record) => col.customRender?.(record[col.dataIndex as string], record),
        };
      default:
        return baseColumn;
    }
  });

  const handleRequest = async (
    params: Record<string, any>,
    sort: Record<string, SortOrder>,
    filter: Record<string, any>,
  ) => {
    try {
      const query = {
        ...params,
        sortBy: Object.keys(sort)[0],
        sortOrder: Object.values(sort)[0],
        ...filter,
      };
      const { data, total } = await service.getList(query);
      return { data, success: true, total };
    } catch (error) {
      message.error('Failed to fetch data');
      return { data: [], success: false, total: 0 };
    }
  };

  return (
    <ProConfigProvider needDeps>
      <ProTable<T>
        headerTitle={title}
        rowKey={rowKey as string}
        actionRef={actionRef}
        columns={enhancedColumns}
        request={handleRequest}
        editable={{
          type: 'multiple',
          onSave: async (key, row) => {
            await service.update(key, row);
            actionRef.current?.reload();
          },
          onDelete: async (key) => {
            await service.delete(key);
            actionRef.current?.reload();
          },
        }}
        search={{ labelWidth: 'auto' }}
        pagination={{ pageSize: defaultPageSize }}
        toolBarRender={() => [
          <Button
            key="add"
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              // todo: create logic here
              actionRef.current?.reload();
            }}
          >
            New
          </Button>,
          <Dropdown
            key="menu"
            menu={{
              items: [
                { key: 'export', label: 'Export' },
                { key: 'refresh', label: 'Refresh' },
              ],
            }}
          >
            <Button>
              <EllipsisOutlined />
            </Button>
          </Dropdown>,
        ]}
        options={{
          setting: { listsHeight: 400 },
          reload: () => actionRef.current?.reload(),
        }}
        dateFormatter="string"
      />
    </ProConfigProvider>
  );
};

export {CrudTable}
