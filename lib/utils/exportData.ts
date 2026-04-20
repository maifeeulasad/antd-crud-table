export type ExportFormat = 'csv' | 'json' | 'xlsx';

interface ColumnOption {
  title?: string;
  dataIndex?: string;
  fieldType?: string;
  enumOptions?: Record<string, { text: string; color?: string }>;
}

interface ExportOptions<T> {
  data: T[];
  columns: ColumnOption[];
  filename?: string;
  format?: ExportFormat;
}

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
  const csvContent = [
    headers.map(h => `"${h}"`).join(','),
    ...rows.map(row =>
      row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')
    )
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
 * Export data to XLSX format (using simple XML format)
 */
export const exportToXLSX = <T extends Record<string, any>>(options: ExportOptions<T>): void => {
  const { data, columns, filename = 'export' } = options;

  // Get visible columns
  const visibleColumns = columns.filter(col =>
    col.fieldType !== 'option' && col.dataIndex
  );

  // Prepare headers
  const headers = visibleColumns.map(col => String(col.title || col.dataIndex));

  // Prepare data rows
  const rows = data.map(record => {
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

      return String(value);
    });
  });

  // Create XLSX content (simple XML format)
  const createXLSX = () => {
    const escapeXml = (str: string): string => {
      return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
    };

    const headersXml = headers.map(h => `<c t="inlineStr"><is><t>${escapeXml(h)}</t></is></c>`).join('');
    const rowsXml = rows.map(row =>
      `<row>${row.map(cell => `<c t="inlineStr"><is><t>${escapeXml(String(cell))}</t></is></c>`).join('')}</row>`
    ).join('');

    return `<?xml version="1.0" encoding="UTF-8"?>
<?xml-stylesheet type="text/xsl" href="stylesheet.xsl"?>
<workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet">
  <sheets>
    <sheet name="Export">
      <table>
        <row>${headersXml}</row>
        ${rowsXml}
      </table>
    </sheet>
  </sheets>
</workbook>`;
  };

  // Create a simple Excel XML file
  const xlsxContent = createXLSX();
  downloadFile(xlsxContent, `${filename}.xls`, 'application/vnd.ms-excel');
};

/**
 * Export data with specified format
 */
export const exportData = <T extends Record<string, any>>(
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
    case 'xlsx':
      exportToXLSX(options);
      break;
    default:
      exportToCSV(options);
  }
};

/**
 * Export all data (including paginated data)
 */
export const exportAllData = async <T extends Record<string, any>>(
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

export default exportData;
