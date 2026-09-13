import type { CrudTableLocale } from './types';

/**
 * The built-in default.
 *
 * English is the fallback everywhere, including when no antd `ConfigProvider`
 * is present - which is the case that previously left antd's own components
 * rendering their built-in Chinese defaults.
 */
export const enUS: CrudTableLocale = {
  actions: 'Actions',
  edit: 'Edit',
  delete: 'Delete',
  create: 'New',
  refresh: 'Refresh',

  createTitle: 'Create Item',
  editTitle: 'Edit Item',
  ok: 'OK',
  cancel: 'Cancel',
  requiredField: (label) => `${label} is required`,

  confirmDeleteTitle: 'Are you sure?',
  confirmDeleteContent: 'This action cannot be undone.',
  confirmDeleteOk: 'Yes, Delete',
  confirmBulkDeleteTitle: (count) => `Delete ${count} items?`,
  confirmBulkDeleteOk: 'Yes, Delete All',
  deleteSelected: (count) => `Delete Selected (${count})`,
  selectItemsToDelete: 'Please select items to delete',
  bulkDeleteSuccess: (count) => `Deleted ${count} items`,
  bulkDeletePartial: (succeeded, total, failed) =>
    `Deleted ${succeeded} of ${total}. ${failed} failed.`,

  exportAll: (format) => `Export all as ${format}`,
  exportPage: (format) => `Export page as ${format}`,
  nothingToExport: 'Nothing to export',
  exportFailed: (message) => `Export failed: ${message}`,

  importMenu: 'Import',
  importTitle: 'Import data',
  importSelectFile: 'Choose a file to import',
  importAcceptHint: (formats) => `Accepted formats: ${formats}`,
  importMapColumns: 'Map columns',
  importIgnoreColumn: '— Ignore —',
  importPreview: 'Preview',
  importRowLabel: 'Row',
  importStatusLabel: 'Status',
  importRowValid: 'Valid',
  importSummary: (valid, invalid) => `${valid} valid, ${invalid} to skip`,
  importPreviewTruncated: (shown, total) => `Showing first ${shown} of ${total} rows`,
  importRun: 'Import',
  importBack: 'Back',
  importNothingValid: 'No valid rows to import',
  importSuccess: (count) => `Imported ${count} rows`,
  importPartial: (created, total, failed) =>
    `Imported ${created} of ${total}. ${failed} failed.`,
  importParseFailed: (message) => `Could not read file: ${message}`,
  importUnsupportedFormat: (name) => `Unsupported file format: ${name}`,

  createSuccess: 'Created successfully',
  updateSuccess: 'Updated successfully',
  deleteSuccess: 'Deleted successfully',

  loading: 'Loading CRUD table…',

  yes: 'Yes',
  no: 'No',
  empty: '-',
  selectPlaceholder: (title) => `Select ${title.toLowerCase()}`,
  tagsPlaceholder: 'Type and press enter',
  invalidEmail: 'Please enter a valid email',
  invalidUrl: 'Please enter a valid URL',
  invalidImageUrl: 'Please enter a valid image URL',
  invalidJson: 'Please enter valid JSON',
};

export default enUS;
