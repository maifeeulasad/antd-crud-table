import { describe, it, expect } from 'vitest';

import { filterRecords, paginateRecords, queryRecords, sortRecords } from './inMemoryQuery';

interface Row { id: number; name: string; age?: number; active: boolean }

const rows: Row[] = [
  { id: 1, name: 'Alice', age: 30, active: true },
  { id: 2, name: 'bob', age: 25, active: false },
  { id: 3, name: 'Carol', active: true },
  { id: 4, name: 'Dave', age: 25, active: false },
];

describe('filterRecords', () => {
  it('matches case-insensitive substrings', () => {
    expect(filterRecords(rows, { name: 'bo' }).map((r) => r.id)).toEqual([2]);
    expect(filterRecords(rows, { name: 'A' }).map((r) => r.id)).toEqual([1, 3, 4]);
  });

  it('ignores empty, null and undefined filter values', () => {
    expect(filterRecords(rows, { name: '' })).toHaveLength(4);
    expect(filterRecords(rows, { name: undefined })).toHaveLength(4);
  });

  it('excludes records missing the filtered field', () => {
    expect(filterRecords(rows, { age: 25 }).map((r) => r.id)).toEqual([2, 4]);
    expect(filterRecords(rows, { age: 3 }).map((r) => r.id)).not.toContain(3);
  });

  it('combines multiple filters conjunctively', () => {
    expect(filterRecords(rows, { age: 25, name: 'bob' }).map((r) => r.id)).toEqual([2]);
  });
});

describe('sortRecords', () => {
  it('orders numerically rather than lexicographically', () => {
    const data = [{ n: 10 }, { n: 9 }, { n: 100 }];
    expect(sortRecords(data, [{ field: 'n', direction: 'ascend' }]).map((r) => r.n)).toEqual([9, 10, 100]);
  });

  it('reverses for descend', () => {
    expect(sortRecords(rows, [{ field: 'id', direction: 'descend' }]).map((r) => r.id)).toEqual([4, 3, 2, 1]);
  });

  it('places missing values last in both directions', () => {
    expect(sortRecords(rows, [{ field: 'age', direction: 'ascend' }]).at(-1)?.id).toBe(3);
    expect(sortRecords(rows, [{ field: 'age', direction: 'descend' }]).at(-1)?.id).toBe(3);
  });

  it('breaks ties with later sort entries', () => {
    const sorted = sortRecords(rows, [
      { field: 'age', direction: 'ascend' },
      { field: 'name', direction: 'descend' },
    ]);
    // ids 2 and 4 both share age 25, so the name breaks the tie
    expect(sorted.slice(0, 2).map((r) => r.id)).toEqual([4, 2]);
  });

  it('collates strings by locale, so case does not dominate ordering', () => {
    // A raw `>` comparison orders by char code, putting every capitalised name
    // ahead of every lowercase one ('D' is 68, 'b' is 98). Locale collation
    // gives the alphabetical order a reader expects.
    const data = [{ name: 'Dave' }, { name: 'bob' }, { name: 'Alice' }];
    expect(sortRecords(data, [{ field: 'name', direction: 'ascend' }]).map((r) => r.name)).toEqual([
      'Alice',
      'bob',
      'Dave',
    ]);
  });

  it('does not mutate the input', () => {
    const original = [...rows];
    sortRecords(rows, [{ field: 'id', direction: 'descend' }]);
    expect(rows).toEqual(original);
  });
});

describe('paginateRecords', () => {
  it('slices 1-based pages', () => {
    expect(paginateRecords(rows, 1, 2).map((r) => r.id)).toEqual([1, 2]);
    expect(paginateRecords(rows, 2, 2).map((r) => r.id)).toEqual([3, 4]);
  });

  it('returns empty for pages past the end', () => {
    expect(paginateRecords(rows, 9, 2)).toEqual([]);
  });
});

describe('queryRecords', () => {
  it('filters before counting the total, and paginates after', () => {
    const page = queryRecords(rows, {
      page: 1,
      pageSize: 1,
      filters: { active: true },
      sort: [{ field: 'id', direction: 'descend' }],
    });
    expect(page.items.map((r) => r.id)).toEqual([3]);
    // total reflects everything matching the filter, not the page size
    expect(page.total).toBe(2);
  });
});
