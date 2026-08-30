import { PlusOutlined, EllipsisOutlined } from '@ant-design/icons';
import type { ProColumns } from '@ant-design/pro-components';
import { ProTable, ProConfigProvider, enUSIntl } from '@ant-design/pro-components';
import { Button, Dropdown, message, Modal, Form } from 'antd';
import type { FormRule } from 'antd';
import { useCallback, useMemo, useRef, useState } from 'react';
import type { SortOrder } from 'antd/es/table/interface';

import './CrudTable.css';
import { useCrudTable, toError } from './hooks/useCrudTable';
import type { CrudTableActions, UseCrudTableOptions } from './hooks/useCrudTable';
import { getFieldDefinition } from './fields/registry';
import type { FieldType } from './fields/registry';
import type { EnumOption, FieldColumn } from './fields/types';
import type { CrudFilters, CrudQuery, CrudSort } from './core';
import { exportData } from './utils/exportData';
import type { ExportFormat } from './utils/exportData';

/**
 * A column bound to one property of `T`.
 *
 * `K` ties `dataIndex` to a real key, so `customRender` and `transform`
 * receive that property's type rather than a widened one.
 */
export interface CrudColumnFor<T, K extends keyof T>
  extends Omit<ProColumns<T>, 'dataIndex' | 'title' | 'render'> {
  dataIndex: K;
  /** Also used as the form label, so a plain string rather than a ReactNode. */
  title: string;
  fieldType?: FieldType;
  enumOptions?: Record<string, EnumOption>;
  customRender?: (value: T[K], record: T) => React.ReactNode;
  formConfig?: {
    required?: boolean;
    component?: React.ReactNode;
    transform?: (value: T[K]) => T[K];
    rules?: FormRule[];
  };
  /** Editable in the create/edit form. Defaults to true. */
  fieldEditable?: boolean;
  /** Exposed in the search form. Defaults to true. */
  searchable?: boolean;
}

/**
 * A column for any one key of `T` - the type an array of columns holds.
 *
 * Distributing over `keyof T` is what keeps each column's callbacks bound to
 * its own property type. A single `CrudColumnFor<T, keyof T>` would widen
 * `customRender` and `transform` to accept a union of every property type,
 * losing exactly the precision this exists for.
 */
export type CrudColumn<T> = { [K in keyof T]-?: CrudColumnFor<T, K> }[keyof T];

export interface CrudTableConfig<T extends object, K extends keyof T> {
  columns: readonly CrudColumn<T>[];
  rowKey: K;
  title: string;
  defaultPageSize?: number;

  /** Selects and configures the data strategy. */
  hookConfig: UseCrudTableOptions<T, K>;

  enableBulkOperations?: boolean;
  /** Show ProTable's column visibility and density controls. Defaults to true. */
  enableColumnSettings?: boolean;
  enableExport?: boolean;
  /**
   * Whether export covers the whole filtered result set or just the rows on
   * screen. Defaults to `'all'`, falling back to `'page'` when the data source
   * cannot list without pagination.
   */
  exportScope?: 'all' | 'page';
  customActions?: (record: T, actions: CrudTableActions<T, K>) => React.ReactNode[];
}

/** ProTable hands search values back as an untyped bag; this is that bag. */
type RequestParams = Record<string, string | number | boolean | undefined> & {
  current?: number;
  pageSize?: number;
};

/**
 * Translate ProTable's request arguments into a typed CrudQuery.
 *
 * Column filters and search values are merged rather than one silently
 * overwriting the other: previously `params` was spread last, so a column that
 * was both filterable and searchable lost its filter without a trace.
 * Filters win where both carry a value for the same key, being the more
 * specific of the two.
 */
const toCrudQuery = <T extends object>(
  params: RequestParams,
  sort: Record<string, SortOrder>,
  filter: Record<string, (string | number | boolean)[] | null>,
  known: ReadonlySet<PropertyKey>,
): CrudQuery<T> => {
  const { current = 1, pageSize = 10, ...search } = params;

  const filters: Record<string, string | number | boolean> = {};

  for (const [field, value] of Object.entries(search)) {
    // Only keys that map to a declared column reach the data source; ProTable
    // adds bookkeeping entries that are not part of the record shape.
    if (known.has(field) && value !== undefined && value !== '') {
      filters[field] = value;
    }
  }

  for (const [field, values] of Object.entries(filter)) {
    if (values && values.length > 0 && known.has(field)) {
      filters[field] = values[0];
    }
  }

  const sorters: CrudSort<T>[] = Object.entries(sort)
    .filter(([, order]) => order === 'ascend' || order === 'descend')
    .map(([field, order]) => ({ field: field as keyof T, direction: order as 'ascend' | 'descend' }));

  return {
    page: current,
    pageSize,
    sort: sorters,
    filters: filters as CrudFilters<T>,
  };
};

const CrudTable = <T extends object, K extends keyof T>(config: CrudTableConfig<T, K>) => {
  const {
    columns,
    rowKey,
    title,
    defaultPageSize = 10,
    hookConfig,
    enableBulkOperations = false,
    enableColumnSettings = true,
    enableExport = true,
    exportScope = 'all',
    customActions,
  } = config;

  const crud = useCrudTable<T, K>(rowKey, {
    defaultPageSize,
    ...hookConfig,
    // The table renders from ProTable's own request pipeline and reloads
    // through actionRef. Letting the hook also re-read would issue two list
    // requests for every write.
    refreshAfterMutation: false,
  });

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<T | null>(null);
  const [selectedKeys, setSelectedKeys] = useState<React.Key[]>([]);
  const [form] = Form.useForm();

  /** The rows currently displayed, and the query that produced them. */
  const visibleRows = useRef<readonly T[]>([]);
  const lastQuery = useRef<CrudQuery<T>>({ page: 1, pageSize: defaultPageSize });
  const [exporting, setExporting] = useState(false);

  const knownFields = useMemo(
    () => new Set<PropertyKey>(columns.map((col) => col.dataIndex)),
    [columns],
  );

  /** Registry lookups need the structural shape, not the generic one. */
  const asFieldColumn = useCallback(
    (col: CrudColumn<T>): FieldColumn => ({
      dataIndex: col.dataIndex,
      title: col.title,
      fieldType: col.fieldType,
      enumOptions: col.enumOptions,
      customRender: col.customRender as FieldColumn['customRender'],
    }),
    [],
  );

  const openModal = useCallback(
    (record?: T) => {
      setEditing(record ?? null);
      if (!record) {
        form.resetFields();
        setModalOpen(true);
        return;
      }

      const values = { ...record } as Record<string, unknown>;
      for (const col of columns) {
        const field = col.dataIndex as string;
        const { toFormValue } = getFieldDefinition(col.fieldType);
        if (toFormValue && values[field] !== undefined) {
          try {
            values[field] = toFormValue(values[field]);
          } catch {
            // A value the control cannot represent is left as stored rather
            // than blanking the field and inviting an accidental overwrite.
          }
        }
      }
      form.setFieldsValue(values);
      setModalOpen(true);
    },
    [columns, form],
  );

  const handleDelete = useCallback(
    (id: T[K]) => {
      Modal.confirm({
        title: 'Are you sure?',
        content: 'This action cannot be undone.',
        okText: 'Yes, Delete',
        okType: 'danger',
        cancelText: 'Cancel',
        onOk: async () => {
          if (await crud.remove(id)) crud.actionRef.current?.reload();
        },
      });
    },
    [crud],
  );

  const enhancedColumns = useMemo<ProColumns<T>[]>(() => {
    const mapped = columns.map((col) => {
      const structural = asFieldColumn(col);
      const definition = getFieldDefinition(col.fieldType);
      const base: ProColumns<T> = {
        ...(col as ProColumns<T>),
        dataIndex: col.dataIndex as string,
        title: col.title,
        search: col.searchable !== false,
      };
      return { ...base, ...(definition.column?.(structural) as Partial<ProColumns<T>>) };
    });

    mapped.push({
      title: 'Actions',
      valueType: 'option',
      width: 200,
      render: (_, record: T) => [
        <Button key="edit" type="link" size="small" onClick={() => openModal(record)}>
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
        ...(customActions?.(record, crud) ?? []),
      ],
    });

    return mapped;
  }, [columns, asFieldColumn, openModal, handleDelete, rowKey, customActions, crud]);

  const handleRequest = async (
    params: RequestParams,
    sort: Record<string, SortOrder>,
    filter: Record<string, (string | number | boolean)[] | null>,
  ) => {
    try {
      const query = toCrudQuery<T>(params, sort, filter, knownFields);
      lastQuery.current = query;
      const page = await crud.dataSource.list(query);
      visibleRows.current = page.items;
      return { data: [...page.items], success: true, total: page.total };
    } catch (thrown) {
      // The list path is where failures matter most, and it used to swallow
      // the error entirely: onError never fired for the initial load, for
      // pagination, for sorting or for search.
      const error = toError(thrown);
      hookConfig.onError?.('list', error);
      message.error(error.message);
      return { data: [], success: false, total: 0 };
    }
  };

  const handleOk = async () => {
    let values: Record<string, unknown>;
    try {
      values = await form.validateFields();
    } catch {
      // Validation errors are already shown inline against each field.
      return;
    }

    const draft: Record<string, unknown> = { ...values };
    for (const col of columns) {
      const field = col.dataIndex as string;
      const { fromFormValue } = getFieldDefinition(col.fieldType);
      if (fromFormValue && values[field] !== undefined) {
        try {
          draft[field] = fromFormValue(values[field]);
        } catch (thrown) {
          hookConfig.onError?.(editing ? 'update' : 'create', toError(thrown));
          return;
        }
      }
      const transform = col.formConfig?.transform as ((value: unknown) => unknown) | undefined;
      if (transform) draft[field] = transform(draft[field]);
    }

    const saved = editing
      ? await crud.update(editing[rowKey], draft as Partial<T>)
      : await crud.create(draft as Partial<T>);

    if (saved !== null) {
      setModalOpen(false);
      crud.actionRef.current?.reload();
    }
  };

  const handleBulkDelete = () => {
    if (selectedKeys.length === 0) {
      message.warning('Please select items to delete');
      return;
    }

    Modal.confirm({
      title: `Delete ${selectedKeys.length} items?`,
      content: 'This action cannot be undone.',
      okText: 'Yes, Delete All',
      okType: 'danger',
      cancelText: 'Cancel',
      onOk: async () => {
        const outcomes = await Promise.all(
          selectedKeys.map(async (key) => ({
            key,
            ok: await crud.remove(key as T[K]),
          })),
        );

        // Previously the settled results were discarded, so a bulk delete
        // where half the rows were rejected still cleared the selection and
        // reported success. Failed rows stay selected so they can be retried.
        const failed = outcomes.filter((outcome) => !outcome.ok);
        setSelectedKeys(failed.map((outcome) => outcome.key));

        if (failed.length === 0) {
          message.success(`Deleted ${outcomes.length} items`);
        } else {
          message.error(
            `Deleted ${outcomes.length - failed.length} of ${outcomes.length}. ${failed.length} failed.`,
          );
        }

        crud.actionRef.current?.reload();
      },
    });
  };

  /**
   * Whether the whole result set can be exported.
   *
   * `listAll` is optional on the interface: a source over an unbounded remote
   * collection has no safe way to honour it, so the menu degrades to the
   * visible page and says so rather than silently exporting ten of a thousand
   * rows under a label implying everything.
   */
  const canExportAll = exportScope === 'all' && typeof crud.dataSource.listAll === 'function';

  const handleExport = async (format: ExportFormat) => {
    setExporting(true);
    try {
      const rows = canExportAll
        ? await crud.dataSource.listAll!({
            sort: lastQuery.current.sort,
            filters: lastQuery.current.filters,
          })
        : visibleRows.current;

      if (rows.length === 0) {
        message.warning('Nothing to export');
        return;
      }

      const exportColumns = columns
        // Passwords are masked in the table, so they must not leave in plaintext.
        .filter((col) => col.fieldType !== 'password')
        .map((col) => ({
          title: col.title,
          dataIndex: String(col.dataIndex),
          fieldType: col.fieldType,
          enumOptions: col.enumOptions,
        }));

      exportData({
        data: [...rows],
        columns: exportColumns,
        filename: title ? title.toLowerCase().replace(/\s+/g, '-') : 'export',
        format,
      });
    } catch (thrown) {
      const error = toError(thrown);
      hookConfig.onError?.('list', error);
      message.error(`Export failed: ${error.message}`);
    } finally {
      setExporting(false);
    }
  };

  // The label states the scope outright: "Export CSV" on page 3 of 500 writing
  // ten rows was correct-looking and wrong.
  const exportLabel = canExportAll ? 'Export all' : 'Export page';

  return (
    <ProConfigProvider needDeps intl={enUSIntl}>
      <ProTable<T>
        headerTitle={title}
        rowKey={rowKey as string}
        rowClassName={(_, index) => (index % 2 === 0 ? 'row-differentiator' : '')}
        actionRef={crud.actionRef}
        columns={enhancedColumns}
        request={handleRequest}
        search={{ labelWidth: 'auto' }}
        pagination={{ pageSize: defaultPageSize, showSizeChanger: true, showQuickJumper: true }}
        rowSelection={
          enableBulkOperations ? { selectedRowKeys: selectedKeys, onChange: setSelectedKeys } : undefined
        }
        toolBarRender={() => [
          <Button key="add" type="primary" icon={<PlusOutlined />} onClick={() => openModal()}>
            New
          </Button>,
          ...(enableBulkOperations && selectedKeys.length > 0
            ? [
                <Button key="bulk-delete" danger onClick={handleBulkDelete}>
                  Delete Selected ({selectedKeys.length})
                </Button>,
              ]
            : []),
          <Dropdown
            key="menu"
            menu={{
              items: [
                ...(enableExport
                  ? [
                      {
                        key: 'export-csv',
                        label: `${exportLabel} as CSV`,
                        disabled: exporting,
                        onClick: () => void handleExport('csv'),
                      },
                      {
                        key: 'export-json',
                        label: `${exportLabel} as JSON`,
                        disabled: exporting,
                        onClick: () => void handleExport('json'),
                      },
                      {
                        key: 'export-excel',
                        label: `${exportLabel} as Excel`,
                        disabled: exporting,
                        onClick: () => void handleExport('xlsx'),
                      },
                      { type: 'divider' as const },
                    ]
                  : []),
                { key: 'refresh', label: 'Refresh', onClick: () => crud.actionRef.current?.reload() },
              ],
            }}
          >
            <Button>
              <EllipsisOutlined />
            </Button>
          </Dropdown>,
        ]}
        options={{
          setting: enableColumnSettings ? { listsHeight: 400 } : false,
          density: enableColumnSettings,
          reload: true,
        }}
        dateFormatter="string"
      />

      <Modal
        title={editing ? 'Edit Item' : 'Create Item'}
        open={modalOpen}
        onOk={handleOk}
        onCancel={() => setModalOpen(false)}
        // ProConfigProvider's intl localises ProTable's own chrome but not
        // plain antd components, so without these the footer falls back to
        // antd's default locale and renders Chinese buttons. Stated
        // explicitly, matching the Modal.confirm calls and every other
        // hardcoded string in this component.
        okText="OK"
        cancelText="Cancel"
        destroyOnHidden
        width={600}
      >
        <Form form={form} layout="vertical">
          {columns.map((col) => {
            const name = col.dataIndex as string;
            const disabled = !(col.fieldEditable ?? true);
            const definition = getFieldDefinition(col.fieldType);
            const structural = asFieldColumn(col);

            const userRules =
              col.formConfig?.rules ??
              (col.formConfig?.required
                ? [{ required: true, message: `${col.title} is required` }]
                : []);
            const rules: FormRule[] = [...(definition.rules?.(structural) ?? []), ...userRules];

            const control = col.formConfig?.component ?? definition.formControl(structural, disabled);
            if (!control) return null;

            return (
              <Form.Item
                key={name}
                name={name}
                label={col.title}
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
