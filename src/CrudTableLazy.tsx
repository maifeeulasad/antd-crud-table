import { Suspense, lazy } from 'react';
import type { CrudTableConfig, DataType } from './CrudTable';

const CrudTable = lazy(() => import('./CrudTable'));

const CrudTableLazy = <T extends DataType>(props: CrudTableConfig<T>) => {
  const { columns, service, rowKey, title, defaultPageSize = 5 } = props;
  return (
    <Suspense
      fallback={
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          Loading curd table w antd
        </div>
      }
    >
      <CrudTable
        columns={columns as any}
        service={service as any}
        rowKey={rowKey as string}
        title={title}
        defaultPageSize={defaultPageSize}
      />
    </Suspense>
  );
};

export default CrudTableLazy;