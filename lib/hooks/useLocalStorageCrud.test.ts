import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';

import { useLocalStorageCrud } from './useLocalStorageCrud';

interface Note {
  id: number;
  text: string;
}

const KEY = 'notes-hook';
const seed: Note[] = [{ id: 1, text: 'first' }];

vi.mock('antd', async () => {
  const actual = await vi.importActual<typeof import('antd')>('antd');
  return {
    ...actual,
    message: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
  };
});

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});

describe('useLocalStorageCrud', () => {
  it('loads on mount so standalone consumers can render from state', async () => {
    const { result } = renderHook(() => useLocalStorageCrud<Note, 'id'>('id', KEY, seed));

    await waitFor(() => expect(result.current.state.total).toBe(1));
    expect(result.current.state.data[0].text).toBe('first');
  });

  it('persists a create to storage and to state', async () => {
    const { result } = renderHook(() => useLocalStorageCrud<Note, 'id'>('id', KEY, seed));
    await waitFor(() => expect(result.current.state.total).toBe(1));

    await act(async () => { await result.current.create({ text: 'second' }); });

    await waitFor(() => expect(result.current.state.total).toBe(2));
    expect(JSON.parse(localStorage.getItem(KEY) ?? '[]')).toHaveLength(2);
  });

  it('reflects an update in state', async () => {
    const { result } = renderHook(() => useLocalStorageCrud<Note, 'id'>('id', KEY, seed));
    await waitFor(() => expect(result.current.state.total).toBe(1));

    await act(async () => { await result.current.update(1, { text: 'changed' }); });

    await waitFor(() => expect(result.current.state.data[0].text).toBe('changed'));
  });

  it('removes a record', async () => {
    const { result } = renderHook(() => useLocalStorageCrud<Note, 'id'>('id', KEY, seed));
    await waitFor(() => expect(result.current.state.total).toBe(1));

    await act(async () => { await result.current.remove(1); });

    await waitFor(() => expect(result.current.state.total).toBe(0));
  });

  it('picks up data already in storage instead of the seed', async () => {
    localStorage.setItem(KEY, JSON.stringify([{ id: 9, text: 'stored' }]));
    const { result } = renderHook(() => useLocalStorageCrud<Note, 'id'>('id', KEY, seed));

    await waitFor(() => expect(result.current.state.data[0].text).toBe('stored'));
  });

  it('loads exactly once on mount, not on every render', async () => {
    const { result, rerender } = renderHook(() =>
      useLocalStorageCrud<Note, 'id'>('id', KEY, seed),
    );
    await waitFor(() => expect(result.current.state.total).toBe(1));

    const before = result.current.state.data;
    rerender();
    rerender();

    expect(result.current.state.data).toBe(before);
  });
});
