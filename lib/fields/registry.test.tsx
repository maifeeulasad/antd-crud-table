import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { isValidElement } from 'react';
import type { ReactNode } from 'react';
import dayjs from 'dayjs';

import { fieldRegistry, getFieldDefinition } from './registry';
import type { FieldType } from './registry';
import type { FieldColumn } from './types';

const ALL_TYPES = Object.keys(fieldRegistry) as FieldType[];

const column = (overrides: Partial<FieldColumn> = {}): FieldColumn => ({
  dataIndex: 'value',
  title: 'Value',
  ...overrides,
});

/** Invoke a column's render with a record, ignoring ProTable's extra arguments. */
const renderCell = (fieldType: FieldType, value: unknown, col = column({ fieldType })): ReactNode => {
  const definition = getFieldDefinition(fieldType);
  const props = definition.column?.(col);
  if (!props?.render) return null;
  const render = props.render as (
    dom: ReactNode,
    record: Record<PropertyKey, unknown>,
  ) => ReactNode;
  return render(null, { value });
};

const textOf = (node: ReactNode): string => {
  const { container } = render(<>{node}</>);
  return container.textContent ?? '';
};

describe('getFieldDefinition', () => {
  it('falls back to string for an undefined type', () => {
    expect(getFieldDefinition(undefined)).toBe(fieldRegistry.string);
  });

  it('falls back to string for an unknown type', () => {
    expect(getFieldDefinition('not-a-type' as FieldType)).toBe(fieldRegistry.string);
  });

  it('returns the matching definition for every declared type', () => {
    for (const type of ALL_TYPES) {
      expect(getFieldDefinition(type)).toBe(fieldRegistry[type]);
    }
  });
});

describe('every field type', () => {
  it.each(ALL_TYPES)('%s exposes a form control (or an explicit null)', (type) => {
    const control = fieldRegistry[type].formControl(column({ fieldType: type }), false);
    // `custom` deliberately has no control: it is supplied via formConfig.
    if (type === 'custom') {
      expect(control).toBeNull();
    } else {
      expect(isValidElement(control)).toBe(true);
    }
  });

  it.each(ALL_TYPES)('%s passes the disabled flag through to its control', (type) => {
    const control = fieldRegistry[type].formControl(column({ fieldType: type }), true);
    if (control === null) return;
    expect((control as { props: { disabled?: boolean } }).props.disabled).toBe(true);
  });
});

describe('value round-trips', () => {
  // Each case goes record value -> form value -> record value, which is the
  // path an edit actually takes: prefill the modal, then submit it.
  const cases: Array<{ type: FieldType; stored: unknown; expected?: unknown }> = [
    { type: 'date', stored: '2024-03-05T10:30:00.000Z' },
    { type: 'time', stored: '14:25:00' },
    { type: 'dateRange', stored: ['2024-01-01T00:00:00.000Z', '2024-02-01T00:00:00.000Z'] },
    { type: 'json', stored: { a: 1, b: [2, 3] } },
  ];

  it.each(cases)('$type survives a round-trip', ({ type, stored }) => {
    const definition = getFieldDefinition(type);
    const formValue = definition.toFormValue?.(stored) ?? stored;
    const restored = definition.fromFormValue?.(formValue) ?? formValue;

    expect(restored).toEqual(stored);
  });

  it('date converts to a dayjs instance for the picker', () => {
    const formValue = getFieldDefinition('date').toFormValue?.('2024-03-05T10:30:00.000Z');
    expect(dayjs.isDayjs(formValue)).toBe(true);
  });

  it('json presents stored objects as formatted text', () => {
    const formValue = getFieldDefinition('json').toFormValue?.({ a: 1 });
    expect(formValue).toBe('{\n  "a": 1\n}');
  });

  it('json leaves an unparseable string alone rather than throwing', () => {
    expect(getFieldDefinition('json').fromFormValue?.('   ')).toBe('   ');
  });

  it('color serialises a picker object to a hex string', () => {
    const picked = { toHexString: () => '#ff0000' };
    expect(getFieldDefinition('color').fromFormValue?.(picked)).toBe('#ff0000');
  });

  it('leaves nullish values untouched rather than inventing a date', () => {
    expect(getFieldDefinition('date').toFormValue?.(null)).toBeNull();
    expect(getFieldDefinition('time').toFormValue?.(undefined)).toBeUndefined();
  });
});

describe('cell rendering', () => {
  it('number renders with locale grouping', () => {
    expect(textOf(renderCell('number', 1234567))).toBe((1234567).toLocaleString());
  });

  it('number renders a non-numeric value as text rather than NaN', () => {
    expect(textOf(renderCell('number', 'n/a'))).toBe('n/a');
  });

  it('boolean renders Yes and No', () => {
    expect(textOf(renderCell('boolean', true))).toBe('Yes');
    expect(textOf(renderCell('boolean', false))).toBe('No');
  });

  it('date renders a formatted timestamp and a dash when absent', () => {
    expect(textOf(renderCell('date', '2024-03-05T10:30:00Z'))).toMatch(/^2024-03-05 \d{2}:\d{2}$/);
    expect(textOf(renderCell('date', null))).toBe('-');
  });

  it('date falls back to the raw value when unparseable', () => {
    expect(textOf(renderCell('date', 'not a date'))).toBe('not a date');
  });

  it('enum renders the option label, falling back to the raw value', () => {
    const col = column({
      fieldType: 'enum',
      enumOptions: { active: { text: 'Active', color: 'green' } },
    });
    expect(textOf(renderCell('enum', 'active', col))).toBe('Active');
    expect(textOf(renderCell('enum', 'mystery', col))).toBe('mystery');
  });

  it('password never renders the stored value', () => {
    const output = textOf(renderCell('password', 'hunter2'));
    expect(output).not.toContain('hunter2');
    expect(output).toBe('••••••••');
    expect(textOf(renderCell('password', ''))).toBe('-');
  });

  it('password is excluded from search by default', () => {
    expect(getFieldDefinition('password').column?.(column())?.search).toBe(false);
  });

  it('tags renders each entry, and a dash for an empty list', () => {
    expect(textOf(renderCell('tags', ['a', 'b']))).toBe('ab');
    expect(textOf(renderCell('tags', []))).toBe('-');
    expect(textOf(renderCell('tags', 'not an array'))).toBe('-');
  });

  it('dateRange renders both ends, and a dash for a malformed pair', () => {
    expect(textOf(renderCell('dateRange', ['2024-01-01', '2024-02-01']))).toBe('2024-01-01 ~ 2024-02-01');
    expect(textOf(renderCell('dateRange', ['2024-01-01']))).toBe('-');
    expect(textOf(renderCell('dateRange', null))).toBe('-');
  });

  it('json renders compact serialised output', () => {
    expect(textOf(renderCell('json', { a: 1 }))).toBe('{"a":1}');
    expect(textOf(renderCell('json', null))).toBe('-');
  });

  it('color renders the hex value beside a swatch', () => {
    expect(textOf(renderCell('color', '#00ff00'))).toBe('#00ff00');
    expect(textOf(renderCell('color', ''))).toBe('-');
  });

  it('custom delegates to customRender and tolerates its absence', () => {
    const col = column({
      fieldType: 'custom',
      customRender: (value) => <span>seen:{String(value)}</span>,
    });
    expect(textOf(renderCell('custom', 42, col))).toBe('seen:42');
    expect(renderCell('custom', 42, column({ fieldType: 'custom' }))).toBeNull();
  });

  it('email renders a mailto link, and a dash when absent', () => {
    render(<>{renderCell('email', 'a@b.test')}</>);
    expect(screen.getByRole('link')).toHaveProperty('href', 'mailto:a%40b.test');
    expect(textOf(renderCell('email', null))).toBe('-');
  });

  it('url renders an external link with a safe rel', () => {
    render(<>{renderCell('url', 'https://example.test/x')}</>);
    const link = screen.getByRole('link');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
    expect(link.getAttribute('target')).toBe('_blank');
    expect(textOf(renderCell('url', ''))).toBe('-');
  });
});

describe('type-implied validation rules', () => {
  it('email and url carry a type rule', () => {
    expect(getFieldDefinition('email').rules?.(column())).toEqual([
      expect.objectContaining({ type: 'email' }),
    ]);
    expect(getFieldDefinition('url').rules?.(column())).toEqual([
      expect.objectContaining({ type: 'url' }),
    ]);
  });

  it('json rejects malformed input and accepts valid input', async () => {
    const [rule] = getFieldDefinition('json').rules?.(column()) ?? [];
    const validator = (rule as { validator: (r: unknown, v: unknown) => Promise<void> }).validator;

    await expect(validator(null, '{"a":1}')).resolves.toBeUndefined();
    await expect(validator(null, '{bad')).rejects.toThrow(/valid JSON/);
  });

  it('json skips validation for empty and non-string values', async () => {
    const [rule] = getFieldDefinition('json').rules?.(column()) ?? [];
    const validator = (rule as { validator: (r: unknown, v: unknown) => Promise<void> }).validator;

    await expect(validator(null, '')).resolves.toBeUndefined();
    await expect(validator(null, undefined)).resolves.toBeUndefined();
    await expect(validator(null, { already: 'parsed' })).resolves.toBeUndefined();
  });
});

describe('column configuration', () => {
  it('marks non-searchable types so they stay out of the search form', () => {
    for (const type of ['rating', 'progress', 'image', 'color', 'json', 'password'] as FieldType[]) {
      expect(getFieldDefinition(type).column?.(column())?.search).toBe(false);
    }
  });

  it('boolean uses the checked prop so Switch binds correctly', () => {
    expect(getFieldDefinition('boolean').valuePropName).toBe('checked');
  });

  it('maps types onto ProTable valueTypes', () => {
    expect(getFieldDefinition('money').column?.(column())?.valueType).toBe('money');
    expect(getFieldDefinition('percent').column?.(column())?.valueType).toBe('percent');
    expect(getFieldDefinition('textarea').column?.(column())?.valueType).toBe('textarea');
    expect(getFieldDefinition('time').column?.(column())?.valueType).toBe('time');
  });
});
