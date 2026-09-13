/**
 * @fileoverview OOXML `.xlsx` parser for import.
 *
 * Reads real (zipped, OOXML) `.xlsx` workbooks via `to-spreadsheet`'s reader,
 * reusing the JSZip it already bundles rather than adding a second ZIP stack -
 * the dependency decision recorded on #58. Registers itself as the `xlsx` file
 * parser, so requiring this module (as CrudTable does) makes `.xlsx` available.
 *
 * Only the first worksheet is imported, matching the single-table shape the
 * mapping/preview flow expects.
 *
 * References:
 * - to-spreadsheet readExcel: https://github.com/maifeeulasad/to-spreadsheet#reading--importing
 *
 * @license MIT
 */

import { readExcel } from 'to-spreadsheet';

import { registerFileParser, toParsedTable } from './importData';
import type { ParsedTable } from './importData';

/** Render a parsed cell value as the text the coercion layer expects. */
const cellToString = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString();
  return String(value);
};

/**
 * Parse an `.xlsx` workbook's first sheet into a {@link ParsedTable}.
 * Accepts the raw bytes (`ArrayBuffer`/`Uint8Array`) the import dialog reads
 * from the chosen file.
 */
export const parseXlsx = async (
  input: string | ArrayBuffer | Uint8Array,
): Promise<ParsedTable> => {
  const workbook = await readExcel(input as ArrayBuffer);
  const sheet = workbook.sheets[0];
  if (!sheet) return { headers: [], rows: [] };
  const grid = sheet.rows.map((row) => row.map(cellToString));
  return toParsedTable(grid);
};

registerFileParser('xlsx', parseXlsx);
