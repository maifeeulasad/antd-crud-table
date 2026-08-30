import type { EnumOption } from '../fields/types';

/**
 * Supported export formats.
 *
 * `excel` emits Excel 2003 SpreadsheetML, not OOXML. It was previously named
 * `xlsx`, which promised a format this library does not produce - writing a
 * real .xlsx means owning a ZIP implementation, which is not worth a
 * dependency-free library taking on. See exportToExcel for the tradeoff.
 */
export type ExportFormat = 'csv' | 'json' | 'excel';

/** The column information an exporter needs: a header, a key, and how to format. */
export interface ColumnOption {
  /** Header text. Falls back to `dataIndex`. */
  title?: string;
  /** The record property this column reads. */
  dataIndex?: string;
  /** Drives value formatting for booleans, enums and dates. */
  fieldType?: string;
  /** Labels for `enum` columns, so exports carry text rather than raw keys. */
  enumOptions?: Record<string, EnumOption>;
}

/** One export request. */
export interface ExportOptions<T> {
  /** Records to write. */
  data: T[];
  /** Columns to include, in order. */
  columns: ColumnOption[];
  /** Base filename; the extension is chosen by the format. Defaults to `export`. */
  filename?: string;
  /** Output format. Defaults to `csv`. */
  format?: ExportFormat;
}

/**
 * Characters that make a spreadsheet treat an imported cell as a formula
 * rather than as text (the OWASP CSV-injection set).
 */
const FORMULA_TRIGGERS = ['=', '+', '-', '@', '\t', '\r'];

/** A complete, plain numeric literal - optional sign, digits, decimal, exponent. */
const NUMERIC_LITERAL = /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/;

/**
 * Neutralise CSV formula injection.
 *
 * Wrapping a cell in double quotes does NOT prevent evaluation: quotes are a
 * text qualifier that Excel, LibreOffice and Sheets strip during import, after
 * which a leading `=`, `+`, `-`, `@`, tab or CR makes the remainder a formula.
 * Prefixing with a single quote marks the cell as text instead.
 *
 * Genuinely numeric values are left untouched - `-5` and `+3.2e4` are numbers,
 * not formulas, and prefixing them would corrupt the exported data.
 *
 * Not applied to the SpreadsheetML export: that format carries formulas in the
 * `ss:Formula` attribute, so `<Data ss:Type="String">` content is always
 * literal text and a prefix there would be visible corruption.
 */
const neutralizeFormula = (value: string): string => {
  if (value === '') return value;

  // Checked against both the raw and the left-trimmed value: leading
  // whitespace hides `=` from a naive first-character test, while tab and CR
  // are themselves triggers and would be consumed by trimming.
  const trimmed = value.trimStart();
  if (NUMERIC_LITERAL.test(trimmed)) return value;

  const startsWithTrigger = (candidate: string): boolean =>
    candidate !== '' && FORMULA_TRIGGERS.includes(candidate[0]);

  return startsWithTrigger(value) || startsWithTrigger(trimmed) ? `'${value}` : value;
};

/**
 * Convert data to CSV format
 */
const convertToCSV = <T>(data: T[], columns: ColumnOption[]): string => {
  // Get visible columns (exclude action columns)
  const visibleColumns = columns.filter(col =>
    col.fieldType !== 'option' && col.dataIndex
  );

  // Create header row
  const headers = visibleColumns.map(col =>
    String(col.title || col.dataIndex)
  );

  // Create data rows
  const rows = data.map(record => {
    return visibleColumns.map(col => {
      const value = record[col.dataIndex as keyof T];
      if (value === null || value === undefined) return '';

      // Handle different field types
      if (col.fieldType === 'boolean') {
        return value ? 'Yes' : 'No';
      }
      if (col.fieldType === 'date') {
        return String(value);
      }
      if (col.fieldType === 'enum' && col.enumOptions) {
        const option = col.enumOptions[value as string];
        return option?.text || String(value);
      }

      return String(value);
    });
  });

  // Combine headers and rows
  const quote = (value: string): string =>
    `"${neutralizeFormula(value).replace(/"/g, '""')}"`;

  const csvContent = [
    headers.map(quote).join(','),
    ...rows.map(row => row.map(cell => quote(String(cell))).join(','))
  ].join('\n');

  return csvContent;
};

/**
 * Download a file
 */
const downloadFile = (content: string, filename: string, mimeType: string): void => {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

/**
 * Export data to CSV format
 */
export const exportToCSV = <T>(options: ExportOptions<T>): void => {
  const { data, columns, filename = 'export' } = options;

  const csv = convertToCSV(data, columns);
  downloadFile(csv, `${filename}.csv`, 'text/csv;charset=utf-8;');
};

/**
 * Export data to JSON format
 */
export const exportToJSON = <T>(options: ExportOptions<T>): void => {
  const { data, filename = 'export' } = options;

  const json = JSON.stringify(data, null, 2);
  downloadFile(json, `${filename}.json`, 'application/json');
};

/**
 * Export data as an Excel-compatible spreadsheet.
 *
 * Emits Excel 2003 SpreadsheetML - an XML dialect Excel and LibreOffice open
 * natively - written to a `.xls` file, rather than a real OOXML `.xlsx`, which
 * would mean adding a dependency such as exceljs or hand-rolling a ZIP writer.
 *
 * Known consequence: because the content is SpreadsheetML and the extension is
 * `.xls`, Excel 2016 and later show "The file format and extension don't
 * match" on open. The file is intact and opens correctly once confirmed. The
 * format is named `excel` rather than `xlsx` so the API does not claim
 * otherwise.
 */
export const exportToExcel = <T extends object>(options: ExportOptions<T>): void => {
  const { data, columns, filename = 'export' } = options;

  // Get visible columns
  const visibleColumns = columns.filter(col =>
    col.fieldType !== 'option' && col.dataIndex
  );

  // Prepare headers
  const headers = visibleColumns.map(col => String(col.title || col.dataIndex));

  // Prepare data rows, keeping numbers as numbers so Excel treats them as such
  const rows: (string | number)[][] = data.map(record => {
    return visibleColumns.map(col => {
      const value = record[col.dataIndex as keyof T];
      if (value === null || value === undefined) return '';

      if (col.fieldType === 'boolean') {
        return value ? 'Yes' : 'No';
      }
      if (col.fieldType === 'enum' && col.enumOptions) {
        const option = col.enumOptions[value as string];
        return option?.text || String(value);
      }
      if (typeof value === 'number') {
        return value;
      }

      return String(value);
    });
  });

  const escapeXml = (str: string): string => {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  };

  const cellXml = (cell: string | number): string => {
    const type = typeof cell === 'number' ? 'Number' : 'String';
    const content = typeof cell === 'number' ? String(cell) : escapeXml(cell);
    return `<Cell><Data ss:Type="${type}">${content}</Data></Cell>`;
  };

  const headerXml = `<Row>${headers.map(h => cellXml(h)).join('')}</Row>`;
  const rowsXml = rows
    .map(row => `<Row>${row.map(cell => cellXml(cell)).join('')}</Row>`)
    .join('\n');

  const xlsContent = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Worksheet ss:Name="Export">
  <Table>
${headerXml}
${rowsXml}
  </Table>
 </Worksheet>
</Workbook>`;

  downloadFile(xlsContent, `${filename}.xls`, 'application/vnd.ms-excel');
};

/**
 * Export data with specified format
 */
export const exportData = <T extends object>(
  options: ExportOptions<T>
): void => {
  const { format = 'csv' } = options;

  switch (format) {
    case 'csv':
      exportToCSV(options);
      break;
    case 'json':
      exportToJSON(options);
      break;
    case 'excel':
      exportToExcel(options);
      break;
    default:
      exportToCSV(options);
  }
};

/**
 * Export all data (including paginated data)
 */
export const exportAllData = async <T extends object>(
  getAllData: () => Promise<T[]>,
  columns: ColumnOption[],
  filename: string = 'export',
  format: ExportFormat = 'csv'
): Promise<void> => {
  try {
    const data = await getAllData();
    exportData({ data, columns, filename, format });
  } catch (error) {
    console.error('Export failed:', error);
    throw error;
  }
};

