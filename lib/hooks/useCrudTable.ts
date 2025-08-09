import { useState, useCallback, useRef } from 'react';
import { message } from 'antd';
import type { ActionType } from '@ant-design/pro-components';

export type CrudOperation<T> = {
  getList: (params: CrudParams) => Promise<CrudResponse<T>>;
  create: (data: Partial<T>) => Promise<T>;
  update: (id: any, data: Partial<T>) => Promise<T>;
  delete: (id: any) => Promise<void>;
};

export type CrudParams = {
  current?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'ascend' | 'descend';
  [key: string]: any;
};

export type CrudResponse<T> = {
  data: T[];
  total: number;
  success?: boolean;
};

export type CrudState<T> = {
  loading: boolean;
  error: string | null;
  data: T[];
  total: number;
  current: number;
  pageSize: number;
};

type UseCrudTableConfigBase = {
  // Configuration
  defaultPageSize?: number;
  enableCache?: boolean;
  optimisticUpdates?: boolean;
  
  // Callbacks
  onSuccess?: (operation: 'create' | 'update' | 'delete' | 'fetch', data: any) => void;
  onError?: (operation: 'create' | 'update' | 'delete' | 'fetch', error: any) => void;
}

interface UseCrudTableConfigStatic<T> extends UseCrudTableConfigBase {
  staticData: T[];
}
interface UseCrudTableConfigApi<T> extends UseCrudTableConfigBase {
  api: {
    baseUrl?: string;
    endpoints?: {
      list?: string;
      create?: string;
      update?: string;
      delete?: string;
    };
    headers?: Record<string, string>;
    transform?: {
      request?: (data: any) => any;
      response?: (data: any) => CrudResponse<T>;
    };
  };
}
interface UseCrudTableConfigCustom<T> extends UseCrudTableConfigBase {
  operations: Partial<CrudOperation<T>>;
}

export type UseCrudTableConfig<T> =
  | UseCrudTableConfigStatic<T>
  | UseCrudTableConfigApi<T>
  | UseCrudTableConfigCustom<T>;

export type CrudTableActions<T> = {
  // Data operations
  refresh: () => Promise<void>;
  create: (data: Partial<T>) => Promise<T | null>;
  update: (id: any, data: Partial<T>) => Promise<T | null>;
  delete: (id: any) => Promise<boolean>;
  
  // Table operations
  setPageSize: (size: number) => void;
  setCurrentPage: (page: number) => void;
  
  // State
  state: CrudState<T>;
  actionRef: React.RefObject<ActionType | null>;
};

// Default API operations
const createApiOperations = <T>(config: UseCrudTableConfigApi<T>): CrudOperation<T> => {
  const { baseUrl = '', endpoints = {}, headers = {}, transform } = config.api;
  
  const defaultEndpoints = {
    list: '/list',
    create: '/create',
    update: '/update',
    delete: '/delete',
    ...endpoints,
  };

  const fetchWithConfig = async (url: string, options: RequestInit = {}) => {
    const response = await fetch(`${baseUrl}${url}`, {
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      ...options,
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return response.json();
  };

  return {
    getList: async (params: CrudParams) => {
      const url = new URL(`${baseUrl}${defaultEndpoints.list}`, window.location.origin);
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          url.searchParams.append(key, String(value));
        }
      });
      
      const response = await fetchWithConfig(url.pathname + url.search);
      return transform?.response ? transform.response(response) : response;
    },
    
    create: async (data: Partial<T>) => {
      const payload = transform?.request ? transform.request(data) : data;
      return fetchWithConfig(defaultEndpoints.create, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },
    
    update: async (id: any, data: Partial<T>) => {
      const payload = transform?.request ? transform.request(data) : data;
      return fetchWithConfig(`${defaultEndpoints.update}/${id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
    },
    
    delete: async (id: any) => {
      await fetchWithConfig(`${defaultEndpoints.delete}/${id}`, {
        method: 'DELETE',
      });
    },
  };
};

// Static data operations
const createStaticOperations = <T>(staticData: T[], keyField: keyof T): CrudOperation<T> => {
  let data = [...staticData];
  let nextId = Math.max(...data.map(item => Number(item[keyField]) || 0)) + 1;

  return {
    getList: async (params: CrudParams) => {
      const { current = 1, pageSize = 10, sortBy, sortOrder, ...filters } = params;
      
      let filteredData = [...data];
      
      // Apply filters
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          filteredData = filteredData.filter(item => 
            String(item[key as keyof T]).toLowerCase().includes(String(value).toLowerCase())
          );
        }
      });
      
      // Apply sorting
      if (sortBy && sortOrder) {
        filteredData.sort((a, b) => {
          const aVal = a[sortBy as keyof T];
          const bVal = b[sortBy as keyof T];
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
      const item = { 
        [keyField]: nextId++, 
        ...newData 
      } as T;
      data.push(item);
      return item;
    },
    
    update: async (id: any, updateData: Partial<T>) => {
      const index = data.findIndex(item => item[keyField] === id);
      if (index === -1) throw new Error('Item not found');
      
      data[index] = { ...data[index], ...updateData };
      return data[index];
    },
    
    delete: async (id: any) => {
      const index = data.findIndex(item => item[keyField] === id);
      if (index === -1) throw new Error('Item not found');
      
      data.splice(index, 1);
    },
  };
};

export const useCrudTable = <T extends Record<string, any>>(
  rowKey: keyof T,
  config: UseCrudTableConfig<T>
): CrudTableActions<T> => {
  const actionRef = useRef<ActionType>(null);
  const [state, setState] = useState<CrudState<T>>({
    loading: false,
    error: null,
    data: [],
    total: 0,
    current: 1,
    pageSize: config.defaultPageSize || 10,
  });

  // Create operations based on config
  const operations = (() => {
    if ('operations' in config) {
      // Custom operations provided
      return config.operations as CrudOperation<T>;
    } else if ('staticData' in config) {
      // Static data approach
      return createStaticOperations(config.staticData, rowKey);
    } else if ('api' in config) {
      // API-based approach
      return createApiOperations(config);
    } else {
      throw new Error('useCrudTable: Must provide either staticData, api config, or custom operations');
    }
  })();

  const refresh = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      const params: CrudParams = {
        current: state.current,
        pageSize: state.pageSize,
      };
      
      const response = await operations.getList!(params);
      
      setState(prev => ({
        ...prev,
        data: response.data,
        total: response.total,
        loading: false,
      }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch data';
      setState(prev => ({ ...prev, loading: false, error: errorMessage }));
      config.onError?.('fetch', error);
      message.error(errorMessage);
    }
  }, [state.current, state.pageSize, operations, config]);

  const create = useCallback(async (data: Partial<T>): Promise<T | null> => {
    if (!operations.create) {
      message.error('Create operation not supported');
      return null;
    }

    try {
      setState(prev => ({ ...prev, loading: true }));
      const result = await operations.create(data);
      
      if (config.optimisticUpdates) {
        setState(prev => ({
          ...prev,
          data: [...prev.data, result],
          total: prev.total + 1,
          loading: false,
        }));
      } else {
        await refresh();
      }
      
      config.onSuccess?.('create', result);
      message.success('Created successfully');
      return result;
    } catch (error) {
      setState(prev => ({ ...prev, loading: false }));
      const errorMessage = error instanceof Error ? error.message : 'Create failed';
      config.onError?.('create', error);
      message.error(errorMessage);
      return null;
    }
  }, [operations, config, refresh]);

  const update = useCallback(async (id: any, data: Partial<T>): Promise<T | null> => {
    if (!operations.update) {
      message.error('Update operation not supported');
      return null;
    }

    try {
      setState(prev => ({ ...prev, loading: true }));
      const result = await operations.update(id, data);
      
      if (config.optimisticUpdates) {
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
      
      config.onSuccess?.('update', result);
      message.success('Updated successfully');
      return result;
    } catch (error) {
      setState(prev => ({ ...prev, loading: false }));
      const errorMessage = error instanceof Error ? error.message : 'Update failed';
      config.onError?.('update', error);
      message.error(errorMessage);
      return null;
    }
  }, [operations, config, rowKey, refresh]);

  const deleteItem = useCallback(async (id: any): Promise<boolean> => {
    if (!operations.delete) {
      message.error('Delete operation not supported');
      return false;
    }

    try {
      setState(prev => ({ ...prev, loading: true }));
      await operations.delete(id);
      
      if (config.optimisticUpdates) {
        setState(prev => ({
          ...prev,
          data: prev.data.filter(item => item[rowKey] !== id),
          total: prev.total - 1,
          loading: false,
        }));
      } else {
        await refresh();
      }
      
      config.onSuccess?.('delete', id);
      message.success('Deleted successfully');
      return true;
    } catch (error) {
      setState(prev => ({ ...prev, loading: false }));
      const errorMessage = error instanceof Error ? error.message : 'Delete failed';
      config.onError?.('delete', error);
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
