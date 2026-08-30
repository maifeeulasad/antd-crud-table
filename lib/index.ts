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
  RestDataSourceOptions,
  RestEndpoints,
  RestMethods,
  RestParamNames,
  SortDirection,
  Timestamped,
} from './core';

// Field-type registry
export { fieldRegistry, getFieldDefinition } from './fields/registry';
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
