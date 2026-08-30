import type { FieldType } from './registry';

/** One selectable value for an `enum` column. */
export interface EnumOption {
  text: string;
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
  dataIndex: PropertyKey;
  title: string;
  fieldType?: FieldType;
  enumOptions?: Record<string, EnumOption>;
  customRender?: (value: unknown, record: Record<PropertyKey, unknown>) => React.ReactNode;
}
