import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { exportToCSV, exportToJSON, exportToXLSX } from './exportData';

interface Row {
  id: number;
  name: string;
  active: boolean;
  status: string;
  note?: string;
}

const rows: Row[] = [
  { id: 1, name: 'Alice "The Ace"', active: true, status: 'active', note: 'a,b' },
  { id: 2, name: 'Bob', active: false, status: 'inactive' },
];

const columns = [
  { title: 'ID', dataIndex: 'id', fieldType: 'number' },
  { title: 'Name', dataIndex: 'name', fieldType: 'string' },
  { title: 'Active', dataIndex: 'active', fieldType: 'boolean' },
  {
    title: 'Status',
    dataIndex: 'status',
    fieldType: 'enum',
    enumOptions: {
      active: { text: 'Active' },
      inactive: { text: 'Inactive' },
    },
  },
  { title: 'Note', dataIndex: 'note', fieldType: 'string' },
];

let capturedBlobs: Blob[];
let capturedNames: string[];

beforeEach(() => {
  capturedBlobs = [];
  capturedNames = [];
  vi.stubGlobal('URL', {
    ...URL,
    createObjectURL: vi.fn((blob: Blob) => {
      capturedBlobs.push(blob);
      return 'blob:mock';
    }),
    revokeObjectURL: vi.fn(),
  });
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    capturedNames.push(this.download);
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const lastContent = async (): Promise<string> => {
  expect(capturedBlobs.length).toBeGreaterThan(0);
  return capturedBlobs[capturedBlobs.length - 1].text();
};

describe('exportToCSV', () => {
  it('escapes quotes and commas, maps booleans and enum labels', async () => {
    exportToCSV({ data: rows, columns, filename: 'people' });

    const csv = await lastContent();
    const lines = csv.split('\n');
    expect(lines[0]).toBe('"ID","Name","Active","Status","Note"');
    expect(lines[1]).toBe('"1","Alice ""The Ace""","Yes","Active","a,b"');
    expect(lines[2]).toBe('"2","Bob","No","Inactive",""');
    expect(capturedNames.at(-1)).toBe('people.csv');
  });
});

describe('exportToJSON', () => {
  it('serializes the raw records', async () => {
    exportToJSON({ data: rows, columns, filename: 'people' });

    const parsed = JSON.parse(await lastContent());
    expect(parsed).toEqual(rows);
    expect(capturedNames.at(-1)).toBe('people.json');
  });
});

describe('exportToXLSX', () => {
  it('emits SpreadsheetML that Excel recognizes', async () => {
    exportToXLSX({ data: rows, columns, filename: 'people' });

    const xml = await lastContent();
    expect(xml).toContain('<?mso-application progid="Excel.Sheet"?>');
    expect(xml).toContain('xmlns="urn:schemas-microsoft-com:office:spreadsheet"');
    expect(xml).toContain('<Worksheet ss:Name="Export">');
    // numbers stay typed as numbers, strings are escaped
    expect(xml).toContain('<Cell><Data ss:Type="Number">1</Data></Cell>');
    expect(xml).toContain('Alice &quot;The Ace&quot;');
    expect(capturedNames.at(-1)).toBe('people.xls');
  });

  it('escapes XML-significant characters', async () => {
    exportToXLSX({
      data: [{ id: 1, name: '<b>&"x"</b>', active: true, status: 'active' }],
      columns,
      filename: 'people',
    });

    const xml = await lastContent();
    expect(xml).toContain('&lt;b&gt;&amp;&quot;x&quot;&lt;/b&gt;');
    expect(xml).not.toContain('<b>');
  });
});
