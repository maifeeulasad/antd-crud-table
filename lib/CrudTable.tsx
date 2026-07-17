import { PlusOutlined, EllipsisOutlined } from '@ant-design/icons';
import type { ProColumns } from '@ant-design/pro-components';
import { ProTable, ProConfigProvider, enUSIntl } from '@ant-design/pro-components';
import { Button, Dropdown, message, Modal, Form } from 'antd';
import { useRef, useState } from 'react';
import type { SortOrder } from 'antd/es/table/interface';

import './CrudTable.css';
import { useCrudTable, type UseCrudTableConfig, type CrudTableActions } from './hooks/useCrudTable';
import { getFieldDefinition, type FieldType } from './fields/registry';
import { exportData, type ExportFormat } from './utils/exportData';

type DataType = Record<string, any>;

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

interface CrudTableConfig<T extends DataType> {
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

const CrudTable = <T extends DataType>(config: CrudTableConfig<T>) => {
  const { columns, rowKey, title, defaultPageSize = 10, hookConfig, enableBulkOperations = false, enableExport = true, customActions } = config;
  
    // Use the new hook
  const crudActions = useCrudTable(rowKey, {
    defaultPageSize,
    ...hookConfig
  });
  
  const [modalVisible, setModalVisible] = useState(false);
  const [currentRecord, setCurrentRecord] = useState<Partial<T> | null>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [form] = Form.useForm();
  // What the table currently shows (the latest request response), for export
  const visibleDataRef = useRef<T[]>([]);

  // Enhanced columns: base props + whatever the field-type registry adds
  const enhancedColumns: ProColumns<T>[] = columns.map((col) => {
    const baseColumn: ProColumns<T> = {
      ...col,
      dataIndex: col.dataIndex as string,
      title: col.title,
      search: col.searchable !== false, // Default to searchable
    };

    const definition = getFieldDefinition(col.fieldType);
    return {
      ...baseColumn,
      ...(definition.column?.(col) as Partial<ProColumns<T>> | undefined),
    };
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
        sortOrder: Object.values(sort)[0] ?? undefined,
        ...filter,
        ...params, // Include search parameters
      };
      
      // The hook handles the actual data fetching
      const { operations } = crudActions;
      if (operations.getList) {
        const response = await operations.getList(query);
        visibleDataRef.current = response.data ?? [];
        return {
          data: response.data,
          success: true,
          total: response.total
        };
      }

      // Fallback to current state
      visibleDataRef.current = crudActions.state.data;
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
      const values: Record<string, any> = { ...record };
      columns.forEach((col) => {
        const field = col.dataIndex as string;
        const toFormValue = getFieldDefinition(col.fieldType).toFormValue;
        if (toFormValue && values[field] !== undefined) {
          try {
            values[field] = toFormValue(values[field]);
          } catch {
            // Keep original value if conversion fails
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

      // Handle transformations: registry serialization first, then the
      // column's own transform on top
      columns.forEach((col) => {
        const field = col.dataIndex as string;
        const fromFormValue = getFieldDefinition(col.fieldType).fromFormValue;
        if (fromFormValue && values[field] !== undefined) {
          try {
            transformedValues[field] = fromFormValue(values[field]);
          } catch {
            // Keep original value if serialization fails
          }
        }
        if (col.formConfig?.transform) {
          transformedValues[field] = col.formConfig.transform(transformedValues[field]);
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

  const handleExport = (format: ExportFormat) => {
    const data = visibleDataRef.current;
    if (data.length === 0) {
      message.warning('Nothing to export');
      return;
    }

    // Password values never leave the table masked, so skip them entirely
    const exportColumns = columns
      .filter((col) => col.dataIndex && col.fieldType !== 'password')
      .map((col) => ({
        title: typeof col.title === 'string' ? col.title : String(col.dataIndex),
        dataIndex: String(col.dataIndex),
        fieldType: col.fieldType,
        enumOptions: col.enumOptions,
      }));

    const filename = title ? title.toLowerCase().replace(/\s+/g, '-') : 'export';
    exportData({ data, columns: exportColumns, filename, format });
  };

  const rowSelection = enableBulkOperations ? {
    selectedRowKeys,
    onChange: setSelectedRowKeys,
  } : undefined;

  return (
    <ProConfigProvider needDeps intl={enUSIntl}>
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
                ...(enableExport ? [
                  { key: 'export-csv', label: 'Export CSV', onClick: () => handleExport('csv') },
                  { key: 'export-json', label: 'Export JSON', onClick: () => handleExport('json') },
                  { key: 'export-excel', label: 'Export Excel', onClick: () => handleExport('xlsx') },
                  { type: 'divider' as const },
                ] : []),
                {
                  key: 'refresh',
                  label: 'Refresh',
                  onClick: () => crudActions.actionRef.current?.reload()
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
          reload: true,
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
            const definition = getFieldDefinition(col.fieldType);

            const userRules = col.formConfig?.rules || (col.formConfig?.required ? [
              { required: true, message: `${label} is required` }
            ] : []);
            const rules = [...(definition.rules?.(col) ?? []), ...userRules];

            // Custom component override
            const control = col.formConfig?.component
              ?? definition.formControl(col, fieldDisabled);
            if (!control) return null;

            return (
              <Form.Item
                key={name}
                name={name}
                label={label}
                rules={rules}
                valuePropName={definition.valuePropName}
              >
                {control}
              </Form.Item>
            );
          })}
        </Form>
      </Modal>
    </ProConfigProvider>
  );
};

export default CrudTable;
export type { CrudTableConfig, CrudColumn, DataType };