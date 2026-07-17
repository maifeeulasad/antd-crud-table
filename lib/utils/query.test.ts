import { describe, it, expect } from 'vitest';

import { applyQuery } from './query';

interface Row {
  id: number;
  name: string;
  age?: number | null;
}

const rows: Row[] = [
  { id: 1, name: 'Alice', age: 30 },
  { id: 2, name: 'Bob', age: 25 },
  { id: 3, name: 'Carol', age: null },
  { id: 4, name: 'dave', age: 40 },
  { id: 5, name: 'Albert' },
];

describe('applyQuery', () => {
  it('returns everything (first page) with no params', () => {
    const result = applyQuery(rows, {});
    expect(result.data).toHaveLength(5);
    expect(result.total).toBe(5);
    expect(result.success).toBe(true);
  });

  it('filters with case-insensitive substring matching', () => {
    const result = applyQuery(rows, { name: 'al' });
    expect(result.data.map(r => r.id)).toEqual([1, 5]);
    expect(result.total).toBe(2);
  });

  it('ignores empty, null and undefined filter values', () => {
    expect(applyQuery(rows, { name: '' }).total).toBe(5);
    expect(applyQuery(rows, { name: null }).total).toBe(5);
    expect(applyQuery(rows, { name: undefined }).total).toBe(5);
  });

  it('never matches rows whose value is missing', () => {
    // "undefined"/"null" as literal text must not match missing values
    expect(applyQuery(rows, { age: 'undefined' }).total).toBe(0);
    expect(applyQuery(rows, { age: 'null' }).total).toBe(0);
  });

  it('combines multiple filters with AND', () => {
    const result = applyQuery(rows, { name: 'a', age: '40' });
    expect(result.data.map(r => r.id)).toEqual([4]);
  });

  it('sorts ascending and descending', () => {
    const asc = applyQuery(rows, { sortBy: 'age', sortOrder: 'ascend' });
    expect(asc.data.map(r => r.id)).toEqual([2, 1, 4, 3, 5]);

    const desc = applyQuery(rows, { sortBy: 'age', sortOrder: 'descend' });
    expect(desc.data.map(r => r.id)).toEqual([4, 1, 2, 3, 5]);
  });

  it('keeps missing values last in either direction', () => {
    const asc = applyQuery(rows, { sortBy: 'age', sortOrder: 'ascend' });
    expect(asc.data.slice(-2).map(r => r.id).sort()).toEqual([3, 5]);
    const desc = applyQuery(rows, { sortBy: 'age', sortOrder: 'descend' });
    expect(desc.data.slice(-2).map(r => r.id).sort()).toEqual([3, 5]);
  });

  it('does not mutate the input array when sorting', () => {
    const before = rows.map(r => r.id);
    applyQuery(rows, { sortBy: 'age', sortOrder: 'ascend' });
    expect(rows.map(r => r.id)).toEqual(before);
  });

  it('paginates and reports the unpaginated total', () => {
    const page1 = applyQuery(rows, { current: 1, pageSize: 2 });
    expect(page1.data.map(r => r.id)).toEqual([1, 2]);
    expect(page1.total).toBe(5);

    const page3 = applyQuery(rows, { current: 3, pageSize: 2 });
    expect(page3.data.map(r => r.id)).toEqual([5]);
  });

  it('returns an empty page past the end of the data', () => {
    const result = applyQuery(rows, { current: 99, pageSize: 10 });
    expect(result.data).toEqual([]);
    expect(result.total).toBe(5);
  });
});
