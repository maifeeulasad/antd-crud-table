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
