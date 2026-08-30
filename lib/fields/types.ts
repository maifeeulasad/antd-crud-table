import type { FieldType } from './registry';

/** One selectable value for an `enum` column. */
export interface EnumOption {
  /** Label shown in the cell and in the select control. */
  text: string;
  /** antd Tag colour used when rendering the cell. */
  color?: string;
}

/**
 * The slice of a column definition the field registry reads.
 *
 * Structural rather than generic on purpose: the registry dispatches across
 * twenty field types with unrelated value shapes, so a single definition
 * cannot be parameterised over any one record type. `unknown` here is the
 * strict choice, not a lax one - it forces every renderer to narrow before
 * using a value, which `any` would not.
 */
export interface FieldColumn {
  /** The record property this column reads. */
  dataIndex: PropertyKey;
  /** Column header, also used as the form label. */
  title: string;
  /** Which registry entry renders and edits this column. */
  fieldType?: FieldType;
  /** Selectable values, for `enum` columns. */
  enumOptions?: Record<string, EnumOption>;
  /** Cell renderer for `custom` columns. */
  customRender?: (value: unknown, record: Record<PropertyKey, unknown>) => React.ReactNode;
}
