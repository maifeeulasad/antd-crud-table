import { Suspense, lazy, type ComponentType } from 'react';
import type { CrudTableConfig, DataType } from './CrudTable';

// React.lazy erases generics, so restore the component signature once here
// instead of casting props at every call site
const CrudTable = lazy(() => import('./CrudTable')) as ComponentType<CrudTableConfig<any>>;

const CrudTableLazy = <T extends DataType>(props: CrudTableConfig<T>) => {
  return (
    <Suspense
      fallback={
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          Loading CRUD table…
        </div>
      }
    >
      <CrudTable {...props} />
    </Suspense>
  );
};

export default CrudTableLazy;
export type { CrudTableConfig, DataType };
