import { useEffect, useMemo } from 'react';

import { useCrudTable } from './useCrudTable';
import type { CrudOperation, CrudParams, CrudTableActions } from './useCrudTable';
import { applyQuery } from '../utils/query';

export type UseLocalStorageCrudConfig = {
  defaultPageSize?: number;
  optimisticUpdates?: boolean;
  onSuccess?: (operation: 'create' | 'update' | 'delete' | 'fetch', data: any) => void;
  onError?: (operation: 'create' | 'update' | 'delete' | 'fetch', error: any) => void;
};

const getStoredData = <T>(storageKey: string, initialData: T[] = []): T[] => {
  try {
    const stored = localStorage.getItem(storageKey);
    return stored ? JSON.parse(stored) : initialData;
  } catch {
    return initialData;
  }
};

const setStoredData = <T>(storageKey: string, data: T[]): void => {
  try {
    localStorage.setItem(storageKey, JSON.stringify(data));
  } catch (error) {
    console.error('Failed to save to localStorage:', error);
  }
};

const createLocalStorageOperations = <T extends Record<string, any>>(
  storageKey: string,
  rowKey: keyof T,
  initialData: T[] = []
): CrudOperation<T> => {
  return {
    getList: async (params: CrudParams) =>
      applyQuery(getStoredData<T>(storageKey, initialData), params),

    create: async (newData: Partial<T>) => {
      const data = getStoredData<T>(storageKey, initialData);
      const maxId = data.length > 0
        ? Math.max(...data.map(item => Number(item[rowKey]) || 0), 0)
        : 0;

      const item = {
        [rowKey]: maxId + 1,
        ...newData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as unknown as T;

      data.push(item);
      setStoredData(storageKey, data);
      return item;
    },

    update: async (id: any, updateData: Partial<T>) => {
      const data = getStoredData<T>(storageKey, initialData);
      const index = data.findIndex(item => item[rowKey] === id);
      if (index === -1) throw new Error('Item not found');

      data[index] = {
        ...data[index],
        ...updateData,
        updatedAt: new Date().toISOString(),
      };
      setStoredData(storageKey, data);
      return data[index];
    },

    delete: async (id: any) => {
      const data = getStoredData<T>(storageKey, initialData);
      const filtered = data.filter(item => item[rowKey] !== id);
      setStoredData(storageKey, filtered);
    },
  };
};

/**
 * localStorage-backed CRUD hook. A thin wrapper that builds
 * localStorage operations and delegates all state management to the
 * shared useCrudTable engine.
 */
export const useLocalStorageCrud = <T extends Record<string, any>>(
  rowKey: keyof T,
  storageKey: string,
  initialData: T[] = [],
  config?: UseLocalStorageCrudConfig
): CrudTableActions<T> => {
  const operations = useMemo(
    () => createLocalStorageOperations<T>(storageKey, rowKey, initialData),
    [storageKey, rowKey, initialData]
  );

  const actions = useCrudTable<T>(rowKey, { ...config, operations });

  // Standalone consumers read state.data directly, so load once on mount
  // (mount-only on purpose: refresh's identity changes with state).
  const { refresh } = actions;
  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return actions;
};

export default useLocalStorageCrud;
