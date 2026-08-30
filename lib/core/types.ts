/**
 * The core data-access contract every CRUD strategy implements.
 *
 * `T` is the record shape and `K` the property holding its identity, so
 * `T[K]` is the precise type of an id throughout - never `any`, never a
 * widened `string | number`.
 */

/** Sort direction, matching the vocabulary ProTable reports. */
export type SortDirection = 'ascend' | 'descend';

/** One sort instruction. Queries carry an ordered list to support multi-sort. */
export interface CrudSort<T> {
  /** The property to order by. */
  readonly field: keyof T;
  /** Ascending or descending. */
  readonly direction: SortDirection;
}

/**
 * A value a column can be filtered by.
 *
 * Deliberately narrow: filters arrive from form inputs and query strings, so
 * this is the complete set of things a user can actually express. Anything
 * richer belongs in a custom data source.
 */
export type CrudFilterValue = string | number | boolean;

/** Field-keyed filters. Absent keys are unfiltered. */
export type CrudFilters<T> = {
  readonly [P in keyof T]?: CrudFilterValue;
};

/** A complete read request: which slice, in what order, matching what. */
export interface CrudQuery<T> {
  /** 1-based, matching ProTable's `current`. */
  readonly page: number;
  /** Rows per page. */
  readonly pageSize: number;
  /** Ordered sort instructions; earlier entries take precedence. */
  readonly sort?: readonly CrudSort<T>[];
  /** Field-keyed filters. Absent keys are unfiltered. */
  readonly filters?: CrudFilters<T>;
}

/** One page of results plus the total matching the filters (not the page size). */
export interface CrudPage<T> {
  /** The records on this page. */
  readonly items: readonly T[];
  /** Records matching the filters, across all pages. */
  readonly total: number;
}

/**
 * A record being written.
 *
 * Partial because the identity is assigned by the source on create, and an
 * update legitimately touches a subset of fields.
 */
export type CrudDraft<T> = Partial<T>;

/**
 * Produces the identity for a newly created record.
 *
 * Receives the existing records so a strategy can derive the next value
 * (max + 1, a fresh UUID, a sequence). Supplying one replaces the built-in
 * policy entirely.
 */
export type IdGenerator<T, K extends keyof T> = (existing: readonly T[]) => T[K];

/**
 * The interface every strategy implements: static fixtures, REST,
 * localStorage, or a consumer's own.
 *
 * Implementations own their storage and lifetime. They are plain objects -
 * no React involvement - so each is unit-testable without a renderer.
 */
export interface CrudDataSource<T, K extends keyof T> {
  /** Read one page. Implementations must apply filters before paginating. */
  list(query: CrudQuery<T>): Promise<CrudPage<T>>;

  /** Persist a new record and return it as stored, identity included. */
  create(draft: CrudDraft<T>): Promise<T>;

  /** Merge `draft` into the record at `id` and return the stored result. */
  update(id: T[K], draft: CrudDraft<T>): Promise<T>;

  /** Delete the record at `id`. */
  remove(id: T[K]): Promise<void>;

  /**
   * Every record matching the query, ignoring pagination.
   *
   * Exists so export can cover the whole result set rather than the current
   * page. Optional: a source over an unbounded remote collection may have no
   * safe way to honour it, and callers must degrade to `list` when absent.
   */
  listAll?(query: Omit<CrudQuery<T>, 'page' | 'pageSize'>): Promise<readonly T[]>;
}
