import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

import { useLocalStorageCrud } from './useLocalStorageCrud';

interface Note {
  id: number;
  text: string;
}

const KEY = 'crud-test-notes';

describe('useLocalStorageCrud', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('loads initial data on mount when storage is empty', async () => {
    const { result } = renderHook(() =>
      useLocalStorageCrud<Note>('id', KEY, [{ id: 1, text: 'hello' }])
    );

    await act(async () => {});

    expect(result.current.state.data).toEqual([{ id: 1, text: 'hello' }]);
  });

  it('persists creates to localStorage with timestamps', async () => {
    const { result } = renderHook(() => useLocalStorageCrud<Note>('id', KEY, []));

    await act(async () => {
      await result.current.create({ text: 'persisted' });
    });

    const stored = JSON.parse(localStorage.getItem(KEY)!);
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({ id: 1, text: 'persisted' });
    expect(stored[0].createdAt).toBeTruthy();
    expect(stored[0].updatedAt).toBeTruthy();
  });

  it('round-trips update and delete through storage', async () => {
    localStorage.setItem(KEY, JSON.stringify([
      { id: 1, text: 'one' },
      { id: 2, text: 'two' },
    ]));

    const { result } = renderHook(() => useLocalStorageCrud<Note>('id', KEY, []));

    await act(async () => {
      await result.current.update(1, { text: 'one!' });
      await result.current.delete(2);
    });

    const stored = JSON.parse(localStorage.getItem(KEY)!);
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({ id: 1, text: 'one!' });
  });

  it('is read by a fresh hook instance (true persistence)', async () => {
    const first = renderHook(() => useLocalStorageCrud<Note>('id', KEY, []));
    await act(async () => {
      await first.result.current.create({ text: 'kept' });
    });
    first.unmount();

    const second = renderHook(() => useLocalStorageCrud<Note>('id', KEY, []));
    await act(async () => {});

    expect(second.result.current.state.data).toMatchObject([{ id: 1, text: 'kept' }]);
  });
});
