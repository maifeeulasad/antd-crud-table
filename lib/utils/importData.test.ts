import { describe, it, expect } from 'vitest';

import {
  parseCsv,
  toParsedTable,
  detectFormat,
  autoMapColumns,
  coerceValue,
  evaluateRules,
  prepareRows,
  runImport,
  type ImportColumn,
} from './importData';

describe('parseCsv', () => {
  it('parses quoted fields, escapes and embedded newlines', () => {
    expect(parseCsv('a,"b,c","d""e"\n1,"x\ny",3')).toEqual([
      ['a', 'b,c', 'd"e'],
      ['1', 'x\ny', '3'],
    ]);
  });

  it('handles CRLF and a BOM', () => {
    expect(parseCsv('﻿a,b\r\n1,2\r\n')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });
});

describe('toParsedTable / detectFormat', () => {
  it('splits headers from rows', () => {
    expect(toParsedTable([['name', 'age'], ['a', '1']])).toEqual({
      headers: ['name', 'age'],
      rows: [['a', '1']],
    });
  });

  it('detects format from extension', () => {
    expect(detectFormat('data.csv')).toBe('csv');
    expect(detectFormat('REPORT.XLSX')).toBe('xlsx');
    expect(detectFormat('legacy.xls')).toBe('xls');
    expect(detectFormat('notes.txt')).toBeUndefined();
  });
});

const columns: ImportColumn[] = [
  { title: 'Full Name', dataIndex: 'name', fieldType: 'string', rules: [{ required: true, message: 'Full Name is required' }] },
  { title: 'Age', dataIndex: 'age', fieldType: 'number' },
  { title: 'Active', dataIndex: 'active', fieldType: 'boolean' },
  { title: 'Role', dataIndex: 'role', fieldType: 'enum', enumOptions: { admin: { text: 'Administrator' }, user: { text: 'User' } } },
  { title: 'Email', dataIndex: 'email', fieldType: 'email', rules: [{ type: 'email', message: 'Email is not a valid email' }] },
  { title: 'Secret', dataIndex: 'secret', fieldType: 'password' },
];

describe('autoMapColumns', () => {
  it('matches on title and dataIndex, ignores password and unknowns', () => {
    const headers = ['Full Name', 'age', 'Active', 'Role', 'Email', 'Secret', 'Unknown'];
    expect(autoMapColumns(headers, columns)).toEqual([
      'name',
      'age',
      'active',
      'role',
      'email',
      null, // password never targeted
      null, // unknown header
    ]);
  });
});

describe('coerceValue', () => {
  it('coerces numbers and booleans', () => {
    expect(coerceValue('42', columns[1])).toBe(42);
    expect(coerceValue('Yes', columns[2])).toBe(true);
    expect(coerceValue('no', columns[2])).toBe(false);
  });

  it('resolves enum by exported label and by key', () => {
    expect(coerceValue('Administrator', columns[3])).toBe('admin');
    expect(coerceValue('user', columns[3])).toBe('user');
    expect(coerceValue('mystery', columns[3])).toBe('mystery'); // unknown kept for validation
  });

  it('parses json and throws on malformed json', () => {
    const jsonCol: ImportColumn = { title: 'Meta', dataIndex: 'meta', fieldType: 'json' };
    expect(coerceValue('{"a":1}', jsonCol)).toEqual({ a: 1 });
    expect(() => coerceValue('{bad', jsonCol)).toThrow();
  });
});

describe('evaluateRules', () => {
  it('flags required and email, passes valid values', async () => {
    expect(await evaluateRules([{ required: true, message: 'req' }], '', 'X')).toBe('req');
    expect(await evaluateRules([{ type: 'email', message: 'bad email' }], 'nope', 'Email')).toBe('bad email');
    expect(await evaluateRules([{ type: 'email', message: 'bad email' }], 'a@b.com', 'Email')).toBeNull();
  });
});

describe('prepareRows', () => {
  it('coerces, validates per row and excludes passwords', async () => {
    const table = {
      headers: ['name', 'age', 'active', 'role', 'email', 'secret'],
      rows: [
        ['Alice', '30', 'Yes', 'Administrator', 'alice@example.com', 'hunter2'],
        ['', '20', 'No', 'user', 'not-an-email', 'x'],
      ],
    };
    const mapping = ['name', 'age', 'active', 'role', 'email', 'secret'];
    const prepared = await prepareRows(table, mapping, columns);

    expect(prepared[0].errors).toEqual([]);
    expect(prepared[0].record).toEqual({
      name: 'Alice',
      age: 30,
      active: true,
      role: 'admin',
      email: 'alice@example.com',
    });
    expect(prepared[0].record).not.toHaveProperty('secret'); // password excluded

    // Row 2: missing required name + invalid email
    expect(prepared[1].errors.map((e) => e.field).sort()).toEqual(['email', 'name']);
  });
});

describe('runImport', () => {
  const valid = { rowNumber: 1, record: { name: 'A' }, errors: [] };
  const valid2 = { rowNumber: 2, record: { name: 'B' }, errors: [] };
  const invalid = { rowNumber: 3, record: {}, errors: [{ field: 'name', message: 'required' }] };

  it('creates valid rows, skips invalid, reports per row (single create)', async () => {
    const createdDrafts: unknown[] = [];
    const result = await runImport([valid, valid2, invalid], {
      create: async (d) => {
        createdDrafts.push(d);
        return d;
      },
    });
    expect(result).toMatchObject({ created: 2, invalid: 1, failed: 0 });
    expect(createdDrafts).toHaveLength(2);
    expect(result.outcomes.find((o) => o.rowNumber === 3)?.ok).toBe(false);
  });

  it('reports a create failure as a failed row without aborting', async () => {
    const result = await runImport([valid, valid2], {
      create: async (d) => {
        if ((d as { name: string }).name === 'A') throw new Error('boom');
        return d;
      },
    });
    expect(result.created).toBe(1);
    expect(result.failed).toBe(1);
    expect(result.outcomes.find((o) => o.rowNumber === 1)?.error).toBe('boom');
  });

  it('uses createMany when available', async () => {
    let batch: unknown[] | null = null;
    const result = await runImport([valid, valid2], {
      create: async (d) => d,
      createMany: async (drafts) => {
        batch = drafts;
        return drafts;
      },
    });
    expect(batch).toHaveLength(2);
    expect(result.created).toBe(2);
  });
});
