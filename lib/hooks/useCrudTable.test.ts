import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';

import { useCrudTable, toError } from './useCrudTable';
import { StaticDataSource } from '../core';
import type { CrudDataSource, CrudPage, CrudQuery } from '../core';

interface User {
  id: number;
  name: string;
  age: number;
}

const seed: User[] = [
  { id: 1, name: 'Alice', age: 30 },
  { id: 2, name: 'Bob', age: 25 },
];

vi.mock('antd', async () => {
  const actual = await vi.importActual<typeof import('antd')>('antd');
  return {
    ...actual,
    message: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
  };
});

/** A source that records every call, for asserting request counts. */
const countingSource = (): CrudDataSource<User, 'id'> & { calls: Record<string, number> } => {
  const inner = new StaticDataSource<User, 'id'>(seed, 'id');
  const calls = { list: 0, create: 0, update: 0, remove: 0 };
  return {
    calls,
    list: async (query: CrudQuery<User>): Promise<CrudPage<User>> => {
      calls.list += 1;
      return inner.list(query);
    },
    create: async (draft) => {
      calls.create += 1;
      return inner.create(draft);
    },
    update: async (id, draft) => {
      calls.update += 1;
      return inner.update(id, draft);
    },
    remove: async (id) => {
      calls.remove += 1;
      return inner.remove(id);
    },
  };
};

beforeEach(() => vi.clearAllMocks());

describe('useCrudTable strategy selection', () => {
  it('builds a static source from staticData', async () => {
    const { result } = renderHook(() => useCrudTable<User, 'id'>('id', { staticData: seed }));

    await act(async () => { await result.current.refresh(); });

    expect(result.current.state.total).toBe(2);
    expect(result.current.state.data).toHaveLength(2);
  });

  it('accepts a consumer-owned data source', async () => {
    const dataSource = new StaticDataSource<User, 'id'>(seed, 'id');
    const { result } = renderHook(() => useCrudTable<User, 'id'>('id', { dataSource }));

    expect(result.current.dataSource).toBe(dataSource);
  });

  it('reports a missing strategy instead of failing later', () => {
    // React logs the render failure; the throw is the point of the test.
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() =>
      renderHook(() =>
        // @ts-expect-error deliberately omitting every strategy
        useCrudTable<User, 'id'>('id', {}),
      ),
    ).toThrow(/supply exactly one of/);
    consoleError.mockRestore();
  });
});

describe('useCrudTable mutations', () => {
  it('creates and reflects the new record', async () => {
    const { result } = renderHook(() =>
      useCrudTable<User, 'id'>('id', { staticData: seed }),
    );

    await act(async () => { await result.current.create({ name: 'Carol', age: 22 }); });

    expect(result.current.state.total).toBe(3);
  });

  it('passes the typed id through to update', async () => {
    const { result } = renderHook(() => useCrudTable<User, 'id'>('id', { staticData: seed }));

    let updated: User | null = null;
    await act(async () => { updated = await result.current.update(1, { name: 'Alicia' }); });

    expect(updated).toMatchObject({ id: 1, name: 'Alicia', age: 30 });
  });

  it('removes and reports success', async () => {
    const { result } = renderHook(() => useCrudTable<User, 'id'>('id', { staticData: seed }));

    let ok = false;
    await act(async () => { ok = await result.current.remove(1); });

    expect(ok).toBe(true);
  });

  it('returns null and reports the error when a mutation fails', async () => {
    const onError = vi.fn();
    const { result } = renderHook(() =>
      useCrudTable<User, 'id'>('id', { staticData: seed, onError }),
    );

    let created: User | null = { id: 0, name: '', age: 0 };
    await act(async () => { created = await result.current.update(404, { name: 'x' }); });

    expect(created).toBeNull();
    expect(onError).toHaveBeenCalledWith('update', expect.any(Error));
  });
});

// The regression that motivated splitting refresh from reload: the hook
// re-read the list *and* the table reloaded through actionRef, so every write
// cost two list requests.
describe('useCrudTable request counts', () => {
  it('issues exactly one list per mutation when refreshAfterMutation is off', async () => {
    const dataSource = countingSource();
    const { result } = renderHook(() =>
      useCrudTable<User, 'id'>('id', { dataSource, refreshAfterMutation: false }),
    );

    await act(async () => { await result.current.create({ name: 'Carol', age: 22 }); });

    expect(dataSource.calls.create).toBe(1);
    expect(dataSource.calls.list).toBe(0);
  });

  it('re-reads once when refreshAfterMutation is on', async () => {
    const dataSource = countingSource();
    const { result } = renderHook(() =>
      useCrudTable<User, 'id'>('id', { dataSource, refreshAfterMutation: true }),
    );

    await act(async () => { await result.current.create({ name: 'Carol', age: 22 }); });

    expect(dataSource.calls.list).toBe(1);
  });

  it('never re-reads when updating optimistically', async () => {
    const dataSource = countingSource();
    const { result } = renderHook(() =>
      useCrudTable<User, 'id'>('id', { dataSource, optimisticUpdates: true }),
    );

    await act(async () => { await result.current.create({ name: 'Carol', age: 22 }); });

    expect(dataSource.calls.list).toBe(0);
    expect(result.current.state.total).toBe(1);
  });
});

describe('useCrudTable stability', () => {
  // The hook config is an object literal at almost every call site. Depending
  // on it directly recreated every callback on every render, so the
  // memoization existed but achieved nothing.
  it('keeps action identities stable across re-renders with an inline config', () => {
    const { result, rerender } = renderHook(() =>
      useCrudTable<User, 'id'>('id', { staticData: seed, onSuccess: () => {} }),
    );

    const first = {
      create: result.current.create,
      update: result.current.update,
      remove: result.current.remove,
      dataSource: result.current.dataSource,
    };

    rerender();

    expect(result.current.create).toBe(first.create);
    expect(result.current.update).toBe(first.update);
    expect(result.current.remove).toBe(first.remove);
    expect(result.current.dataSource).toBe(first.dataSource);
  });

  // Previously the working copy lived in a closure keyed on the caller's array
  // identity, so an inline literal discarded every created row on re-render.
  it('preserves mutations when staticData is an inline literal', async () => {
    const { result, rerender } = renderHook(() =>
      useCrudTable<User, 'id'>('id', { staticData: [{ id: 1, name: 'Alice', age: 30 }] }),
    );

    await act(async () => { await result.current.create({ name: 'Added', age: 1 }); });
    rerender();
    await act(async () => { await result.current.refresh(); });

    expect(result.current.state.total).toBe(2);
  });

  it('reads the latest callbacks without rebuilding the actions', async () => {
    const first = vi.fn();
    const second = vi.fn();
    const { result, rerender } = renderHook(
      ({ onSuccess }) => useCrudTable<User, 'id'>('id', { staticData: seed, onSuccess }),
      { initialProps: { onSuccess: first } },
    );

    rerender({ onSuccess: second });
    await act(async () => { await result.current.create({ name: 'Carol', age: 22 }); });

    expect(second).toHaveBeenCalled();
    expect(first).not.toHaveBeenCalled();
  });
});

describe('useCrudTable paging', () => {
  it('resets to the first page when the page size changes', () => {
    const { result } = renderHook(() => useCrudTable<User, 'id'>('id', { staticData: seed }));

    act(() => result.current.setPage(3));
    expect(result.current.state.page).toBe(3);

    act(() => result.current.setPageSize(50));
    expect(result.current.state.pageSize).toBe(50);
    expect(result.current.state.page).toBe(1);
  });

  it('surfaces a list failure as state.error', async () => {
    const dataSource: CrudDataSource<User, 'id'> = {
      list: async () => { throw new Error('backend down'); },
      create: async () => seed[0],
      update: async () => seed[0],
      remove: async () => undefined,
    };
    const { result } = renderHook(() => useCrudTable<User, 'id'>('id', { dataSource }));

    await act(async () => { await result.current.refresh(); });

    await waitFor(() => expect(result.current.state.error?.message).toBe('backend down'));
  });
});

describe('toError', () => {
  it('passes an Error through unchanged', () => {
    const original = new Error('boom');
    expect(toError(original)).toBe(original);
  });

  it('wraps a thrown string as the message', () => {
    expect(toError('plain failure').message).toBe('plain failure');
  });

  it('keeps a non-string throw as the cause rather than stringifying it', () => {
    const thrown = { status: 500 };
    const error = toError(thrown);
    expect(error.message).toBe('Unknown error');
    expect(error.cause).toBe(thrown);
  });
});
