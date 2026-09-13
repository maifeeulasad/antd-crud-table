import { describe, it, expect, vi } from 'vitest';

import { parseSpreadsheetML, parseSpreadsheetMLTable } from './importSpreadsheetML';
import { fileParsers, autoMapColumns, prepareRows, type ImportColumn } from './importData';

/**
 * Capture the SpreadsheetML string exportToExcel writes, without touching the
 * DOM download path.
 */
const exportedXml = async (
  data: Record<string, unknown>[],
  columns: { title: string; dataIndex: string; fieldType?: string }[],
): Promise<string> => {
  let captured = '';
  vi.stubGlobal('Blob', class {
    constructor(parts: string[]) {
      captured = parts.join('');
    }
  });
  // Keep the real URL constructor (validation elsewhere uses `new URL`); only
  // add the object-URL helpers jsdom omits.
  const url = globalThis.URL as unknown as Record<string, unknown>;
  const hadCreate = 'createObjectURL' in url;
  url.createObjectURL = () => 'blob:';
  url.revokeObjectURL = () => {};
  const link = { href: '', download: '', click: () => {} };
  vi.stubGlobal('document', {
    createElement: () => link,
    body: { appendChild: () => {}, removeChild: () => {} },
  });

  const { exportToExcel } = await import('./exportData');
  exportToExcel({ data, columns: columns as never, filename: 'x' });
  vi.unstubAllGlobals();
  if (!hadCreate) {
    delete url.createObjectURL;
    delete url.revokeObjectURL;
  }
  return captured;
};

describe('parseSpreadsheetML', () => {
  it('parses rows, decodes entities, and keeps numeric text', () => {
    const xml = `<?xml version="1.0"?><Workbook><Worksheet ss:Name="Export"><Table>
      <Row><Cell><Data ss:Type="String">Name</Data></Cell><Cell><Data ss:Type="String">Age</Data></Cell></Row>
      <Row><Cell><Data ss:Type="String">A &amp; B</Data></Cell><Cell><Data ss:Type="Number">30</Data></Cell></Row>
    </Table></Worksheet></Workbook>`;
    expect(parseSpreadsheetML(xml)).toEqual([
      ['Name', 'Age'],
      ['A & B', '30'],
    ]);
  });

  it('honours ss:Index sparse jumps', () => {
    const xml = `<Table>
      <Row><Cell><Data ss:Type="String">a</Data></Cell><Cell ss:Index="3"><Data ss:Type="String">c</Data></Cell></Row>
    </Table>`;
    expect(parseSpreadsheetML(xml)).toEqual([['a', '', 'c']]);
  });

  it('registers itself as the xls file parser', () => {
    expect(typeof fileParsers.xls).toBe('function');
  });
});

describe('SpreadsheetML round-trip with the exporter', () => {
  const columns: ImportColumn[] = [
    { title: 'Name', dataIndex: 'name', fieldType: 'string' },
    { title: 'Age', dataIndex: 'age', fieldType: 'number' },
    {
      title: 'Role',
      dataIndex: 'role',
      fieldType: 'enum',
      enumOptions: { admin: { text: 'Administrator' }, user: { text: 'User' } },
    },
  ];

  it('reproduces the original records through export then import', async () => {
    const records = [
      { name: 'Alice', age: 30, role: 'admin' },
      { name: 'Bob', age: 25, role: 'user' },
    ];
    const xml = await exportedXml(records, columns);
    const table = parseSpreadsheetMLTable(xml);
    const mapping = autoMapColumns(table.headers, columns);
    const prepared = await prepareRows(table, mapping, columns);

    expect(prepared.every((p) => p.errors.length === 0)).toBe(true);
    expect(prepared.map((p) => p.record)).toEqual([
      { name: 'Alice', age: 30, role: 'admin' },
      { name: 'Bob', age: 25, role: 'user' },
    ]);
  });
});
