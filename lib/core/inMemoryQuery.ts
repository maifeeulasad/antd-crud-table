import type { CrudFilters, CrudPage, CrudQuery, CrudSort } from './types';

/**
 * Ordering for values of unknown-at-compile-time shape.
 *
 * Numbers, booleans and dates compare by magnitude; everything else compares
 * as a locale-aware string, so `'b'` sorts after `'a'` and `'10'` after `'9'`
 * numerically where both are digit strings.
 */
const compareValues = (a: unknown, b: unknown): number => {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  if (typeof a === 'boolean' && typeof b === 'boolean') return Number(a) - Number(b);
  if (a instanceof Date && b instanceof Date) return a.getTime() - b.getTime();
  return String(a).localeCompare(String(b), undefined, { numeric: true });
};

/** Case-insensitive substring match, the behaviour the table's search box implies. */
const matchesFilter = (value: unknown, filter: unknown): boolean => {
  if (value === undefined || value === null) return false;
  return String(value).toLowerCase().includes(String(filter).toLowerCase());
};

/**
 * Apply filters to an in-memory collection.
 *
 * Filters whose value is undefined, null or the empty string are ignored, so
 * a cleared search box does not exclude everything. A record missing the
 * filtered field never matches.
 */
export const filterRecords = <T>(records: readonly T[], filters?: CrudFilters<T>): readonly T[] => {
  if (!filters) return records;

  const active = Object.entries(filters).filter(
    ([, value]) => value !== undefined && value !== null && value !== '',
  );
  if (active.length === 0) return records;

  return records.filter((record) =>
    active.every(([field, value]) => matchesFilter(record[field as keyof T], value)),
  );
};

/**
 * Apply an ordered list of sort instructions.
 *
 * Earlier entries take precedence; later ones break ties. Missing values sort
 * last in both directions - they carry no ordering information, so surfacing
 * them ahead of real data in one direction would be arbitrary.
 */
export const sortRecords = <T>(records: readonly T[], sort?: readonly CrudSort<T>[]): readonly T[] => {
  if (!sort || sort.length === 0) return records;

  return [...records].sort((a, b) => {
    for (const { field, direction } of sort) {
      const left = a[field];
      const right = b[field];

      const leftMissing = left === undefined || left === null;
      const rightMissing = right === undefined || right === null;
      if (leftMissing && rightMissing) continue;
      if (leftMissing) return 1;
      if (rightMissing) return -1;

      const comparison = compareValues(left, right);
      if (comparison !== 0) return direction === 'ascend' ? comparison : -comparison;
    }
    return 0;
  });
};

/** Take the requested page. Pages are 1-based; out-of-range pages yield an empty slice. */
export const paginateRecords = <T>(records: readonly T[], page: number, pageSize: number): readonly T[] => {
  const start = Math.max(0, (page - 1) * pageSize);
  return records.slice(start, start + pageSize);
};

/**
 * The shared filter-then-sort-then-paginate pipeline.
 *
 * Every strategy backed by a local collection routes through this, so their
 * querying behaviour cannot drift apart.
 */
export const queryRecords = <T>(records: readonly T[], query: CrudQuery<T>): CrudPage<T> => {
  const matched = sortRecords(filterRecords(records, query.filters), query.sort);
  return {
    items: paginateRecords(matched, query.page, query.pageSize),
    total: matched.length,
  };
};
