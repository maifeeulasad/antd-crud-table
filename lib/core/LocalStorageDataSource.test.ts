import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

import { LocalStorageDataSource } from './LocalStorageDataSource';

interface Note { id: number; text: string; createdAt?: string; updatedAt?: string }

const KEY = 'notes';
const seed: Note[] = [{ id: 1, text: 'first' }];

const make = () => new LocalStorageDataSource<Note, 'id'>(KEY, 'id', seed);
const stored = (): Note[] => JSON.parse(localStorage.getItem(KEY) ?? '[]');

beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe('LocalStorageDataSource', () => {
  it('falls back to the seed when nothing is stored', async () => {
    expect((await make().list({ page: 1, pageSize: 10 })).total).toBe(1);
  });

  it('persists creates to storage', async () => {
    const created = await make().create({ text: 'second' });

    expect(created.id).toBe(2);
    expect(stored().map((n) => n.text)).toEqual(['first', 'second']);
  });

  it('stamps createdAt and updatedAt on create', async () => {
    const created = await make().create({ text: 'x' });
    expect(created.createdAt).toBeTypeOf('string');
    expect(created.updatedAt).toBe(created.createdAt);
  });

  it('advances updatedAt on update but preserves createdAt', async () => {
    const source = make();
    const created = await source.create({ text: 'x' });

    vi.setSystemTime(new Date(Date.parse(created.createdAt!) + 5000));
    const updated = await source.update(created.id, { text: 'y' });

    expect(updated.createdAt).toBe(created.createdAt);
    expect(updated.updatedAt).not.toBe(created.updatedAt);
    vi.useRealTimers();
  });

  it('sees writes made by another instance on the same key', async () => {
    await make().create({ text: 'from A' });
    expect((await make().list({ page: 1, pageSize: 10 })).total).toBe(2);
  });

  it('falls back to the seed when the stored value is malformed', async () => {
    localStorage.setItem(KEY, '{not json');
    expect((await make().list({ page: 1, pageSize: 10 })).total).toBe(1);
  });

  it('falls back to the seed when the stored value is not an array', async () => {
    localStorage.setItem(KEY, '{"nope":true}');
    expect((await make().list({ page: 1, pageSize: 10 })).total).toBe(1);
  });

  // A read failure degrades; a write failure must not, or the user is told a
  // save succeeded when nothing was persisted.
  it('throws when a write cannot be persisted', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    await expect(make().create({ text: 'x' })).rejects.toThrow(/Failed to persist.*QuotaExceededError/);
  });

  it('removes by id', async () => {
    const source = make();
    await source.create({ text: 'second' });
    await source.remove(1);

    expect(stored().map((n) => n.id)).toEqual([2]);
  });
});
