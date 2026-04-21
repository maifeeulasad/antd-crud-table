import { Suspense, lazy } from 'react';
import type { CrudTableConfig, DataType } from './CrudTable';

const CrudTable = lazy(() => import('./CrudTable'));

const CrudTableLazy = <T extends DataType>(props: CrudTableConfig<T>) => {
  return (
    <Suspense
      fallback={
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          Loading curd table w antd
        </div>
      }
    >
      <CrudTable
        {...(props as any)}
      />
    </Suspense>
  );
};

export default CrudTableLazy;
export type { CrudTableConfig, DataType };