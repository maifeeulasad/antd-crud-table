import { queryRecords } from './inMemoryQuery';
import { defaultIdGenerator } from './identity';
import type { CrudDataSource, CrudDraft, CrudPage, CrudQuery, IdGenerator } from './types';
import { filterRecords, sortRecords } from './inMemoryQuery';

/**
 * Shared behaviour for every source backed by a local collection.
 *
 * Subclasses supply only where the records live, via `read`/`write`. All
 * querying, identity assignment and mutation semantics are defined once here
 * so the static and localStorage strategies cannot drift apart.
 */
export abstract class InMemoryDataSource<T extends object, K extends keyof T>
  implements CrudDataSource<T, K>
{
  /** The property holding each record's identity. */
  protected readonly key: K;
  /** Assigns the identity for newly created records. */
  protected readonly generateId: IdGenerator<T, K>;

  protected constructor(key: K, generateId?: IdGenerator<T, K>) {
    this.key = key;
    this.generateId = generateId ?? defaultIdGenerator<T, K>(key);
  }

  /** Current contents of the backing collection. */
  protected abstract read(): readonly T[];

  /** Replace the backing collection. */
  protected abstract write(records: readonly T[]): void;

  /**
   * Hook for values a subclass stamps onto every write, such as timestamps.
   * Returns nothing extra by default.
   */
  protected decorate(_record: CrudDraft<T>, _operation: 'create' | 'update'): CrudDraft<T> {
    return {};
  }

  private indexOf(id: T[K]): number {
    return this.read().findIndex((record) => record[this.key] === id);
  }

  async list(query: CrudQuery<T>): Promise<CrudPage<T>> {
    return queryRecords(this.read(), query);
  }

  async listAll(query: Omit<CrudQuery<T>, 'page' | 'pageSize'>): Promise<readonly T[]> {
    return sortRecords(filterRecords(this.read(), query.filters), query.sort);
  }

  async create(draft: CrudDraft<T>): Promise<T> {
    const records = this.read();
    const record = {
      [this.key]: this.generateId(records),
      ...draft,
      ...this.decorate(draft, 'create'),
    } as T;

    this.write([...records, record]);
    return record;
  }

  async update(id: T[K], draft: CrudDraft<T>): Promise<T> {
    const records = this.read();
    const index = this.indexOf(id);
    if (index === -1) throw new Error(`No record with ${String(this.key)} "${String(id)}"`);

    // The identity is never taken from the draft: allowing a write to move a
    // record's key would orphan it from the id the caller is updating.
    const updated = {
      ...records[index],
      ...draft,
      ...this.decorate(draft, 'update'),
      [this.key]: id,
    } as T;

    const next = [...records];
    next[index] = updated;
    this.write(next);
    return updated;
  }

  async remove(id: T[K]): Promise<void> {
    const records = this.read();
    if (this.indexOf(id) === -1) throw new Error(`No record with ${String(this.key)} "${String(id)}"`);
    this.write(records.filter((record) => record[this.key] !== id));
  }
}
