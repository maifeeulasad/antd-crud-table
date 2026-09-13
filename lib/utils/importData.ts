/**
 * @fileoverview Import (read) utilities - the counterpart to exportData.
 *
 * Reads tabular files back into record drafts: parse the file into a header row
 * plus data rows, map incoming headers onto column `dataIndex` values, coerce
 * each cell into the record shape via the field registry, validate per row with
 * the same rules the create form uses, and create the valid rows through a
 * {@link CrudDataSource} with bounded concurrency.
 *
 * Format parsers are pluggable (see {@link fileParsers}) so CSV, SpreadsheetML
 * `.xls` and OOXML `.xlsx` can be added independently. This module owns CSV,
 * which needs no dependency.
 *
 * References:
 * - RFC 4180 (CSV): https://www.rfc-editor.org/rfc/rfc4180
 *
 * @license MIT
 */

import type { FormRule } from 'antd';

import { getFieldDefinition } from '../fields/registry';
import type { FieldType } from '../fields/registry';
import type { EnumOption } from '../fields/types';

/** File formats the importer can read. */
export type ImportFormat = 'csv' | 'xls' | 'xlsx';

/**
 * The column information the importer needs: how to match a header, how to
 * coerce a cell, and how to validate the result.
 */
export interface ImportColumn {
  /** Header text to match against, and the form label used in error messages. */
  title: string;
  /** The record property this column writes. */
  dataIndex: string;
  /** Drives value coercion (numbers, dates, enums, ...). */
  fieldType?: FieldType;
  /** Labels for `enum` columns, so an import accepts the exported label too. */
  enumOptions?: Record<string, EnumOption>;
  /** Resolved validation rules (registry rules + the column's own), as the form uses. */
  rules?: FormRule[];
}

/** A file parsed into a header row and the data rows beneath it. */
export interface ParsedTable {
  /** The first row, treated as headers. */
  headers: string[];
  /** Every subsequent row, as raw strings. */
  rows: string[][];
}

/**
 * Header-to-column mapping: for each header position, the `dataIndex` it feeds,
 * or `null` to ignore that column.
 */
export type ColumnMapping = (string | null)[];

/** One data row prepared for creation. */
export interface PreparedRow {
  /** 1-based row number in the file body (excludes the header), for reporting. */
  rowNumber: number;
  /** The coerced record draft. */
  record: Record<string, unknown>;
  /** Per-field validation errors; empty when the row is valid. */
  errors: { field: string; message: string }[];
}

/** The outcome of creating one prepared row. */
export interface ImportRowOutcome {
  rowNumber: number;
  ok: boolean;
  /** Failure reason: a validation summary or the create error message. */
  error?: string;
}

/** The result of an import run. */
export interface ImportResult {
  /** Rows created successfully. */
  created: number;
  /** Rows that failed validation. */
  invalid: number;
  /** Rows that failed to create despite being valid. */
  failed: number;
  /** Per-row outcomes, in file order. */
  outcomes: ImportRowOutcome[];
}

// --------------------------------------------------------------------------
// CSV parsing (RFC 4180)
// --------------------------------------------------------------------------

/**
 * Parse CSV text into rows of string fields. Handles quoted fields, escaped
 * quotes (`""`), embedded commas and newlines, `\r\n`/`\n` endings and a
 * leading UTF-8 BOM.
 */
export const parseCsv = (text: string, delimiter = ','): string[][] => {
  const delim = delimiter.charAt(0);
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let i = 0;

  const endField = () => {
    row.push(field);
    field = '';
  };
  const endRow = () => {
    endField();
    rows.push(row);
    row = [];
  };

  while (i < text.length) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += char;
      i++;
      continue;
    }
    if (char === '"') {
      inQuotes = true;
      i++;
    } else if (char === delim) {
      endField();
      i++;
    } else if (char === '\n') {
      endRow();
      i++;
    } else if (char === '\r') {
      endRow();
      i += text[i + 1] === '\n' ? 2 : 1;
    } else {
      field += char;
      i++;
    }
  }
  if (field !== '' || row.length > 0) endRow();

  // Drop a single trailing empty row produced by a final newline.
  if (rows.length > 0 && rows[rows.length - 1].length === 1 && rows[rows.length - 1][0] === '') {
    rows.pop();
  }
  return rows;
};

/** Split a grid into a header row plus data rows. */
export const toParsedTable = (grid: string[][]): ParsedTable => {
  if (grid.length === 0) return { headers: [], rows: [] };
  const [headers, ...rows] = grid;
  return { headers: headers.map((h) => String(h ?? '')), rows };
};

// --------------------------------------------------------------------------
// Pluggable file parsers
// --------------------------------------------------------------------------

/** A parser turns raw file bytes/text into a {@link ParsedTable}. */
export type FileParser = (input: string | ArrayBuffer | Uint8Array) => ParsedTable | Promise<ParsedTable>;

/**
 * Registered parsers per format. CSV is built in; `xls` and `xlsx` are
 * registered by their own modules so each format ships independently.
 */
export const fileParsers: Partial<Record<ImportFormat, FileParser>> = {
  csv: (input) => toParsedTable(parseCsv(typeof input === 'string' ? input : decodeText(input))),
};

/** Register a parser for a format (used by the xls/xlsx additions). */
export const registerFileParser = (format: ImportFormat, parser: FileParser): void => {
  fileParsers[format] = parser;
};

/** Decode raw bytes as UTF-8 text. */
export const decodeText = (input: ArrayBuffer | Uint8Array): string =>
  new TextDecoder('utf-8').decode(input);

/** Infer the import format from a filename extension. */
export const detectFormat = (filename: string): ImportFormat | undefined => {
  const ext = filename.toLowerCase().split('.').pop();
  if (ext === 'csv') return 'csv';
  if (ext === 'xls') return 'xls';
  if (ext === 'xlsx') return 'xlsx';
  return undefined;
};

/** Parse a file's contents into a {@link ParsedTable} using the registered parser. */
export const parseTable = async (
  input: string | ArrayBuffer | Uint8Array,
  format: ImportFormat,
): Promise<ParsedTable> => {
  const parser = fileParsers[format];
  if (!parser) {
    throw new Error(`No parser registered for "${format}" import`);
  }
  return parser(input);
};

// --------------------------------------------------------------------------
// Header mapping
// --------------------------------------------------------------------------

/** Normalise a header for tolerant matching: lower-cased, alphanumerics only. */
const normalizeHeader = (value: string): string => value.toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * Suggest a header-to-column mapping by matching header text against each
 * column's title (then its `dataIndex`), case- and punctuation-insensitively.
 * Password columns are never targeted. Unmatched headers map to `null`.
 */
export const autoMapColumns = (headers: string[], columns: ImportColumn[]): ColumnMapping => {
  const importable = columns.filter((col) => col.fieldType !== 'password');
  const byTitle = new Map<string, string>();
  const byDataIndex = new Map<string, string>();
  for (const col of importable) {
    byTitle.set(normalizeHeader(col.title), col.dataIndex);
    byDataIndex.set(normalizeHeader(col.dataIndex), col.dataIndex);
  }

  const used = new Set<string>();
  return headers.map((header) => {
    const key = normalizeHeader(header);
    const match = byTitle.get(key) ?? byDataIndex.get(key);
    if (match && !used.has(match)) {
      used.add(match);
      return match;
    }
    return null;
  });
};

// --------------------------------------------------------------------------
// Value coercion
// --------------------------------------------------------------------------

/**
 * Resolve an `enum` cell to its stored key, accepting either the key itself or
 * the exported label (case-insensitively). Returns the raw text when neither
 * matches, so validation can flag an unknown value rather than dropping it.
 */
const resolveEnumValue = (raw: string, enumOptions?: Record<string, EnumOption>): string => {
  if (!enumOptions) return raw;
  if (raw in enumOptions) return raw;
  const target = raw.trim().toLowerCase();
  for (const [key, option] of Object.entries(enumOptions)) {
    if (option.text.toLowerCase() === target || key.toLowerCase() === target) return key;
  }
  return raw;
};

/**
 * Coerce one raw cell into the record shape for a column. Throws when the
 * field's own conversion throws (e.g. malformed JSON), which the caller records
 * as a per-row error.
 */
export const coerceValue = (raw: string, column: ImportColumn): unknown => {
  if (column.fieldType === 'enum') return resolveEnumValue(raw, column.enumOptions);
  const { fromImportValue } = getFieldDefinition(column.fieldType);
  return fromImportValue ? fromImportValue(raw) : raw;
};

// --------------------------------------------------------------------------
// Validation - the same FormRule objects the create form uses
// --------------------------------------------------------------------------

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const isBlank = (value: unknown): boolean =>
  value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0);

const ruleMessage = (rule: FormRule, fallback: string): string => {
  const message = (rule as { message?: unknown }).message;
  return typeof message === 'string' ? message : fallback;
};

/**
 * Evaluate the resolved rules for one value, returning the first failure
 * message or `null`. Supports the rule shapes the registry and `formConfig`
 * produce: `required`, `type: 'email' | 'url'`, `pattern`, `len`/`min`/`max`,
 * and custom async `validator`s (which is how the `json` type validates).
 */
export const evaluateRules = async (
  rules: FormRule[] | undefined,
  value: unknown,
  label: string,
): Promise<string | null> => {
  if (!rules || rules.length === 0) return null;

  for (const rawRule of rules) {
    if (typeof rawRule === 'function') continue; // form-instance rules are not evaluable here
    const rule = rawRule as Exclude<FormRule, (...args: never[]) => unknown>;

    if (rule.required && isBlank(value)) {
      return ruleMessage(rule, `${label} is required`);
    }
    // Every remaining check only applies to a present value.
    if (isBlank(value)) continue;

    if (rule.type === 'email' && typeof value === 'string' && !EMAIL_RE.test(value)) {
      return ruleMessage(rule, `${label} is not a valid email`);
    }
    if (rule.type === 'url' && typeof value === 'string') {
      try {
        void new URL(value);
      } catch {
        return ruleMessage(rule, `${label} is not a valid URL`);
      }
    }
    if (rule.pattern instanceof RegExp && typeof value === 'string' && !rule.pattern.test(value)) {
      return ruleMessage(rule, `${label} is invalid`);
    }
    if (typeof rule.len === 'number' && typeof value === 'string' && value.length !== rule.len) {
      return ruleMessage(rule, `${label} must be ${rule.len} characters`);
    }
    if (typeof rule.min === 'number') {
      const size = typeof value === 'number' ? value : String(value).length;
      if (size < rule.min) return ruleMessage(rule, `${label} is too small`);
    }
    if (typeof rule.max === 'number') {
      const size = typeof value === 'number' ? value : String(value).length;
      if (size > rule.max) return ruleMessage(rule, `${label} is too large`);
    }
    if (typeof rule.validator === 'function') {
      try {
        await rule.validator(rule, value, () => undefined);
      } catch (thrown) {
        return thrown instanceof Error && thrown.message
          ? thrown.message
          : ruleMessage(rule, `${label} is invalid`);
      }
    }
  }
  return null;
};

// --------------------------------------------------------------------------
// Row preparation
// --------------------------------------------------------------------------

/**
 * Turn parsed rows into validated record drafts using the given mapping.
 * Password columns are excluded even if mapped. Cells that coerce to blank are
 * omitted from the draft so `required` rules see a missing value.
 */
export const prepareRows = async (
  table: ParsedTable,
  mapping: ColumnMapping,
  columns: ImportColumn[],
): Promise<PreparedRow[]> => {
  const byDataIndex = new Map(columns.map((col) => [col.dataIndex, col]));

  const prepared: PreparedRow[] = [];
  for (let r = 0; r < table.rows.length; r++) {
    const row = table.rows[r];
    const record: Record<string, unknown> = {};
    const errors: { field: string; message: string }[] = [];

    for (let c = 0; c < mapping.length; c++) {
      const dataIndex = mapping[c];
      if (!dataIndex) continue;
      const column = byDataIndex.get(dataIndex);
      if (!column || column.fieldType === 'password') continue;

      const raw = row[c] ?? '';
      let coerced: unknown;
      try {
        coerced = coerceValue(raw, column);
      } catch (thrown) {
        errors.push({
          field: dataIndex,
          message: thrown instanceof Error ? thrown.message : `${column.title} is invalid`,
        });
        continue;
      }
      if (!isBlank(coerced)) record[dataIndex] = coerced;

      const message = await evaluateRules(column.rules, record[dataIndex] ?? coerced, column.title);
      if (message) errors.push({ field: dataIndex, message });
    }

    prepared.push({ rowNumber: r + 1, record, errors });
  }
  return prepared;
};

// --------------------------------------------------------------------------
// Creation with bounded concurrency
// --------------------------------------------------------------------------

/** How the importer creates rows: one at a time, or all at once server-side. */
export interface ImportSink {
  /** Create one record. */
  create: (draft: Record<string, unknown>) => Promise<unknown>;
  /** Optional batch create for sources that can do it server-side. */
  createMany?: (drafts: Record<string, unknown>[]) => Promise<unknown>;
}

/** Options for {@link runImport}. */
export interface RunImportOptions {
  /** Max simultaneous single-row creates. Defaults to 5. */
  concurrency?: number;
}

/**
 * Create the valid prepared rows, reporting each row's outcome. Invalid rows are
 * never sent. Uses `createMany` when the sink offers it; otherwise creates with
 * a bounded pool so a large file does not fire thousands of simultaneous
 * requests. Partial success is honoured: a failing row does not abort the rest.
 */
export const runImport = async (
  prepared: PreparedRow[],
  sink: ImportSink,
  options: RunImportOptions = {},
): Promise<ImportResult> => {
  const concurrency = Math.max(1, options.concurrency ?? 5);
  const outcomes: ImportRowOutcome[] = [];

  const invalidRows = prepared.filter((p) => p.errors.length > 0);
  for (const row of invalidRows) {
    outcomes.push({
      rowNumber: row.rowNumber,
      ok: false,
      error: row.errors.map((e) => e.message).join('; '),
    });
  }

  const validRows = prepared.filter((p) => p.errors.length === 0);

  if (sink.createMany && validRows.length > 0) {
    try {
      await sink.createMany(validRows.map((row) => row.record));
      for (const row of validRows) outcomes.push({ rowNumber: row.rowNumber, ok: true });
    } catch (thrown) {
      const error = thrown instanceof Error ? thrown.message : 'Create failed';
      for (const row of validRows) outcomes.push({ rowNumber: row.rowNumber, ok: false, error });
    }
  } else {
    let cursor = 0;
    const worker = async () => {
      while (cursor < validRows.length) {
        const row = validRows[cursor++];
        try {
          await sink.create(row.record);
          outcomes.push({ rowNumber: row.rowNumber, ok: true });
        } catch (thrown) {
          outcomes.push({
            rowNumber: row.rowNumber,
            ok: false,
            error: thrown instanceof Error ? thrown.message : 'Create failed',
          });
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(concurrency, validRows.length) }, worker));
  }

  outcomes.sort((a, b) => a.rowNumber - b.rowNumber);
  const created = outcomes.filter((o) => o.ok).length;
  return {
    created,
    invalid: invalidRows.length,
    failed: outcomes.length - created - invalidRows.length,
    outcomes,
  };
};
