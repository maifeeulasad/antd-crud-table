/**
 * @fileoverview SpreadsheetML (`.xls`) parser for import.
 *
 * Reads the Excel 2003 SpreadsheetML dialect that {@link exportToExcel} emits -
 * plain XML, no ZIP - back into a table. Registers itself as the `xls` file
 * parser on import, so requiring this module (as CrudTable does) makes `.xls`
 * available.
 *
 * Handles the subset this library writes (`<Row><Cell><Data ss:Type="...">`)
 * plus the parts a real SpreadsheetML file adds: `ss:Index` on a cell (a sparse
 * column jump) and on a row, so a file with gaps still lines up with its header.
 *
 * References:
 * - MS-XLSX / SpreadsheetML (Excel 2003 XML), Worksheet/Table/Row/Cell/Data:
 *   https://learn.microsoft.com/en-us/openspecs/office_standards/ms-xlsx/
 *
 * @license MIT
 */

import { registerFileParser, toParsedTable, decodeText } from './importData';
import type { ParsedTable } from './importData';

/** Decode the XML entities SpreadsheetML uses. `&amp;` is decoded last. */
const decodeXml = (text: string): string =>
  text
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');

/** Read an attribute value (single- or double-quoted) off a tag's attribute string. */
const getAttr = (attrs: string, name: string): string | undefined => {
  const match = attrs.match(
    new RegExp(`\\b${name.replace(':', '\\:')}\\s*=\\s*"([^"]*)"|\\b${name.replace(':', '\\:')}\\s*=\\s*'([^']*)'`),
  );
  if (!match) return undefined;
  return decodeXml(match[1] !== undefined ? match[1] : match[2]);
};

/**
 * Parse SpreadsheetML text into a grid of string cells (first Worksheet only).
 * `ss:Index` (1-based) on a row or cell is honoured so sparse files stay aligned.
 */
export const parseSpreadsheetML = (xml: string): string[][] => {
  // First worksheet's table only; the export writes exactly one.
  const tableMatch = xml.match(/<Table\b[^>]*>([\s\S]*?)<\/Table>/i);
  if (!tableMatch) return [];
  const tableInner = tableMatch[1];

  const grid: string[][] = [];
  let rowCursor = 0; // 0-based index of the next row to fill

  const rowRe = /<Row\b([^>]*)>([\s\S]*?)<\/Row>|<Row\b([^>]*)\/>/gi;
  let rowMatch: RegExpExecArray | null;
  while ((rowMatch = rowRe.exec(tableInner)) !== null) {
    const rowAttrs = rowMatch[1] ?? rowMatch[3] ?? '';
    const rowInner = rowMatch[2] ?? '';

    const rowIndexAttr = getAttr(rowAttrs, 'ss:Index');
    if (rowIndexAttr) rowCursor = Number(rowIndexAttr) - 1;

    const cells: string[] = [];
    let colCursor = 0; // 0-based index of the next cell to fill

    const cellRe = /<Cell\b([^>]*)>([\s\S]*?)<\/Cell>|<Cell\b([^>]*)\/>/gi;
    let cellMatch: RegExpExecArray | null;
    while ((cellMatch = cellRe.exec(rowInner)) !== null) {
      const cellAttrs = cellMatch[1] ?? cellMatch[3] ?? '';
      const cellInner = cellMatch[2] ?? '';

      const cellIndexAttr = getAttr(cellAttrs, 'ss:Index');
      if (cellIndexAttr) colCursor = Number(cellIndexAttr) - 1;

      const dataMatch = cellInner.match(/<Data\b[^>]*>([\s\S]*?)<\/Data>/i);
      const value = dataMatch ? decodeXml(dataMatch[1]) : '';
      cells[colCursor] = value;
      colCursor++;
    }

    // Fill any gaps left by ss:Index jumps.
    for (let c = 0; c < cells.length; c++) if (cells[c] === undefined) cells[c] = '';
    grid[rowCursor] = cells;
    rowCursor++;
  }

  // Normalise: fill missing rows and pad to a rectangular width.
  const width = grid.reduce((max, row) => Math.max(max, row ? row.length : 0), 0);
  for (let r = 0; r < grid.length; r++) {
    if (!grid[r]) grid[r] = [];
    for (let c = 0; c < width; c++) if (grid[r][c] === undefined) grid[r][c] = '';
  }
  return grid;
};

/** Parse SpreadsheetML content (text or bytes) into a {@link ParsedTable}. */
export const parseSpreadsheetMLTable = (input: string | ArrayBuffer | Uint8Array): ParsedTable =>
  toParsedTable(parseSpreadsheetML(typeof input === 'string' ? input : decodeText(input)));

registerFileParser('xls', parseSpreadsheetMLTable);
