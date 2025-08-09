import { PlusOutlined, EllipsisOutlined } from '@ant-design/icons';
import type { ProColumns } from '@ant-design/pro-components';
import { ProTable, ProConfigProvider } from '@ant-design/pro-components';
import { Button, Dropdown, Tag, message, Modal, Form, Input, InputNumber, Select, Switch, DatePicker } from 'antd';
import { useState, useEffect } from 'react';
import type { SortOrder } from 'antd/es/table/interface';
import { format, parseISO, formatISO } from 'date-fns';
import dayjs from 'dayjs';

import './CrudTable.css';
import { useCrudTable, type UseCrudTableConfig, type CrudTableActions } from './hooks/useCrudTable';

type DataType = Record<string, any>;
type FieldType = 'string' | 'number' | 'date' | 'boolean' | 'enum' | 'custom';

interface CrudColumn<T extends DataType> extends ProColumns<T> {
  fieldType?: FieldType;
  enumOptions?: Record<string, { text: string; [key: string]: any }>;
  customRender?: (value: any, record: T) => React.ReactNode;
  formConfig?: {
    required?: boolean;
    component?: React.ReactNode;
    transform?: (value: any) => any;
    rules?: any[];
  };
  fieldEditable?: boolean;
  searchable?: boolean;
}

interface EnhancedCrudTableConfig<T extends DataType> {
  columns: CrudColumn<T>[];
  rowKey: keyof T;
  title: string;
  defaultPageSize?: number;
  
  // Hook configuration - choose one approach
  hookConfig: UseCrudTableConfig<T>;
  
  // Additional UI configuration
  enableBulkOperations?: boolean;
  enableColumnSettings?: boolean;
  enableExport?: boolean;
  customActions?: (record: T, actions: CrudTableActions<T>) => React.ReactNode[];
}

const CrudTableExperimental = <T extends DataType>(config: EnhancedCrudTableConfig<T>) => {
  const { columns, rowKey, title, defaultPageSize = 10, hookConfig, enableBulkOperations = false, customActions } = config;
  
  // Use the new hook
  const crudActions = useCrudTable(rowKey, {
    ...hookConfig,
    defaultPageSize,
  });
  
  const [modalVisible, setModalVisible] = useState(false);
  const [currentRecord, setCurrentRecord] = useState<Partial<T> | null>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [form] = Form.useForm();

  // Load data on mount
  useEffect(() => {
    crudActions.refresh();
  }, []);

  // Enhanced columns with better type handling
  const enhancedColumns: ProColumns<T>[] = columns.map((col) => {
    const baseColumn: ProColumns<T> = {
      ...col,
      dataIndex: col.dataIndex as string,
      title: col.title,
      search: col.searchable !== false, // Default to searchable
    };

    switch (col.fieldType) {
      case 'date':
        return {
          ...baseColumn,
          valueType: 'dateTime',
          render: (_, record) => {
            const value = record[col.dataIndex as string];
            if (!value) return '-';
            try {
              return (
                <span>
                  {format(parseISO(value), 'yyyy-MM-dd HH:mm')}
                </span>
              );
            } catch {
              return <span>{value}</span>;
            }
          },
        };
      case 'enum':
        return {
          ...baseColumn,
          valueType: 'select',
          valueEnum: col.enumOptions,
          render: (_, record) => {
            const value = record[col.dataIndex as string];
            const option = col.enumOptions?.[value];
            return option ? <Tag color={option.color}>{option.text}</Tag> : value;
          },
        };
      case 'number':
        return {
          ...baseColumn,
          valueType: 'digit',
          render: (_, record) => {
            const value = record[col.dataIndex as string];
            return typeof value === 'number' ? value.toLocaleString() : value;
          },
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

  // Add actions column
  enhancedColumns.push({
    title: 'Actions',
    valueType: 'option',
    width: 200,
    render: (_, record: T) => {
      const defaultActions = [
        <Button 
          key="edit" 
          type="link" 
          size="small"
          onClick={() => openModal(record)}
        >
          Edit
        </Button>,
        <Button 
          key="delete" 
          type="link" 
          size="small"
          danger 
          onClick={() => handleDelete(record[rowKey])}
        >
          Delete
        </Button>,
      ];

      const custom = customActions?.(record, crudActions) || [];
      return [...defaultActions, ...custom];
    },
  });

  const handleRequest = async (
    params: Record<string, any>,
    sort: Record<string, SortOrder>,
    filter: Record<string, any>,
  ) => {
    try {
      const query = {
        current: params.current,
        pageSize: params.pageSize,
        sortBy: Object.keys(sort)[0],
        sortOrder: Object.values(sort)[0],
        ...filter,
        ...params, // Include search parameters
      };
      
      // The hook handles the actual data fetching
      const operations = (crudActions as any).operations;
      if (operations?.getList) {
        const response = await operations.getList(query);
        return { 
          data: response.data, 
          success: true, 
          total: response.total 
        };
      }
      
      // Fallback to current state
      return { 
        data: crudActions.state.data, 
        success: true, 
        total: crudActions.state.total 
      };
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
          try {
            // @ts-expect-error partial data type date handling
            values[field] = dayjs(values[field]);
          } catch {
            // Keep original value if parsing fails
          }
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

      // Handle transformations
      columns.forEach((col) => {
        const field = col.dataIndex as string;
        if (col.fieldType === 'date' && values[field]) {
          try {
            transformedValues[field] = formatISO(values[field]);
          } catch {
            // Keep original value if formatting fails
          }
        }
        if (col.formConfig?.transform) {
          transformedValues[field] = col.formConfig.transform(values[field]);
        }
      });

      if (currentRecord && currentRecord[rowKey]) {
        await crudActions.update(currentRecord[rowKey], transformedValues);
      } else {
        await crudActions.create(transformedValues);
      }

      setModalVisible(false);
      crudActions.actionRef.current?.reload();
    } catch (error) {
      console.error('Form validation failed:', error);
    }
  };

  const handleDelete = async (id: any) => {
    Modal.confirm({
      title: 'Are you sure?',
      content: 'This action cannot be undone.',
      okText: 'Yes, Delete',
      okType: 'danger',
      cancelText: 'Cancel',
      onOk: async () => {
        const success = await crudActions.delete(id);
        if (success) {
          crudActions.actionRef.current?.reload();
        }
      },
    });
  };

  const handleBulkDelete = async () => {
    if (selectedRowKeys.length === 0) {
      message.warning('Please select items to delete');
      return;
    }

    Modal.confirm({
      title: `Delete ${selectedRowKeys.length} items?`,
      content: 'This action cannot be undone.',
      okText: 'Yes, Delete All',
      okType: 'danger',
      cancelText: 'Cancel',
      onOk: async () => {
        const promises = selectedRowKeys.map(id => crudActions.delete(id));
        await Promise.allSettled(promises);
        setSelectedRowKeys([]);
        crudActions.actionRef.current?.reload();
      },
    });
  };

  const rowSelection = enableBulkOperations ? {
    selectedRowKeys,
    onChange: setSelectedRowKeys,
  } : undefined;

  return (
    <ProConfigProvider needDeps>
      <ProTable<T>
        headerTitle={title}
        rowKey={rowKey as string}
        rowClassName={(_, index) => (index % 2 === 0 ? 'row-differentiator' : '')}
        actionRef={crudActions.actionRef}
        columns={enhancedColumns}
        request={handleRequest}
        search={{ labelWidth: 'auto' }}
        pagination={{ 
          pageSize: defaultPageSize,
          showSizeChanger: true,
          showQuickJumper: true,
        }}
        loading={crudActions.state.loading}
        rowSelection={rowSelection}
        toolBarRender={() => [
          <Button
            key="add"
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => openModal()}
          >
            New
          </Button>,
          ...(enableBulkOperations && selectedRowKeys.length > 0 ? [
            <Button
              key="bulk-delete"
              danger
              onClick={handleBulkDelete}
            >
              Delete Selected ({selectedRowKeys.length})
            </Button>
          ] : []),
          <Dropdown
            key="menu"
            menu={{
              items: [
                { 
                  key: 'export', 
                  label: 'Export',
                  disabled: true, // TODO: Implement export
                },
                { 
                  key: 'refresh', 
                  label: 'Refresh', 
                  onClick: () => crudActions.refresh() 
                },
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
          reload: () => crudActions.refresh(),
        }}
        dateFormatter="string"
      />

      <Modal
        title={currentRecord ? 'Edit Item' : 'Create Item'}
        open={modalVisible}
        onOk={handleOk}
        onCancel={() => setModalVisible(false)}
        destroyOnClose
        width={600}
      >
        <Form form={form} layout="vertical">
          {columns.map((col) => {
            if (!col.dataIndex) return null;
            const name = col.dataIndex as string;
            const label = col.title as string;
            const fieldDisabled = !(col.fieldEditable ?? true);
            const rules = col.formConfig?.rules || (col.formConfig?.required ? [
              { required: true, message: `${label} is required` }
            ] : []);

            // Custom component override
            if (col.formConfig?.component) {
              return (
                <Form.Item
                  key={name}
                  name={name}
                  label={label}
                  rules={rules}
                >
                  {col.formConfig.component}
                </Form.Item>
              );
            }

            switch (col.fieldType) {
              case 'string':
                return (
                  <Form.Item
                    key={name}
                    name={name}
                    label={label}
                    rules={rules}
                  >
                    <Input disabled={fieldDisabled} />
                  </Form.Item>
                );
              case 'number':
                return (
                  <Form.Item
                    key={name}
                    name={name}
                    label={label}
                    rules={rules}
                  >
                    <InputNumber style={{ width: '100%' }} disabled={fieldDisabled} />
                  </Form.Item>
                );
              case 'date':
                return (
                  <Form.Item
                    key={name}
                    name={name}
                    label={label}
                    rules={rules}
                  >
                    <DatePicker style={{ width: '100%' }} showTime disabled={fieldDisabled} />
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
                    <Switch disabled={fieldDisabled} />
                  </Form.Item>
                );
              case 'enum':
                return (
                  <Form.Item
                    key={name}
                    name={name}
                    label={label}
                    rules={rules}
                  >
                    <Select 
                      disabled={fieldDisabled}
                      placeholder={`Select ${label.toLowerCase()}`}
                      options={Object.entries(col.enumOptions || {}).map(([value, option]) => ({
                        label: option.text,
                        value,
                      }))} 
                    />
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

export default CrudTableExperimental;
export type { EnhancedCrudTableConfig, CrudColumn, DataType };
