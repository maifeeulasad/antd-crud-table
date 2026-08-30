import { Input, InputNumber, Select, Switch, DatePicker, TimePicker, Tag, Rate, Progress, Image, ColorPicker, Typography } from 'antd';
import type { ProColumns } from '@ant-design/pro-components';
import type { FormRule } from 'antd';
import dayjs from 'dayjs';

import type { EnumOption, FieldColumn } from './types';

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
  | 'progress'
  | 'time'
  | 'dateRange'
  | 'tags'
  | 'image'
  | 'color'
  | 'json';

/**
 * A self-contained description of one field type: how it renders in the
 * table, which control edits it in the modal form, and how values are
 * converted between record shape and form shape. Adding a new column
 * type to CrudTable means adding exactly one entry here.
 */
export interface FieldTypeDefinition {
  /** Extra ProColumns props merged over the base column (valueType, render, ...). */
  column?: (col: FieldColumn) => Partial<ProColumns<Record<PropertyKey, unknown>>>;
  /** The antd control used in the create/edit modal. Return null for "no form field". */
  formControl: (col: FieldColumn, disabled: boolean) => React.ReactNode | null;
  /** Convert a record value into what the form control expects. */
  toFormValue?: (value: unknown) => unknown;
  /** Convert the submitted form value back into the record shape. */
  fromFormValue?: (value: unknown) => unknown;
  /** Validation rules implied by the type itself (merged before user rules). */
  rules?: (col: FieldColumn) => FormRule[];
  /** Form.Item valuePropName override (e.g. 'checked' for Switch). */
  valuePropName?: string;
}

const cellValue = (col: FieldColumn, record: Record<PropertyKey, unknown>): unknown =>
  record[col.dataIndex as string];

/** True for values worth rendering; blank and nullish cells render as a dash. */
const isPresent = (value: unknown): boolean =>
  value !== null && value !== undefined && value !== '';

/** Narrow to a display string. Nullish becomes empty rather than "null". */
const asText = (value: unknown): string => (isPresent(value) ? String(value) : '');

/** Narrow to a finite number, falling back to 0 for values that cannot be one. */
const asNumber = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

/** Narrow to a key usable against `enumOptions`. */
const asKey = (value: unknown): string => String(value);

/**
 * Schemes safe to place in an `href` or `src`.
 *
 * `javascript:` is the reason this exists - React 18 warns about such an href
 * but still renders it, so a stored value could become a click-to-execute
 * link. `data:` is excluded for anchors (a data URL can carry HTML) and for
 * images is allowed only for raster types, since `image/svg+xml` can execute
 * script when rendered.
 */
const LINK_SCHEMES = ['http', 'https'] as const;
const MAIL_SCHEMES = ['http', 'https', 'mailto'] as const;

const SCHEME_PREFIX = /^([a-z][a-z0-9+.-]*):/i;
const RASTER_DATA_URL = /^data:image\/(png|jpe?g|gif|webp|avif|bmp|x-icon)[;,]/i;

/**
 * Whether a value is safe to use as a link or image target.
 *
 * A value with no scheme is relative and therefore safe. A value with a scheme
 * must name one on the allowlist. Whitespace and control characters are
 * stripped before the check because browsers ignore them inside URLs, so
 * `java\tscript:alert(1)` navigates exactly as `javascript:alert(1)` does.
 */
const hasSafeScheme = (value: string, allowed: readonly string[]): boolean => {
  // Matching control characters is the entire point: browsers strip them from
  // URLs, so they must be stripped here too or they hide the scheme.
  // eslint-disable-next-line no-control-regex
  const normalised = value.replace(/[\u0000-\u0020\u007F-\u009F]/g, '');
  const match = SCHEME_PREFIX.exec(normalised);
  if (!match) return true;
  return allowed.includes(match[1].toLowerCase());
};

/** Whether an image source is safe: an allowed scheme, or a raster data URL. */
const isSafeImageSource = (value: string): boolean => {
  // Matching control characters is the entire point: browsers strip them from
  // URLs, so they must be stripped here too or they hide the scheme.
  // eslint-disable-next-line no-control-regex
  const normalised = value.replace(/[\u0000-\u0020\u007F-\u009F]/g, '');
  if (RASTER_DATA_URL.test(normalised)) return true;
  return hasSafeScheme(value, LINK_SCHEMES);
};

const DATE_TIME_DISPLAY = 'YYYY-MM-DD HH:mm';
const DATE_DISPLAY = 'YYYY-MM-DD';
const TIME_VALUE = 'HH:mm:ss';

/**
 * Every field type, keyed by name.
 *
 * Adding a column type to CrudTable means adding one entry here; nothing else
 * dispatches on `fieldType`.
 */
export const fieldRegistry: Record<FieldType, FieldTypeDefinition> = {
  string: {
    formControl: (_col, disabled) => <Input disabled={disabled} />,
  },

  number: {
    column: (col) => ({
      valueType: 'digit',
      render: (_, record) => {
        const value = cellValue(col, record);
        return typeof value === 'number' ? value.toLocaleString() : asText(value);
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
        const parsed = dayjs(asText(value));
        return <span>{parsed.isValid() ? parsed.format(DATE_TIME_DISPLAY) : asText(value)}</span>;
      },
    }),
    formControl: (_col, disabled) => (
      <DatePicker style={{ width: '100%' }} showTime disabled={disabled} />
    ),
    toFormValue: (value) => (isPresent(value) ? dayjs(asText(value)) : value),
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
        const option = col.enumOptions?.[asKey(value)];
        return option ? <Tag color={option.color}>{option.text}</Tag> : asText(value);
      },
    }),
    formControl: (col, disabled) => (
      <Select
        disabled={disabled}
        placeholder={`Select ${col.title.toLowerCase()}`}
        options={Object.entries(col.enumOptions || {}).map(([value, option]) => ({
          label: option.text,
          value,
        }))}
      />
    ),
  },

  custom: {
    column: (col) => ({
      render: (_, record) => col.customRender?.(cellValue(col, record), record) ?? null,
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
        if (!isPresent(value)) return '-';
        const address = asText(value);
        if (!hasSafeScheme(address, MAIL_SCHEMES)) return <span>{address}</span>;
        return <a href={`mailto:${encodeURIComponent(address)}`}>{address}</a>;
      },
    }),
    formControl: (_col, disabled) => <Input type="email" disabled={disabled} />,
    rules: () => [{ type: 'email', message: 'Please enter a valid email' }],
  },

  url: {
    column: (col) => ({
      render: (_, record) => {
        const value = cellValue(col, record);
        if (!isPresent(value)) return '-';
        const href = asText(value);
        // An unsafe scheme renders as inert text: the value is still visible,
        // it simply is not clickable.
        if (!hasSafeScheme(href, LINK_SCHEMES)) return <span>{href}</span>;
        return (
          <a href={href} target="_blank" rel="noopener noreferrer">
            {href}
          </a>
        );
      },
    }),
    formControl: (_col, disabled) => <Input disabled={disabled} />,
    rules: () => [{ type: 'url', message: 'Please enter a valid URL' }],
  },

  password: {
    // Never show the value in the table, and keep it out of search by default
    column: (col) => ({
      search: false,
      render: (_, record) => (isPresent(cellValue(col, record)) ? '••••••••' : '-'),
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
        <Rate disabled allowHalf value={asNumber(cellValue(col, record))} />
      ),
    }),
    formControl: (_col, disabled) => <Rate allowHalf disabled={disabled} />,
  },

  progress: {
    column: (col) => ({
      search: false,
      render: (_, record) => (
        <Progress percent={asNumber(cellValue(col, record))} size="small" />
      ),
    }),
    formControl: (_col, disabled) => (
      <InputNumber style={{ width: '100%' }} min={0} max={100} disabled={disabled} />
    ),
  },

  // Stored as an 'HH:mm:ss' string
  time: {
    column: () => ({ valueType: 'time' }),
    formControl: (_col, disabled) => (
      <TimePicker style={{ width: '100%' }} disabled={disabled} />
    ),
    toFormValue: (value) => (isPresent(value) ? dayjs(asText(value), TIME_VALUE) : value),
    fromFormValue: (value) =>
      dayjs.isDayjs(value) ? value.format(TIME_VALUE) : value,
  },

  // Stored as a [startISO, endISO] tuple
  dateRange: {
    column: (col) => ({
      valueType: 'dateRange',
      render: (_, record) => {
        const value = cellValue(col, record);
        if (!Array.isArray(value) || value.length !== 2) return '-';
        const [start, end] = value.map((v) => dayjs(asText(v)));
        if (!start.isValid() || !end.isValid()) return asText(value);
        return `${start.format(DATE_DISPLAY)} ~ ${end.format(DATE_DISPLAY)}`;
      },
    }),
    formControl: (_col, disabled) => (
      <DatePicker.RangePicker style={{ width: '100%' }} disabled={disabled} />
    ),
    toFormValue: (value) =>
      Array.isArray(value) ? value.map((v) => (isPresent(v) ? dayjs(asText(v)) : v)) : value,
    fromFormValue: (value) =>
      Array.isArray(value)
        ? value.map((v) => (dayjs.isDayjs(v) ? v.toISOString() : v))
        : value,
  },

  // Stored as string[]
  tags: {
    column: (col) => ({
      render: (_, record) => {
        const value = cellValue(col, record);
        if (!Array.isArray(value) || value.length === 0) return '-';
        return (
          <>
            {value.map((tag) => (
              <Tag key={asText(tag)}>{asText(tag)}</Tag>
            ))}
          </>
        );
      },
    }),
    formControl: (_col, disabled) => (
      <Select mode="tags" open={false} suffixIcon={null} disabled={disabled} placeholder="Type and press enter" />
    ),
  },

  // Stored as an image URL
  image: {
    column: (col) => ({
      search: false,
      render: (_, record) => {
        const value = cellValue(col, record);
        if (!isPresent(value)) return '-';
        const src = asText(value);
        if (!isSafeImageSource(src)) return <span>{src}</span>;
        return <Image src={src} width={48} height={48} style={{ objectFit: 'cover' }} />;
      },
    }),
    formControl: (_col, disabled) => (
      <Input placeholder="https://..." disabled={disabled} />
    ),
    rules: () => [{ type: 'url', message: 'Please enter a valid image URL' }],
  },

  // Stored as a hex string
  color: {
    column: (col) => ({
      search: false,
      render: (_, record) => {
        const value = cellValue(col, record);
        if (!isPresent(value)) return '-';
        const hex = asText(value);
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <span
              style={{
                display: 'inline-block',
                width: 14,
                height: 14,
                borderRadius: 3,
                border: '1px solid rgba(0,0,0,0.15)',
                backgroundColor: hex,
              }}
            />
            {hex}
          </span>
        );
      },
    }),
    formControl: (_col, disabled) => <ColorPicker showText disabled={disabled} />,
    fromFormValue: (value) =>
      value && typeof value === 'object' && 'toHexString' in value
        ? (value as { toHexString: () => string }).toHexString()
        : value,
  },

  // Stored as a plain object/array
  json: {
    column: (col) => ({
      search: false,
      ellipsis: true,
      render: (_, record) => {
        const value = cellValue(col, record);
        if (value === undefined || value === null) return '-';
        return <Typography.Text code>{JSON.stringify(value)}</Typography.Text>;
      },
    }),
    formControl: (_col, disabled) => (
      <Input.TextArea rows={4} style={{ fontFamily: 'monospace' }} disabled={disabled} />
    ),
    toFormValue: (value) =>
      typeof value === 'string' ? value : JSON.stringify(value, null, 2),
    fromFormValue: (value) => (typeof value === 'string' && value.trim() !== '' ? JSON.parse(value) : value),
    rules: () => [
      {
        validator: async (_rule: unknown, value: unknown) => {
          if (value === undefined || value === null || value === '') return;
          if (typeof value !== 'string') return;
          try {
            JSON.parse(value);
          } catch {
            throw new Error('Please enter valid JSON');
          }
        },
      },
    ],
  },
};

/** Look up a field type, falling back to `string` so every column gets a form control. */
export const getFieldDefinition = (fieldType?: FieldType): FieldTypeDefinition =>
  fieldRegistry[fieldType ?? 'string'] ?? fieldRegistry.string;

export type { EnumOption, FieldColumn };
