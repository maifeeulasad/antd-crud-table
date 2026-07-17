import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';

import { useCrudTable } from './useCrudTable';

interface User {
  id: number;
  name: string;
  age: number;
}

const seed = (): User[] => [
  { id: 1, name: 'Alice', age: 30 },
  { id: 2, name: 'Bob', age: 25 },
];

describe('useCrudTable (static data)', () => {
  it('loads data through refresh', async () => {
    const data = seed();
    const { result } = renderHook(() => useCrudTable<User>('id', { staticData: data }));

    await act(async () => {
      await result.current.refresh();
    });

    expect(result.current.state.data).toHaveLength(2);
    expect(result.current.state.total).toBe(2);
    expect(result.current.state.loading).toBe(false);
  });

  it('creates, updates and deletes against the same working copy', async () => {
    // staticData must be referentially stable, as in real usage where it
    // lives outside the render (a module const, memo, state, ...)
    const data = seed();
    const { result } = renderHook(() => useCrudTable<User>('id', { staticData: data }));

    await act(async () => {
      const created = await result.current.create({ name: 'Carol', age: 28 });
      expect(created).toMatchObject({ id: 3, name: 'Carol' });
    });

    await act(async () => {
      const updated = await result.current.update(3, { age: 29 });
      expect(updated).toMatchObject({ id: 3, age: 29 });
    });

    await act(async () => {
      expect(await result.current.delete(1)).toBe(true);
      await result.current.refresh();
    });

    expect(result.current.state.total).toBe(2);
    expect(result.current.state.data.map(u => u.id)).toEqual([2, 3]);
  });

  it('starts ids at 1 when the dataset is empty', async () => {
    const { result } = renderHook(() => useCrudTable<User>('id', { staticData: [] }));

    await act(async () => {
      const created = await result.current.create({ name: 'First', age: 1 });
      expect(created?.id).toBe(1);
    });
  });

  it('keeps the operations reference stable across re-renders', () => {
    const data = seed();
    const { result, rerender } = renderHook(() => useCrudTable<User>('id', { staticData: data }));

    const first = result.current.operations;
    rerender();
    expect(result.current.operations).toBe(first);
  });

  it('survives a re-render without losing mutations', async () => {
    const data = seed();
    const { result, rerender } = renderHook(() => useCrudTable<User>('id', { staticData: data }));

    await act(async () => {
      await result.current.create({ name: 'Carol', age: 28 });
    });

    rerender();

    await act(async () => {
      await result.current.refresh();
    });

    expect(result.current.state.total).toBe(3);
  });
});

describe('useCrudTable (custom operations)', () => {
  it('delegates to the provided operations and fires callbacks', async () => {
    const onSuccess = vi.fn();
    const operations = {
      getList: vi.fn(async () => ({ data: seed(), total: 2 })),
      create: vi.fn(async (input: Partial<User>) => ({ id: 99, ...input } as User)),
    };

    const { result } = renderHook(() =>
      useCrudTable<User>('id', { operations, onSuccess })
    );

    await act(async () => {
      const created = await result.current.create({ name: 'Zed', age: 1 });
      expect(created?.id).toBe(99);
    });

    expect(operations.create).toHaveBeenCalledOnce();
    expect(onSuccess).toHaveBeenCalledWith('create', expect.objectContaining({ id: 99 }));
  });

  it('reports failures through onError and returns null', async () => {
    const onError = vi.fn();
    const operations = {
      getList: vi.fn(async () => ({ data: [] as User[], total: 0 })),
      create: vi.fn(async () => {
        throw new Error('nope');
      }),
    };

    const { result } = renderHook(() =>
      useCrudTable<User>('id', { operations, onError })
    );

    await act(async () => {
      const created = await result.current.create({ name: 'Zed', age: 1 });
      expect(created).toBeNull();
    });

    expect(onError).toHaveBeenCalledWith('create', expect.any(Error));
    expect(result.current.state.loading).toBe(false);
  });
});
