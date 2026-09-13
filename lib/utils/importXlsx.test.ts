import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { parseXlsx } from './importXlsx';
import { fileParsers, autoMapColumns, prepareRows, type ImportColumn } from './importData';

/**
 * A real .xlsx fixture produced by to-spreadsheet's writer (sheet "People",
 * columns Name/Age/Active), so this exercises the actual OOXML read path.
 */
const fixture = (): ArrayBuffer => {
  const path = join(process.cwd(), 'lib/utils/__fixtures__/sample.xlsx');
  const buf = readFileSync(path);
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
};

const columns: ImportColumn[] = [
  { title: 'Name', dataIndex: 'name', fieldType: 'string' },
  { title: 'Age', dataIndex: 'age', fieldType: 'number' },
  { title: 'Active', dataIndex: 'active', fieldType: 'boolean' },
];

describe('parseXlsx', () => {
  it('registers itself as the xlsx file parser', () => {
    expect(typeof fileParsers.xlsx).toBe('function');
  });

  it('reads a real .xlsx workbook into a header + rows table', async () => {
    const table = await parseXlsx(fixture());
    expect(table.headers).toEqual(['Name', 'Age', 'Active']);
    expect(table.rows).toEqual([
      ['Alice', '30', 'Yes'],
      ['Bob', '25', 'No'],
    ]);
  });

  it('coerces the read cells into typed records via the registry', async () => {
    const table = await parseXlsx(fixture());
    const mapping = autoMapColumns(table.headers, columns);
    const prepared = await prepareRows(table, mapping, columns);
    expect(prepared.map((p) => p.record)).toEqual([
      { name: 'Alice', age: 30, active: true },
      { name: 'Bob', age: 25, active: false },
    ]);
    expect(prepared.every((p) => p.errors.length === 0)).toBe(true);
  });
});
