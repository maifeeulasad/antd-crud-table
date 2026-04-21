import { useCallback, useRef, useState, useEffect } from 'react';
import { message } from 'antd';
import type { ActionType } from '@ant-design/pro-components';
import type { CrudParams, CrudOperation, CrudState, CrudTableActions } from './useCrudTable';

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
    getList: async (params: CrudParams) => {
      const { current = 1, pageSize = 10, sortBy, sortOrder, ...filters } = params;

      let filteredData = getStoredData<T>(storageKey, initialData);

      // Apply filters
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '' && key !== 'current' && key !== 'pageSize') {
          filteredData = filteredData.filter(item => {
            const itemValue = item[key as keyof T];
            if (itemValue === undefined || itemValue === null) return false;
            return String(itemValue).toLowerCase().includes(String(value).toLowerCase());
          });
        }
      });

      // Apply sorting
      if (sortBy && sortOrder) {
        filteredData.sort((a, b) => {
          const aVal = a[sortBy as keyof T];
          const bVal = b[sortBy as keyof T];
          if (aVal === undefined || aVal === null) return 1;
          if (bVal === undefined || bVal === null) return -1;
          const comparison = aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
          return sortOrder === 'ascend' ? comparison : -comparison;
        });
      }

      // Apply pagination
      const start = (current - 1) * pageSize;
      const paginatedData = filteredData.slice(start, start + pageSize);

      return {
        data: paginatedData,
        total: filteredData.length,
        success: true,
      };
    },

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

export const useLocalStorageCrud = <T extends Record<string, any>>(
  rowKey: keyof T,
  storageKey: string,
  initialData: T[] = [],
  config?: UseLocalStorageCrudConfig
): CrudTableActions<T> => {
  const actionRef = useRef<ActionType>(null);
  const [state, setState] = useState<CrudState<T>>({
    loading: false,
    error: null,
    data: [],
    total: 0,
    current: 1,
    pageSize: config?.defaultPageSize || 10,
  });

  const operations = createLocalStorageOperations<T>(storageKey, rowKey, initialData);

  const refresh = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const params: CrudParams = {
        current: state.current,
        pageSize: state.pageSize,
      };

      const response = await operations.getList(params);

      setState(prev => ({
        ...prev,
        data: response.data,
        total: response.total,
        loading: false,
      }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch data';
      setState(prev => ({ ...prev, loading: false, error: errorMessage }));
      config?.onError?.('fetch', error);
      message.error(errorMessage);
    }
  }, [state.current, state.pageSize, operations, config]);

  useEffect(() => {
    refresh();
  }, []);

  const create = useCallback(async (data: Partial<T>): Promise<T | null> => {
    try {
      setState(prev => ({ ...prev, loading: true }));
      const result = await operations.create(data);

      if (config?.optimisticUpdates) {
        setState(prev => ({
          ...prev,
          data: [...prev.data, result],
          total: prev.total + 1,
          loading: false,
        }));
      } else {
        await refresh();
      }

      config?.onSuccess?.('create', result);
      message.success('Created successfully');
      actionRef.current?.reload();
      return result;
    } catch (error) {
      setState(prev => ({ ...prev, loading: false }));
      const errorMessage = error instanceof Error ? error.message : 'Create failed';
      config?.onError?.('create', error);
      message.error(errorMessage);
      return null;
    }
  }, [operations, config, refresh]);

  const update = useCallback(async (id: any, data: Partial<T>): Promise<T | null> => {
    try {
      setState(prev => ({ ...prev, loading: true }));
      const result = await operations.update(id, data);

      if (config?.optimisticUpdates) {
        setState(prev => ({
          ...prev,
          data: prev.data.map(item =>
            item[rowKey] === id ? { ...item, ...result } : item
          ),
          loading: false,
        }));
      } else {
        await refresh();
      }

      config?.onSuccess?.('update', result);
      message.success('Updated successfully');
      actionRef.current?.reload();
      return result;
    } catch (error) {
      setState(prev => ({ ...prev, loading: false }));
      const errorMessage = error instanceof Error ? error.message : 'Update failed';
      config?.onError?.('update', error);
      message.error(errorMessage);
      return null;
    }
  }, [operations, config, rowKey, refresh]);

  const deleteItem = useCallback(async (id: any): Promise<boolean> => {
    try {
      setState(prev => ({ ...prev, loading: true }));
      await operations.delete(id);

      if (config?.optimisticUpdates) {
        setState(prev => ({
          ...prev,
          data: prev.data.filter(item => item[rowKey] !== id),
          total: prev.total - 1,
          loading: false,
        }));
      } else {
        await refresh();
      }

      config?.onSuccess?.('delete', id);
      message.success('Deleted successfully');
      actionRef.current?.reload();
      return true;
    } catch (error) {
      setState(prev => ({ ...prev, loading: false }));
      const errorMessage = error instanceof Error ? error.message : 'Delete failed';
      config?.onError?.('delete', error);
      message.error(errorMessage);
      return false;
    }
  }, [operations, config, rowKey, refresh]);

  const setPageSize = useCallback((size: number) => {
    setState(prev => ({ ...prev, pageSize: size, current: 1 }));
  }, []);

  const setCurrentPage = useCallback((page: number) => {
    setState(prev => ({ ...prev, current: page }));
  }, []);

  return {
    refresh,
    create,
    update,
    delete: deleteItem,
    setPageSize,
    setCurrentPage,
    state,
    actionRef,
  };
};

export default useLocalStorageCrud;
