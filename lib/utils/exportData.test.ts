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

describe('CSV formula injection', () => {
  const cell = async (value: unknown): Promise<string> => {
    exportToCSV({
      data: [{ payload: value }],
      columns: [{ title: 'Payload', dataIndex: 'payload' }],
    });
    const csv = await lastContent();
    return csv.split('\n')[1];
  };

  it.each([
    ['=1+1', `"'=1+1"`],
    ['=HYPERLINK("http://evil.test","x")', `"'=HYPERLINK(""http://evil.test"",""x"")"`],
    ['@SUM(A1:A9)', `"'@SUM(A1:A9)"`],
    ['+1-2', `"'+1-2"`],
    ['-1+cmd|\'/c calc\'!A0', `"'-1+cmd|'/c calc'!A0"`],
    ['\tSUM(1)', `"'\tSUM(1)"`],
    ['\r=1+1', `"'\r=1+1"`],
    [' =1+1', `"' =1+1"`],
  ])('neutralises %j', async (payload, expected) => {
    expect(await cell(payload)).toBe(expected);
  });

  it.each([
    ['-5', '"-5"'],
    ['+42', '"+42"'],
    ['-3.14', '"-3.14"'],
    ['+3.2e4', '"+3.2e4"'],
    ['-.5', '"-.5"'],
    ['plain text', '"plain text"'],
    ['a=b', '"a=b"'],
    ['', '""'],
  ])('leaves %j untouched', async (payload, expected) => {
    expect(await cell(payload)).toBe(expected);
  });

  it('neutralises dangerous column headers too', async () => {
    exportToCSV({
      data: [{ v: 1 }],
      columns: [{ title: '=cmd|calc', dataIndex: 'v' }],
    });
    expect((await lastContent()).split('\n')[0]).toBe(`"'=cmd|calc"`);
  });

  it('preserves numeric cells as numbers, not quoted formulas', async () => {
    expect(await cell(-5)).toBe('"-5"');
  });

  it('leaves SpreadsheetML content literal - ss:Formula is never emitted', async () => {
    exportToXLSX({
      data: [{ v: '=1+1' }],
      columns: [{ title: 'V', dataIndex: 'v' }],
    });
    const xml = await lastContent();
    expect(xml).toContain('<Cell><Data ss:Type="String">=1+1</Data></Cell>');
    expect(xml).not.toContain('ss:Formula');
    expect(xml).not.toContain("'=1+1");
  });
});
