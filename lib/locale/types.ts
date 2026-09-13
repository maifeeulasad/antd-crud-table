/**
 * Every user-visible string the library produces.
 *
 * Interpolated strings are functions rather than templates with placeholders,
 * so a translation cannot silently drop a value or get the argument order
 * wrong - the compiler checks it.
 *
 * antd's own chrome (pagination, empty states, date pickers) is localised
 * through antd's `ConfigProvider`, and ProTable's chrome through its `intl`.
 * `CrudTable` derives both from the surrounding `ConfigProvider` when there is
 * one, so a consumer usually sets their app locale once and this object only
 * needs supplying to override the library's own wording.
 */
export interface CrudTableLocale {
  /** Header of the per-row actions column. */
  actions: string;
  /** Row action opening the edit form. */
  edit: string;
  /** Row action deleting a record. */
  delete: string;
  /** Toolbar button opening the create form. */
  create: string;
  /** Toolbar menu entry re-reading the current page. */
  refresh: string;

  /** Title of the create form. */
  createTitle: string;
  /** Title of the edit form. */
  editTitle: string;
  /** Confirm button in the create/edit form. */
  ok: string;
  /** Dismiss button in the create/edit form. */
  cancel: string;
  /** Validation message for a required field. */
  requiredField: (label: string) => string;

  /** Title of the single-delete confirmation. */
  confirmDeleteTitle: string;
  /** Body of both delete confirmations. */
  confirmDeleteContent: string;
  /** Confirm button of the single-delete confirmation. */
  confirmDeleteOk: string;
  /** Title of the bulk-delete confirmation. */
  confirmBulkDeleteTitle: (count: number) => string;
  /** Confirm button of the bulk-delete confirmation. */
  confirmBulkDeleteOk: string;
  /** Toolbar button opening the bulk-delete confirmation. */
  deleteSelected: (count: number) => string;
  /** Warning shown when bulk delete is invoked with nothing selected. */
  selectItemsToDelete: string;
  /** Result message when every delete in a bulk run succeeded. */
  bulkDeleteSuccess: (count: number) => string;
  /** Result message when only some deletes in a bulk run succeeded. */
  bulkDeletePartial: (succeeded: number, total: number, failed: number) => string;

  /** Menu entry writing every matching record. */
  exportAll: (format: string) => string;
  /** Menu entry writing only the rows on screen. */
  exportPage: (format: string) => string;
  /** Warning shown when there is nothing to write. */
  nothingToExport: string;
  /** Error shown when gathering or writing the export failed. */
  exportFailed: (message: string) => string;

  /** Menu entry that opens the import dialog. */
  importMenu: string;
  /** Import dialog title. */
  importTitle: string;
  /** Prompt to choose a file to import. */
  importSelectFile: string;
  /** Hint listing the accepted file formats (e.g. "CSV"). */
  importAcceptHint: (formats: string) => string;
  /** Heading of the header-to-column mapping step. */
  importMapColumns: string;
  /** The "do not import this column" option in the mapping selects. */
  importIgnoreColumn: string;
  /** Heading of the parsed-row preview. */
  importPreview: string;
  /** Column header for the row-number column in the preview. */
  importRowLabel: string;
  /** Column header for the per-row status column in the preview. */
  importStatusLabel: string;
  /** Status text for a row that passed validation. */
  importRowValid: string;
  /** Summary of how many rows are valid / invalid before importing. */
  importSummary: (valid: number, invalid: number) => string;
  /** Note shown when the preview is truncated to the first `shown` of `total`. */
  importPreviewTruncated: (shown: number, total: number) => string;
  /** Label of the button that performs the import. */
  importRun: string;
  /** Label of the button that returns to file selection. */
  importBack: string;
  /** Warning shown when no rows are valid to import. */
  importNothingValid: string;
  /** Confirmation that every row was imported. */
  importSuccess: (count: number) => string;
  /** Report of a partial import: created of total, with a failure count. */
  importPartial: (created: number, total: number, failed: number) => string;
  /** Error shown when reading or parsing the file failed. */
  importParseFailed: (message: string) => string;
  /** Error shown when the chosen file's format is not supported. */
  importUnsupportedFormat: (name: string) => string;

  /** Confirmation that a record was created. */
  createSuccess: string;
  /** Confirmation that a record was updated. */
  updateSuccess: string;
  /** Confirmation that a record was deleted. */
  deleteSuccess: string;

  /** Placeholder while the code-split table loads. */
  loading: string;

  /** Cell text for a true boolean. */
  yes: string;
  /** Cell text for a false boolean. */
  no: string;
  /** Cell text for a missing value. */
  empty: string;
  /** Placeholder of an enum column's select control. */
  selectPlaceholder: (title: string) => string;
  /** Placeholder of a tags column's input. */
  tagsPlaceholder: string;
  /** Validation message for an `email` column. */
  invalidEmail: string;
  /** Validation message for a `url` column. */
  invalidUrl: string;
  /** Validation message for an `image` column. */
  invalidImageUrl: string;
  /** Validation message for a `json` column. */
  invalidJson: string;
}

/** A locale override: supply only the strings that differ from the default. */
export type PartialCrudTableLocale = Partial<CrudTableLocale>;
