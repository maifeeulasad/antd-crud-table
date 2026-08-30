import { useEffect } from 'react';

import { useCrudTable } from './useCrudTable';
import type { CrudTableActions, LocalStorageStrategy } from './useCrudTable';

/**
 * Options for the localStorage strategy, minus the strategy selector itself.
 */
/** Options for the localStorage strategy, minus the strategy selector itself. */
export type UseLocalStorageCrudOptions<T, K extends keyof T> = Omit<
  LocalStorageStrategy<T, K>,
  'storageKey' | 'initialData'
>;

/**
 * A localStorage-backed CRUD hook.
 *
 * A thin wrapper that selects the localStorage strategy and performs the
 * initial read. Standalone consumers render from `state.data`, so unlike the
 * table - which drives its own request pipeline - this needs a load on mount.
 */
export const useLocalStorageCrud = <T extends object, K extends keyof T>(
  rowKey: K,
  storageKey: string,
  initialData: readonly T[] = [],
  options?: UseLocalStorageCrudOptions<T, K>,
): CrudTableActions<T, K> => {
  const actions = useCrudTable<T, K>(rowKey, { ...options, storageKey, initialData });

  const { refresh } = actions;
  useEffect(() => {
    void refresh();
    // Mount-only: refresh closes over the current page, so listing it as a
    // dependency would re-read on every pagination change and fight the
    // caller's own paging.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return actions;
};

