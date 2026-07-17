import { Input, InputNumber, Select, Switch, DatePicker, Tag, Rate, Progress } from 'antd';
import type { ProColumns } from '@ant-design/pro-components';
import dayjs from 'dayjs';

/** Every column type CrudTable understands. */
export type FieldType =
  | 'string'
  | 'number'
  | 'date'
  | 'boolean'
  | 'enum'
  | 'custom'
  | 'textarea'
  | 'email'
  | 'url'
  | 'password'
  | 'money'
  | 'percent'
  | 'rating'
  | 'progress';

/** The slice of a CrudColumn a field-type definition may look at. */
export interface FieldColumn {
  dataIndex?: unknown;
  /** ProColumns allows ReactNode or a render function here, so stay loose. */
  title?: unknown;
  fieldType?: FieldType;
  enumOptions?: Record<string, { text: string; [key: string]: any }>;
  customRender?: (value: any, record: any) => React.ReactNode;
}

/**
 * A self-contained description of one field type: how it renders in the
 * table, which control edits it in the modal form, and how values are
 * converted between record shape and form shape. Adding a new column
 * type to CrudTable means adding exactly one entry here.
 */
export interface FieldTypeDefinition {
  /** Extra ProColumns props merged over the base column (valueType, render, ...). */
  column?: (col: FieldColumn) => Partial<ProColumns<any>>;
  /** The antd control used in the create/edit modal. Return null for "no form field". */
  formControl: (col: FieldColumn, disabled: boolean) => React.ReactNode | null;
  /** Convert a record value into what the form control expects. */
  toFormValue?: (value: any) => any;
  /** Convert the submitted form value back into the record shape. */
  fromFormValue?: (value: any) => any;
  /** Validation rules implied by the type itself (merged before user rules). */
  rules?: (col: FieldColumn) => any[];
  /** Form.Item valuePropName override (e.g. 'checked' for Switch). */
  valuePropName?: string;
}

const cellValue = (col: FieldColumn, record: Record<string, any>) =>
  record[col.dataIndex as string];

const DATE_TIME_DISPLAY = 'YYYY-MM-DD HH:mm';

export const fieldRegistry: Record<FieldType, FieldTypeDefinition> = {
  string: {
    formControl: (_col, disabled) => <Input disabled={disabled} />,
  },

  number: {
    column: (col) => ({
      valueType: 'digit',
      render: (_, record) => {
        const value = cellValue(col, record);
        return typeof value === 'number' ? value.toLocaleString() : value;
      },
    }),
    formControl: (_col, disabled) => (
      <InputNumber style={{ width: '100%' }} disabled={disabled} />
    ),
  },

  date: {
    column: (col) => ({
      valueType: 'dateTime',
      render: (_, record) => {
        const value = cellValue(col, record);
        if (!value) return '-';
        const parsed = dayjs(value);
        return <span>{parsed.isValid() ? parsed.format(DATE_TIME_DISPLAY) : String(value)}</span>;
      },
    }),
    formControl: (_col, disabled) => (
      <DatePicker style={{ width: '100%' }} showTime disabled={disabled} />
    ),
    toFormValue: (value) => (value ? dayjs(value) : value),
    fromFormValue: (value) =>
      dayjs.isDayjs(value) ? value.toISOString() : value,
  },

  boolean: {
    column: (col) => ({
      valueType: 'switch',
      render: (_, record) => (
        <Tag color={cellValue(col, record) ? 'green' : 'red'}>
          {cellValue(col, record) ? 'Yes' : 'No'}
        </Tag>
      ),
    }),
    formControl: (_col, disabled) => <Switch disabled={disabled} />,
    valuePropName: 'checked',
  },

  enum: {
    column: (col) => ({
      valueType: 'select',
      valueEnum: col.enumOptions,
      render: (_, record) => {
        const value = cellValue(col, record);
        const option = col.enumOptions?.[value];
        return option ? <Tag color={option.color}>{option.text}</Tag> : value;
      },
    }),
    formControl: (col, disabled) => (
      <Select
        disabled={disabled}
        placeholder={`Select ${String(col.title ?? '').toLowerCase()}`}
        options={Object.entries(col.enumOptions || {}).map(([value, option]) => ({
          label: option.text,
          value,
        }))}
      />
    ),
  },

  custom: {
    column: (col) => ({
      render: (_, record) => col.customRender?.(cellValue(col, record), record),
    }),
    // Custom columns bring their own control via formConfig.component
    // (handled before the registry lookup); otherwise they have no form field.
    formControl: () => null,
  },

  textarea: {
    column: () => ({ valueType: 'textarea', ellipsis: true }),
    formControl: (_col, disabled) => (
      <Input.TextArea rows={3} disabled={disabled} />
    ),
  },

  email: {
    column: (col) => ({
      render: (_, record) => {
        const value = cellValue(col, record);
        return value ? <a href={`mailto:${value}`}>{value}</a> : '-';
      },
    }),
    formControl: (_col, disabled) => <Input type="email" disabled={disabled} />,
    rules: () => [{ type: 'email', message: 'Please enter a valid email' }],
  },

  url: {
    column: (col) => ({
      render: (_, record) => {
        const value = cellValue(col, record);
        return value ? (
          <a href={value} target="_blank" rel="noopener noreferrer">
            {value}
          </a>
        ) : '-';
      },
    }),
    formControl: (_col, disabled) => <Input disabled={disabled} />,
    rules: () => [{ type: 'url', message: 'Please enter a valid URL' }],
  },

  password: {
    // Never show the value in the table, and keep it out of search by default
    column: (col) => ({
      search: false,
      render: (_, record) => (cellValue(col, record) ? '••••••••' : '-'),
    }),
    formControl: (_col, disabled) => <Input.Password disabled={disabled} />,
  },

  money: {
    // ProTable's money valueType formats via the active intl (enUSIntl here)
    column: () => ({ valueType: 'money' }),
    formControl: (_col, disabled) => (
      <InputNumber style={{ width: '100%' }} precision={2} min={0} disabled={disabled} />
    ),
  },

  percent: {
    column: () => ({ valueType: 'percent' }),
    formControl: (_col, disabled) => (
      <InputNumber
        style={{ width: '100%' }}
        min={0}
        max={100}
        addonAfter="%"
        disabled={disabled}
      />
    ),
  },

  rating: {
    column: (col) => ({
      search: false,
      render: (_, record) => (
        <Rate disabled allowHalf value={Number(cellValue(col, record)) || 0} />
      ),
    }),
    formControl: (_col, disabled) => <Rate allowHalf disabled={disabled} />,
  },

  progress: {
    column: (col) => ({
      search: false,
      render: (_, record) => (
        <Progress percent={Number(cellValue(col, record)) || 0} size="small" />
      ),
    }),
    formControl: (_col, disabled) => (
      <InputNumber style={{ width: '100%' }} min={0} max={100} disabled={disabled} />
    ),
  },
};

/** Look up a field type, falling back to `string` so every column gets a form control. */
export const getFieldDefinition = (fieldType?: FieldType): FieldTypeDefinition =>
  fieldRegistry[fieldType ?? 'string'] ?? fieldRegistry.string;
