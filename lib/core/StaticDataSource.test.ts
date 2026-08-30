import { describe, it, expect } from 'vitest';

import { StaticDataSource } from './StaticDataSource';

interface User { id: number; name: string; age?: number }
interface Doc { uuid: string; title: string }

const seed: User[] = [
  { id: 1, name: 'Alice', age: 30 },
  { id: 2, name: 'Bob', age: 25 },
];

const make = () => new StaticDataSource<User, 'id'>(seed, 'id');

describe('StaticDataSource', () => {
  it('lists a page with the filtered total', async () => {
    const page = await make().list({ page: 1, pageSize: 1 });
    expect(page.items).toHaveLength(1);
    expect(page.total).toBe(2);
  });

  it('creates with a generated id and returns the stored record', async () => {
    const source = make();
    const created = await source.create({ name: 'Carol' });

    expect(created.id).toBe(3);
    expect(created.name).toBe('Carol');
    expect((await source.list({ page: 1, pageSize: 10 })).total).toBe(3);
  });

  it('merges updates without dropping untouched fields', async () => {
    const source = make();
    const updated = await source.update(1, { name: 'Alicia' });

    expect(updated).toEqual({ id: 1, name: 'Alicia', age: 30 });
  });

  it('refuses to let an update move a record onto a different id', async () => {
    const source = make();
    const updated = await source.update(1, { id: 99, name: 'Alicia' } as Partial<User>);

    expect(updated.id).toBe(1);
    expect((await source.list({ page: 1, pageSize: 10 })).total).toBe(2);
  });

  it('removes by id', async () => {
    const source = make();
    await source.remove(1);

    const page = await source.list({ page: 1, pageSize: 10 });
    expect(page.total).toBe(1);
    expect(page.items[0].id).toBe(2);
  });

  it('reports a missing record rather than failing silently', async () => {
    const source = make();
    await expect(source.update(404, { name: 'x' })).rejects.toThrow(/No record with id "404"/);
    await expect(source.remove(404)).rejects.toThrow(/No record with id "404"/);
  });

  it('never writes back to the caller seed array', async () => {
    const original = structuredClone(seed);
    const source = make();

    await source.create({ name: 'Carol' });
    await source.update(1, { name: 'Changed' });
    await source.remove(2);

    expect(seed).toEqual(original);
  });

  // The regression this class exists for. Previously the working copy lived in
  // a factory closure keyed on the caller's array identity, so an inline
  // literal from a component discarded every mutation on each parent render.
  it('keeps mutations across repeated queries regardless of caller re-renders', async () => {
    const source = new StaticDataSource<User, 'id'>([{ id: 1, name: 'Alice' }], 'id');

    await source.create({ name: 'Added' });
    for (let i = 0; i < 5; i += 1) {
      expect((await source.list({ page: 1, pageSize: 10 })).total).toBe(2);
    }
  });

  it('generates collision-free ids for uuid-keyed records', async () => {
    const source = new StaticDataSource<Doc, 'uuid'>([{ uuid: 'seed-a', title: 't' }], 'uuid');

    const first = await source.create({ title: 'one' });
    const second = await source.create({ title: 'two' });

    expect(first.uuid).not.toBe(second.uuid);
    expect((await source.list({ page: 1, pageSize: 10 })).total).toBe(3);
  });

  it('honours an injected id generator', async () => {
    let n = 100;
    const source = new StaticDataSource<User, 'id'>(seed, 'id', () => (n += 1));
    expect((await source.create({ name: 'x' })).id).toBe(101);
  });

  it('returns every match for listAll, ignoring pagination', async () => {
    const source = make();
    expect(await source.listAll({})).toHaveLength(2);
    expect(await source.listAll({ filters: { name: 'ali' } })).toHaveLength(1);
  });
});
