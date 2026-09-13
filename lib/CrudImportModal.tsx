import { InboxOutlined } from '@ant-design/icons';
import { Modal, Upload, Select, Table, Typography, Alert, Space, Tag, message } from 'antd';
import { useCallback, useMemo, useState } from 'react';

import type { CrudTableLocale } from './locale/types';
import {
  detectFormat,
  parseTable,
  autoMapColumns,
  prepareRows,
  runImport,
} from './utils/importData';
import type {
  ImportColumn,
  ImportFormat,
  ParsedTable,
  ColumnMapping,
  PreparedRow,
  ImportSink,
} from './utils/importData';

/** Props for {@link CrudImportModal}. */
export interface CrudImportModalProps {
  /** Whether the dialog is visible. */
  open: boolean;
  /** Columns available as import targets (password columns are filtered out). */
  columns: ImportColumn[];
  /** Formats the table accepts, in menu order (drives the file accept filter). */
  formats: ImportFormat[];
  /** Where valid rows are created. */
  sink: ImportSink;
  /** Max simultaneous single-row creates. */
  concurrency?: number;
  /** Resolved locale strings. */
  locale: CrudTableLocale;
  /** Called after a completed import so the caller can reload and report. */
  onImported: (summary: { created: number; invalid: number; failed: number }) => void;
  /** Close the dialog. */
  onClose: () => void;
}

/** How many rows the preview renders at once; every row is still validated. */
const PREVIEW_LIMIT = 100;

const ACCEPT: Record<ImportFormat, string> = {
  csv: '.csv',
  xls: '.xls',
  xlsx: '.xlsx',
};

/**
 * The import dialog: pick a file, map its headers onto columns, preview parsed
 * rows with per-row validation, then create the valid rows.
 */
export const CrudImportModal = ({
  open,
  columns,
  formats,
  sink,
  concurrency,
  locale,
  onImported,
  onClose,
}: CrudImportModalProps) => {
  const importable = useMemo(() => columns.filter((c) => c.fieldType !== 'password'), [columns]);

  const [table, setTable] = useState<ParsedTable | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping>([]);
  const [prepared, setPrepared] = useState<PreparedRow[]>([]);
  const [preparing, setPreparing] = useState(false);
  const [importing, setImporting] = useState(false);

  const reset = useCallback(() => {
    setTable(null);
    setMapping([]);
    setPrepared([]);
    setPreparing(false);
    setImporting(false);
  }, []);

  const close = useCallback(() => {
    reset();
    onClose();
  }, [reset, onClose]);

  /** Re-run coercion + validation for the current mapping. */
  const refreshPreview = useCallback(
    async (parsed: ParsedTable, nextMapping: ColumnMapping) => {
      setPreparing(true);
      try {
        setPrepared(await prepareRows(parsed, nextMapping, columns));
      } finally {
        setPreparing(false);
      }
    },
    [columns],
  );

  /** Parse a chosen file and enter the mapping step. Returns false to stop antd's own upload. */
  const handleFile = useCallback(
    async (file: File): Promise<boolean> => {
      const format: ImportFormat | undefined = detectFormat(file.name);
      if (!format || !formats.includes(format)) {
        message.error(locale.importUnsupportedFormat(file.name));
        return false;
      }
      try {
        const buffer = await file.arrayBuffer();
        const parsed = await parseTable(buffer, format);
        const nextMapping = autoMapColumns(parsed.headers, columns);
        setTable(parsed);
        setMapping(nextMapping);
        await refreshPreview(parsed, nextMapping);
      } catch (thrown) {
        message.error(locale.importParseFailed(thrown instanceof Error ? thrown.message : String(thrown)));
      }
      return false;
    },
    [columns, formats, locale, refreshPreview],
  );

  const handleMappingChange = useCallback(
    (headerIndex: number, dataIndex: string | null) => {
      if (!table) return;
      const next = mapping.slice();
      // A dataIndex maps from at most one header; clear any prior owner.
      if (dataIndex) {
        for (let i = 0; i < next.length; i++) if (next[i] === dataIndex) next[i] = null;
      }
      next[headerIndex] = dataIndex;
      setMapping(next);
      void refreshPreview(table, next);
    },
    [table, mapping, refreshPreview],
  );

  const validCount = prepared.filter((p) => p.errors.length === 0).length;
  const invalidCount = prepared.length - validCount;

  const handleImport = useCallback(async () => {
    if (validCount === 0) {
      message.warning(locale.importNothingValid);
      return;
    }
    setImporting(true);
    try {
      const result = await runImport(prepared, sink, { concurrency });
      onImported({ created: result.created, invalid: result.invalid, failed: result.failed });
      close();
    } finally {
      setImporting(false);
    }
  }, [validCount, prepared, sink, concurrency, locale, onImported, close]);

  const mappingOptions = useMemo(
    () => [
      { value: '', label: locale.importIgnoreColumn },
      ...importable.map((col) => ({ value: col.dataIndex, label: col.title })),
    ],
    [importable, locale.importIgnoreColumn],
  );

  const previewRows = useMemo(() => prepared.slice(0, PREVIEW_LIMIT), [prepared]);
  const mappedColumns = useMemo(
    () => mapping.filter((dataIndex): dataIndex is string => Boolean(dataIndex)),
    [mapping],
  );

  const previewTableColumns = useMemo(() => {
    const byDataIndex = new Map(columns.map((c) => [c.dataIndex, c]));
    const base = [
      {
        title: locale.importRowLabel,
        dataIndex: '__row',
        key: '__row',
        width: 64,
        fixed: 'left' as const,
      },
      {
        title: locale.importStatusLabel,
        dataIndex: '__status',
        key: '__status',
        width: 200,
        fixed: 'left' as const,
        render: (_: unknown, row: PreparedRow) =>
          row.errors.length === 0 ? (
            <Tag color="green">{locale.importRowValid}</Tag>
          ) : (
            <Space direction="vertical" size={0}>
              {row.errors.map((e) => (
                <Typography.Text key={e.field} type="danger" style={{ fontSize: 12 }}>
                  {e.message}
                </Typography.Text>
              ))}
            </Space>
          ),
      },
    ];
    const dataColumns = mappedColumns.map((dataIndex) => ({
      title: byDataIndex.get(dataIndex)?.title ?? dataIndex,
      dataIndex,
      key: dataIndex,
      ellipsis: true,
      render: (_: unknown, row: PreparedRow) => {
        const value = row.record[dataIndex];
        if (value === undefined || value === null) return locale.empty;
        return typeof value === 'object' ? JSON.stringify(value) : String(value);
      },
    }));
    return [...base, ...dataColumns];
  }, [columns, mappedColumns, locale]);

  const acceptList = formats.map((f) => ACCEPT[f]).join(',');
  const formatLabels = formats.map((f) => f.toUpperCase()).join(', ');

  return (
    <Modal
      title={locale.importTitle}
      open={open}
      onCancel={close}
      width={880}
      okText={locale.importRun}
      cancelText={table ? locale.importBack : locale.cancel}
      onOk={() => void handleImport()}
      okButtonProps={{ disabled: !table || validCount === 0 || preparing, loading: importing }}
      cancelButtonProps={table ? { onClick: reset } : undefined}
      destroyOnHidden
    >
      {!table ? (
        <Upload.Dragger
          accept={acceptList}
          multiple={false}
          showUploadList={false}
          beforeUpload={(file) => {
            void handleFile(file as File);
            return false;
          }}
        >
          <p className="ant-upload-drawing-icon">
            <InboxOutlined />
          </p>
          <p className="ant-upload-text">{locale.importSelectFile}</p>
          <p className="ant-upload-hint">{locale.importAcceptHint(formatLabels)}</p>
        </Upload.Dragger>
      ) : (
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <div>
            <Typography.Title level={5}>{locale.importMapColumns}</Typography.Title>
            <Space wrap size={[12, 12]}>
              {table.headers.map((header, index) => (
                <Space key={`${header}-${index}`} direction="vertical" size={2}>
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    {header || `#${index + 1}`}
                  </Typography.Text>
                  <Select
                    size="small"
                    style={{ width: 200 }}
                    value={mapping[index] ?? ''}
                    options={mappingOptions}
                    onChange={(value) => handleMappingChange(index, value === '' ? null : value)}
                  />
                </Space>
              ))}
            </Space>
          </div>

          <Alert
            type={invalidCount > 0 ? 'warning' : 'success'}
            showIcon
            message={locale.importSummary(validCount, invalidCount)}
          />

          <div>
            <Typography.Title level={5}>{locale.importPreview}</Typography.Title>
            <Table<PreparedRow>
              size="small"
              rowKey="rowNumber"
              loading={preparing}
              dataSource={previewRows}
              columns={previewTableColumns}
              pagination={false}
              scroll={{ x: 'max-content', y: 320 }}
            />
            {prepared.length > PREVIEW_LIMIT && (
              <Typography.Text type="secondary">
                {locale.importPreviewTruncated(PREVIEW_LIMIT, prepared.length)}
              </Typography.Text>
            )}
          </div>
        </Space>
      )}
    </Modal>
  );
};

export default CrudImportModal;
