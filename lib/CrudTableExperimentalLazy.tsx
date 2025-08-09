import { Suspense, lazy } from 'react';
import type { EnhancedCrudTableConfig, DataType } from './CrudTableExperimental';

const CrudTableExperimental = lazy(() => import('./CrudTableExperimental'));

const CrudTableExperimentalLazy = <T extends DataType>(props: EnhancedCrudTableConfig<T>) => {
  return (
    <Suspense
      fallback={
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          Loading curd table w antd
        </div>
      }
    >
      <CrudTableExperimental
        {...(props as any)}
      />
    </Suspense>
  );
};

export default CrudTableExperimentalLazy;
export type { EnhancedCrudTableConfig, DataType };
