import { Suspense, lazy } from 'react';
import type { ReactElement } from 'react';

import type { CrudTableConfig } from './CrudTable';

/** The generic signature `React.lazy` erases. */
type CrudTableComponent = <T extends object, K extends keyof T>(
  props: CrudTableConfig<T, K>,
) => ReactElement;

/**
 * `lazy` widens the component to a non-generic `LazyExoticComponent`, so the
 * signature is restored once here rather than casting props at every call site.
 */
const LazyCrudTable = lazy(() => import('./CrudTable')) as unknown as CrudTableComponent;

/** Code-split `CrudTable`, keeping the same typed configuration. */
const CrudTableLazy = <T extends object, K extends keyof T>(props: CrudTableConfig<T, K>) => (
  <Suspense
    fallback={<div style={{ textAlign: 'center', padding: '2rem' }}>Loading CRUD table…</div>}
  >
    <LazyCrudTable {...props} />
  </Suspense>
);

export default CrudTableLazy;
export type { CrudTableConfig };
