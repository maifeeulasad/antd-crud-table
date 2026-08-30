import { InMemoryDataSource } from './InMemoryDataSource';
import type { CrudDraft, IdGenerator } from './types';

/** Fields stamped onto records by the localStorage strategy. */
export interface Timestamped {
  /** ISO timestamp set once, when the record is created. */
  createdAt?: string;
  /** ISO timestamp refreshed on every write. */
  updatedAt?: string;
}

/**
 * A source persisting to `localStorage` under a fixed key.
 *
 * Reads go through storage on every call rather than through a cache, so a
 * second tab writing the same key is picked up on the next query instead of
 * being shadowed by stale in-memory state.
 *
 * Storage is best-effort: a read that fails or returns malformed JSON falls
 * back to the seed rather than throwing, since an unreadable cache should not
 * take the table down. Writes that fail (quota, private mode) *do* throw -
 * silently dropping a write the user believes succeeded is worse than an error.
 */
export class LocalStorageDataSource<
  T extends object,
  K extends keyof T,
> extends InMemoryDataSource<T, K> {
  private readonly storageKey: string;
  private readonly seed: readonly T[];

  constructor(storageKey: string, key: K, seed: readonly T[] = [], generateId?: IdGenerator<T, K>) {
    super(key, generateId);
    this.storageKey = storageKey;
    this.seed = seed;
  }

  protected read(): readonly T[] {
    let raw: string | null;
    try {
      raw = localStorage.getItem(this.storageKey);
    } catch {
      return this.seed;
    }
    if (raw === null) return this.seed;

    try {
      const parsed: unknown = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as T[]) : this.seed;
    } catch {
      return this.seed;
    }
  }

  protected write(records: readonly T[]): void {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(records));
    } catch (error) {
      throw new Error(
        `Failed to persist to localStorage key "${this.storageKey}": ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  /** Stamps creation and modification times onto every write. */
  protected decorate(_draft: CrudDraft<T>, operation: 'create' | 'update'): CrudDraft<T> {
    const now = new Date().toISOString();
    const stamps: Timestamped = operation === 'create' ? { createdAt: now, updatedAt: now } : { updatedAt: now };
    return stamps as CrudDraft<T>;
  }
}
