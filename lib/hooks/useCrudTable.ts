import { useCallback, useMemo, useRef, useState } from 'react';
import { message } from 'antd';
import type { ActionType } from '@ant-design/pro-components';

import {
  CustomDataSource,
  LocalStorageDataSource,
  RestDataSource,
  StaticDataSource,
} from '../core';
import type {
  CrudDataSource,
  CrudDraft,
  CrudQuery,
  IdGenerator,
  RestDataSourceOptions,
} from '../core';
import type { CrudOperations } from '../core/CustomDataSource';
import { enUS } from '../locale/en_US';
import type { CrudTableLocale, PartialCrudTableLocale } from '../locale/types';

/** The operations a table performs, used to tag success and error callbacks. */
export type CrudOperationName = 'list' | 'create' | 'update' | 'delete';

/**
 * Coerce a thrown value into an Error.
 *
 * Callbacks receive a real Error rather than `unknown`, so consumers can read
 * `.message` without narrowing at every call site. Non-Error throws are wrapped
 * rather than stringified into the message, keeping the original as `cause`.
 */
export const toError = (thrown: unknown): Error => {
  if (thrown instanceof Error) return thrown;
  return new Error(typeof thrown === 'string' ? thrown : 'Unknown error', { cause: thrown });
};

/** Everything the hook tracks about the current view of the data. */
export interface CrudTableState<T> {
  /** Whether a read or write is in flight. */
  loading: boolean;
  /** The most recent failure, cleared when a read succeeds. */
  error: Error | null;
  /** Records from the last read. Empty until `refresh` has run. */
  data: readonly T[];
  /** Records matching the filters, across all pages. */
  total: number;
  /** Current 1-based page. */
  page: number;
  /** Current rows per page. */
  pageSize: number;
}

/** Options shared by every strategy. */
interface UseCrudTableOptionsBase<T, K extends keyof T> {
  /** Rows per page for the hook's own reads. Defaults to 10. */
  defaultPageSize?: number;

  /**
   * Apply mutations to local state immediately instead of re-reading.
   *
   * Trades consistency for responsiveness: server-assigned fields will not be
   * reflected until the next list.
   */
  optimisticUpdates?: boolean;

  /**
   * Re-read the list after a successful mutation.
   *
   * Defaults to true for standalone hook consumers, which render from
   * `state.data`. `CrudTable` sets it false: it renders from ProTable's own
   * request pipeline and reloads through `actionRef`, so leaving this on
   * issued two list requests for every write.
   */
  refreshAfterMutation?: boolean;

  /** Replaces the built-in identity policy for the in-memory strategies. */
  generateId?: IdGenerator<T, K>;

  /** Show antd toasts for the outcome of each operation. */
  notifications?: boolean;

  /**
   * Overrides for the toast wording.
   *
   * `CrudTable` passes its own resolved locale down, so this is only needed
   * when the hook is used on its own.
   */
  locale?: PartialCrudTableLocale;

  /** Called after an operation succeeds, with whatever it produced. */
  onSuccess?: (operation: CrudOperationName, payload: unknown) => void;
  /** Called when an operation fails, with a real Error rather than the raw throw. */
  onError?: (operation: CrudOperationName, error: Error) => void;
}

/** Serves records from an in-process array. */
export interface StaticStrategy<T, K extends keyof T> extends UseCrudTableOptionsBase<T, K> {
  /** Seed records. Copied once; later changes to the array are not picked up. */
  staticData: readonly T[];
}

/** Serves records from a REST API. */
export interface RestStrategy<T, K extends keyof T> extends UseCrudTableOptionsBase<T, K> {
  /** Endpoints, parameter names, verbs and payload mapping. */
  api: RestDataSourceOptions<T>;
}

/** Serves records persisted to `localStorage`. */
export interface LocalStorageStrategy<T, K extends keyof T> extends UseCrudTableOptionsBase<T, K> {
  /** The `localStorage` key records are stored under. */
  storageKey: string;
  /** Records used when the key holds nothing readable. */
  initialData?: readonly T[];
}

/** Serves records through consumer-supplied operations. */
export interface OperationsStrategy<T, K extends keyof T> extends UseCrudTableOptionsBase<T, K> {
  /** Your own implementations. Omitted operations fail with a named error. */
  operations: CrudOperations<T, K>;
}

/** Serves records from a source the consumer constructs and owns. */
export interface DataSourceStrategy<T, K extends keyof T> extends UseCrudTableOptionsBase<T, K> {
  /** A source the consumer constructs and owns outright. */
  dataSource: CrudDataSource<T, K>;
}

/** Exactly one strategy must be supplied. */
export type UseCrudTableOptions<T, K extends keyof T> =
  | StaticStrategy<T, K>
  | RestStrategy<T, K>
  | LocalStorageStrategy<T, K>
  | OperationsStrategy<T, K>
  | DataSourceStrategy<T, K>;

/** What {@link useCrudTable} returns. */
export interface CrudTableActions<T, K extends keyof T> {
  /** Re-read the current page into `state`. */
  refresh: () => Promise<void>;
  /** Create a record. Resolves to the stored result, or `null` on failure. */
  create: (draft: CrudDraft<T>) => Promise<T | null>;
  /** Update a record. Resolves to the stored result, or `null` on failure. */
  update: (id: T[K], draft: CrudDraft<T>) => Promise<T | null>;
  /** Delete a record. Resolves to whether it succeeded. */
  remove: (id: T[K]) => Promise<boolean>;

  /** The live source, for wiring a table's own request pipeline directly. */
  dataSource: CrudDataSource<T, K>;

  /** Move to a 1-based page. */
  setPage: (page: number) => void;
  /** Change the page size, returning to the first page. */
  setPageSize: (size: number) => void;

  /** Current loading, error, data and pagination state. */
  state: CrudTableState<T>;
  /** ProTable's imperative handle, for reloading the table's own pipeline. */
  actionRef: React.RefObject<ActionType | undefined>;
}

const buildDataSource = <T extends object, K extends keyof T>(
  rowKey: K,
  options: UseCrudTableOptions<T, K>,
): CrudDataSource<T, K> => {
  if ('dataSource' in options) return options.dataSource;
  if ('operations' in options) return new CustomDataSource<T, K>(options.operations);
  if ('storageKey' in options) {
    return new LocalStorageDataSource<T, K>(
      options.storageKey,
      rowKey,
      options.initialData ?? [],
      options.generateId,
    );
  }
  if ('staticData' in options) {
    return new StaticDataSource<T, K>(options.staticData, rowKey, options.generateId);
  }
  if ('api' in options) return new RestDataSource<T, K>(options.api);

  throw new Error(
    'useCrudTable: supply exactly one of `staticData`, `api`, `storageKey`, `operations` or `dataSource`.',
  );
};

/**
 * React state and mutation orchestration over a `CrudDataSource`.
 *
 * All I/O lives in the source; this hook owns only React concerns. The source
 * is constructed once per hook instance and held in a ref, so its lifetime is
 * tied to the component rather than to the identity of the arguments that
 * described it - passing an inline `staticData` literal no longer discards the
 * dataset on every parent render.
 */
export const useCrudTable = <T extends object, K extends keyof T>(
  rowKey: K,
  options: UseCrudTableOptions<T, K>,
): CrudTableActions<T, K> => {
  const actionRef = useRef<ActionType | undefined>(undefined);

  const {
    defaultPageSize = 10,
    optimisticUpdates = false,
    refreshAfterMutation = true,
    notifications = true,
  } = options;

  const strings: CrudTableLocale = useMemo(
    () => (options.locale ? { ...enUS, ...options.locale } : enUS),
    [options.locale],
  );

  // Read through a ref so callback identity does not change every render.
  // `options` is almost always an object literal at the call site, so
  // depending on it directly recreated every callback on every render and
  // defeated the memoization entirely.
  const optionsRef = useRef(options);
  optionsRef.current = options;

  // Constructed once. Recreating on argument identity is precisely what made
  // in-memory datasets reset mid-session.
  const sourceRef = useRef<CrudDataSource<T, K> | null>(null);
  if (sourceRef.current === null) {
    sourceRef.current = buildDataSource(rowKey, options);
  }
  const dataSource = sourceRef.current;

  const [state, setState] = useState<CrudTableState<T>>({
    loading: false,
    error: null,
    data: [],
    total: 0,
    page: 1,
    pageSize: defaultPageSize,
  });

  const { page, pageSize } = state;

  const report = useCallback(
    (operation: CrudOperationName, error: Error): void => {
      optionsRef.current.onError?.(operation, error);
      if (notifications) message.error(error.message);
    },
    [notifications],
  );

  const succeed = useCallback(
    (operation: CrudOperationName, payload: unknown, text: string): void => {
      optionsRef.current.onSuccess?.(operation, payload);
      if (notifications) message.success(text);
    },
    [notifications],
  );

  const refresh = useCallback(async (): Promise<void> => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const query: CrudQuery<T> = { page, pageSize };
      const result = await dataSource.list(query);
      setState((prev) => ({
        ...prev,
        data: result.items,
        total: result.total,
        loading: false,
      }));
    } catch (thrown) {
      const error = toError(thrown);
      setState((prev) => ({ ...prev, loading: false, error }));
      report('list', error);
    }
  }, [dataSource, page, pageSize, report]);

  /**
   * Post-mutation reconciliation.
   *
   * Exactly one of these happens, never both - applying the optimistic update
   * *and* re-reading is what produced two list requests per write.
   */
  const reconcile = useCallback(
    async (apply: (prev: CrudTableState<T>) => CrudTableState<T>): Promise<void> => {
      if (optimisticUpdates) {
        setState(apply);
        return;
      }
      if (refreshAfterMutation) {
        await refresh();
        return;
      }
      setState((prev) => ({ ...prev, loading: false }));
    },
    [optimisticUpdates, refreshAfterMutation, refresh],
  );

  const create = useCallback(
    async (draft: CrudDraft<T>): Promise<T | null> => {
      setState((prev) => ({ ...prev, loading: true }));
      try {
        const created = await dataSource.create(draft);
        await reconcile((prev) => ({
          ...prev,
          data: [...prev.data, created],
          total: prev.total + 1,
          loading: false,
        }));
        succeed('create', created, strings.createSuccess);
        return created;
      } catch (thrown) {
        setState((prev) => ({ ...prev, loading: false }));
        report('create', toError(thrown));
        return null;
      }
    },
    [dataSource, reconcile, report, succeed, strings],
  );

  const update = useCallback(
    async (id: T[K], draft: CrudDraft<T>): Promise<T | null> => {
      setState((prev) => ({ ...prev, loading: true }));
      try {
        const updated = await dataSource.update(id, draft);
        await reconcile((prev) => ({
          ...prev,
          data: prev.data.map((item) => (item[rowKey] === id ? updated : item)),
          loading: false,
        }));
        succeed('update', updated, strings.updateSuccess);
        return updated;
      } catch (thrown) {
        setState((prev) => ({ ...prev, loading: false }));
        report('update', toError(thrown));
        return null;
      }
    },
    [dataSource, reconcile, report, rowKey, succeed, strings],
  );

  const remove = useCallback(
    async (id: T[K]): Promise<boolean> => {
      setState((prev) => ({ ...prev, loading: true }));
      try {
        await dataSource.remove(id);
        await reconcile((prev) => ({
          ...prev,
          data: prev.data.filter((item) => item[rowKey] !== id),
          total: Math.max(0, prev.total - 1),
          loading: false,
        }));
        succeed('delete', id, strings.deleteSuccess);
        return true;
      } catch (thrown) {
        setState((prev) => ({ ...prev, loading: false }));
        report('delete', toError(thrown));
        return false;
      }
    },
    [dataSource, reconcile, report, rowKey, succeed, strings],
  );

  const setPage = useCallback((next: number) => {
    setState((prev) => ({ ...prev, page: next }));
  }, []);

  const setPageSize = useCallback((size: number) => {
    setState((prev) => ({ ...prev, pageSize: size, page: 1 }));
  }, []);

  return useMemo(
    () => ({ refresh, create, update, remove, dataSource, setPage, setPageSize, state, actionRef }),
    [refresh, create, update, remove, dataSource, setPage, setPageSize, state],
  );
};

