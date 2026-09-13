// Components
export { default as CrudTable } from './CrudTable';
export { default as CrudTableLazy } from './CrudTableLazy';
// Default export kept so `import CrudTable from 'antd-crud-table'` still works.
export { default } from './CrudTable';

export type { CrudTableConfig, CrudColumn, CrudColumnFor } from './CrudTable';

// Hooks
export { useCrudTable, toError } from './hooks/useCrudTable';
export { useLocalStorageCrud } from './hooks/useLocalStorageCrud';
export type {
  CrudOperationName,
  CrudTableActions,
  CrudTableState,
  UseCrudTableOptions,
  StaticStrategy,
  RestStrategy,
  LocalStorageStrategy,
  OperationsStrategy,
  DataSourceStrategy,
} from './hooks/useCrudTable';
export type { UseLocalStorageCrudOptions } from './hooks/useLocalStorageCrud';

// Data sources
export {
  CustomDataSource,
  InMemoryDataSource,
  LocalStorageDataSource,
  RestDataSource,
  RestError,
  StaticDataSource,
  UnsupportedOperationError,
  defaultIdGenerator,
  filterRecords,
  paginateRecords,
  queryRecords,
  randomUuid,
  sortRecords,
} from './core';
export type {
  CrudDataSource,
  CrudDraft,
  CrudFilters,
  CrudFilterValue,
  CrudOperations,
  CrudPage,
  CrudQuery,
  CrudSort,
  IdGenerator,
  HttpMethod,
  RestDataSourceOptions,
  RestEndpoints,
  RestMethods,
  RestOperation,
  RestParamNames,
  RestQueryValue,
  RestRequestContext,
  RestRequestOverrides,
  SortDirection,
  Timestamped,
} from './core';

// Localization
export { enUS, useResolvedLocale } from './locale';
export type { CrudTableLocale, PartialCrudTableLocale, ResolvedLocale } from './locale';

// Field-type registry
export { fieldRegistry, getFieldDefinition, defaultFieldLocale } from './fields/registry';
export type { FieldType, FieldTypeDefinition } from './fields/registry';
export type { EnumOption, FieldColumn } from './fields/types';

// Export utilities
export {
  exportData,
  exportToCSV,
  exportToJSON,
  exportToExcel,
  exportAllData,
} from './utils/exportData';
export type { ColumnOption, ExportFormat, ExportOptions } from './utils/exportData';

// Import utilities
export {
  parseCsv,
  parseTable,
  detectFormat,
  autoMapColumns,
  coerceValue,
  evaluateRules,
  prepareRows,
  runImport,
  registerFileParser,
  fileParsers,
} from './utils/importData';
export type {
  ImportFormat,
  ImportColumn,
  ParsedTable,
  ColumnMapping,
  PreparedRow,
  ImportResult,
  ImportRowOutcome,
  ImportSink,
  RunImportOptions,
  FileParser,
} from './utils/importData';
export { default as CrudImportModal } from './CrudImportModal';
export type { CrudImportModalProps } from './CrudImportModal';
// SpreadsheetML (.xls) import parser; importing this registers the `xls` parser.
export { parseSpreadsheetML, parseSpreadsheetMLTable } from './utils/importSpreadsheetML';
