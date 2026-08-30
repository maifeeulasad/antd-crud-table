import { describe, it, expect, vi } from 'vitest';

import { CustomDataSource, UnsupportedOperationError } from './CustomDataSource';

interface Row { id: number; name: string }

describe('CustomDataSource', () => {
  it('delegates to the supplied operations', async () => {
    const list = vi.fn().mockResolvedValue({ items: [{ id: 1, name: 'a' }], total: 1 });
    const source = new CustomDataSource<Row, 'id'>({ list });

    const page = await source.list({ page: 1, pageSize: 10 });

    expect(list).toHaveBeenCalledWith({ page: 1, pageSize: 10 });
    expect(page.total).toBe(1);
  });

  it('names the missing operation instead of failing on undefined', async () => {
    const source = new CustomDataSource<Row, 'id'>({});

    await expect(source.create({ name: 'x' })).rejects.toThrow(UnsupportedOperationError);
    await expect(source.create({ name: 'x' })).rejects.toThrow(/does not support "create"/);
    await expect(source.update(1, {})).rejects.toThrow(/does not support "update"/);
    await expect(source.remove(1)).rejects.toThrow(/does not support "remove"/);
    await expect(source.list({ page: 1, pageSize: 10 })).rejects.toThrow(/does not support "list"/);
  });

  it('reports which operations are available', () => {
    const source = new CustomDataSource<Row, 'id'>({ list: vi.fn(), create: vi.fn() });

    expect(source.supports('list')).toBe(true);
    expect(source.supports('create')).toBe(true);
    expect(source.supports('remove')).toBe(false);
  });
});
