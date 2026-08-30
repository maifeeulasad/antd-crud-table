import { InMemoryDataSource } from './InMemoryDataSource';
import type { IdGenerator } from './types';

/**
 * A source over an in-process array, for fixtures, demos and tests.
 *
 * The collection is instance state, seeded once from the array passed to the
 * constructor and never re-read from it. That is the fix for the old
 * closure-factory behaviour: identity of the caller's array no longer
 * controls the dataset's lifetime, so passing an inline literal from a
 * component no longer discards every created and edited row when the parent
 * happens to re-render.
 *
 * The seed array is copied, so mutations never write back to the caller's data.
 */
export class StaticDataSource<T extends object, K extends keyof T> extends InMemoryDataSource<T, K> {
  private records: readonly T[];

  constructor(seed: readonly T[], key: K, generateId?: IdGenerator<T, K>) {
    super(key, generateId);
    this.records = [...seed];
  }

  protected read(): readonly T[] {
    return this.records;
  }

  protected write(records: readonly T[]): void {
    this.records = records;
  }
}
