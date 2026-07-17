import type { CrudParams, CrudResponse } from '../hooks/useCrudTable';

/**
 * Shared in-memory query pipeline: filter, then sort, then paginate.
 *
 * Used by every strategy that queries a local dataset (static data,
 * localStorage) so the behaviour stays identical across them.
 *
 * - Filters are case-insensitive substring matches; params that are
 *   undefined/null/'' are ignored, and rows whose value is missing never
 *   match.
 * - Sorting puts missing values last regardless of direction.
 */
export const applyQuery = <T extends Record<string, any>>(
  data: T[],
  params: CrudParams
): CrudResponse<T> => {
  const { current = 1, pageSize = 10, sortBy, sortOrder, ...filters } = params;

  let result = data.filter((item) =>
    Object.entries(filters).every(([key, value]) => {
      if (value === undefined || value === null || value === '') return true;
      const itemValue = item[key as keyof T];
      if (itemValue === undefined || itemValue === null) return false;
      return String(itemValue).toLowerCase().includes(String(value).toLowerCase());
    })
  );

  if (sortBy && sortOrder) {
    result = [...result].sort((a, b) => {
      const aVal = a[sortBy as keyof T];
      const bVal = b[sortBy as keyof T];
      if (aVal === undefined || aVal === null) return 1;
      if (bVal === undefined || bVal === null) return -1;
      const comparison = aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
      return sortOrder === 'ascend' ? comparison : -comparison;
    });
  }

  const start = (current - 1) * pageSize;
  return {
    data: result.slice(start, start + pageSize),
    total: result.length,
    success: true,
  };
};
