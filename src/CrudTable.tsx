import { PlusOutlined, EllipsisOutlined } from '@ant-design/icons';
import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { ProTable, ProConfigProvider } from '@ant-design/pro-components';
import { Button, Dropdown, Tag, message, Modal, Form, Input, InputNumber, Select, Switch, DatePicker } from 'antd';
import { useRef, useState } from 'react';
import type { SortOrder } from 'antd/es/table/interface';
import { format, parseISO, formatISO } from 'date-fns';
import dayjs from 'dayjs';

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
  const [modalVisible, setModalVisible] = useState(false);
  const [currentRecord, setCurrentRecord] = useState<Partial<T> | null>(null);
  const [form] = Form.useForm();

  let enhancedColumns: ProColumns<T>[] = (columns || []).map((col) => {
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
  enhancedColumns.push({
    title: 'Actions',
    valueType: 'option',
    render: (_, record: T) => [
      <Button key="edit" type="primary" onClick={() => openModal(record)}>
        Edit
      </Button>,
      <Button key="delete" type="primary" danger onClick={async () => {
        await service.delete(record[rowKey]);
        actionRef.current?.reload();
      }}>
        Delete
      </Button>,
    ],
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

  const openModal = (record?: Partial<T>) => {
    setCurrentRecord(record || null);
    if (record) {
      const values = { ...record };
      columns.forEach((col) => {
        const field = col.dataIndex as string;
        if (col.fieldType === 'date' && values[field]) {
          // @ts-ignore
          values[field] = dayjs(values[field]);
        }
      });
    form.setFieldsValue(values);
    } else {
        form.resetFields();
      }
      setModalVisible(true);
    };

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      const transformedValues = { ...values };

      // Handle any transformations like date formatting
      columns.forEach((col) => {
        const field = col.dataIndex as string;
        if (col.fieldType === 'date' && values[field]) {
          transformedValues[field] = formatISO(values[field]);
        }
        if (col.formConfig?.transform) {
          transformedValues[field] = col.formConfig.transform(values[field]);
        }
      });
      console.log('Transformed Values:', transformedValues);

      if (currentRecord && currentRecord[rowKey]) {
        await service.update(currentRecord[rowKey], transformedValues);
        message.success('Updated successfully');
      } else {
        await service.create(transformedValues);
        message.success('Created successfully');
      }

      setModalVisible(false);
      actionRef.current?.reload();
    } catch (error) {
      console.error(error);
      message.error('Submit failed');
    }
  };

  const handleCancel = () => {
    setModalVisible(false);
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
            openModal(row); // Open modal for editing inline
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
            onClick={() => openModal()}
          >
            New
          </Button>,
          <Dropdown
            key="menu"
            menu={{
              items: [
                { key: 'export', label: 'Export' },
                { key: 'refresh', label: 'Refresh', onClick: () => actionRef.current?.reload() },
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

      <Modal
        forceRender
        title={currentRecord ? 'Edit Item' : 'Create Item'}
        open={modalVisible}
        onOk={handleOk}
        onCancel={handleCancel}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          {columns.map((col) => {
            if (!col.dataIndex) return null;
            const name = col.dataIndex as string;
            const label = col.title as string;

            switch (col.fieldType) {
              case 'string':
                return (
                  <Form.Item
                    key={name}
                    name={name}
                    label={label}
                    rules={[{ required: col.formConfig?.required, message: `${label} is required` }]}
                  >
                    <Input />
                  </Form.Item>
                );
              case 'number':
                return (
                  <Form.Item
                    key={name}
                    name={name}
                    label={label}
                    rules={[{ required: col.formConfig?.required, message: `${label} is required` }]}
                  >
                    <InputNumber style={{ width: '100%' }} />
                  </Form.Item>
                );
              case 'date':
                return (
                  <Form.Item
                    key={name}
                    name={name}
                    label={label}
                    rules={[{ required: col.formConfig?.required, message: `${label} is required` }]}
                  >
                    <DatePicker style={{ width: '100%' }} showTime />
                  </Form.Item>
                );
              case 'boolean':
                return (
                  <Form.Item
                    key={name}
                    name={name}
                    label={label}
                    valuePropName="checked"
                  >
                    <Switch />
                  </Form.Item>
                );
              case 'enum':
                return (
                  <Form.Item
                    key={name}
                    name={name}
                    label={label}
                    rules={[{ required: col.formConfig?.required, message: `${label} is required` }]}
                  >
                    <Select options={Object.entries(col.enumOptions || {}).map(([value, option]) => ({
                      label: option.text,
                      value,
                    }))} />
                  </Form.Item>
                );
              default:
                return null;
            }
          })}
        </Form>
      </Modal>
    </ProConfigProvider>
  );
};

export { CrudTable };
