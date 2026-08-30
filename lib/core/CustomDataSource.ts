import type { CrudDataSource, CrudDraft, CrudPage, CrudQuery } from './types';

/**
 * The operations a consumer may supply. Every entry is optional so a
 * read-only table need not invent write handlers it will never call.
 */
export type CrudOperations<T, K extends keyof T> = Partial<CrudDataSource<T, K>>;

/**
 * Raised when the table attempts an operation the consumer did not supply.
 *
 * Names the missing operation so the message points at the fix rather than
 * surfacing as `undefined is not a function`.
 */
export class UnsupportedOperationError extends Error {
  readonly operation: string;

  constructor(operation: string) {
    super(
      `This table's data source does not support "${operation}". ` +
        `Provide an \`${operation}\` operation to enable it.`,
    );
    this.name = 'UnsupportedOperationError';
    this.operation = operation;
  }
}

/**
 * Adapts a bag of consumer-supplied functions to the full interface.
 *
 * Exists so the rest of the library can depend on `CrudDataSource` without
 * null-checking each method at every call site; absent operations fail here
 * with a message naming what is missing.
 */
export class CustomDataSource<T extends object, K extends keyof T> implements CrudDataSource<T, K> {
  private readonly operations: CrudOperations<T, K>;

  constructor(operations: CrudOperations<T, K>) {
    this.operations = operations;
  }

  /** Whether an operation was supplied, so callers can hide unavailable UI. */
  supports(operation: keyof CrudDataSource<T, K>): boolean {
    return typeof this.operations[operation] === 'function';
  }

  async list(query: CrudQuery<T>): Promise<CrudPage<T>> {
    if (!this.operations.list) throw new UnsupportedOperationError('list');
    return this.operations.list(query);
  }

  async listAll(query: Omit<CrudQuery<T>, 'page' | 'pageSize'>): Promise<readonly T[]> {
    if (this.operations.listAll) return this.operations.listAll(query);
    throw new UnsupportedOperationError('listAll');
  }

  async create(draft: CrudDraft<T>): Promise<T> {
    if (!this.operations.create) throw new UnsupportedOperationError('create');
    return this.operations.create(draft);
  }

  async update(id: T[K], draft: CrudDraft<T>): Promise<T> {
    if (!this.operations.update) throw new UnsupportedOperationError('update');
    return this.operations.update(id, draft);
  }

  async remove(id: T[K]): Promise<void> {
    if (!this.operations.remove) throw new UnsupportedOperationError('remove');
    return this.operations.remove(id);
  }
}
