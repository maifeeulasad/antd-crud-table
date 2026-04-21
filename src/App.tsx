import './App.css';
import { ConfigProvider } from 'antd';
import enUS from 'antd/locale/en_US';

import LocalStorageExample from './example/LocalStorageExample';
import ApiBasedExample from './example/ApiBasedExample';
import StaticDataExample from './example/StaticDataExample';
import CustomOperationsExample from './example/CustomOperationsExample';

const App = () => (
  <ConfigProvider locale={enUS}>
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>AntD CRUD Table</h1>
        <p style={{ color: '#666', fontSize: '1.1rem' }}>
          A powerful React library for creating editable, paginated tables with form support
        </p>      
      </div>

      <LocalStorageExample />
      <StaticDataExample />
      <ApiBasedExample />
      <CustomOperationsExample />

      <div style={{ marginTop: '2rem', padding: '1rem', background: '#f5f5f5', borderRadius: '8px' }}>
        <h3>Features</h3>
        <ul>
          <li><strong>Multiple Data Sources:</strong> Static data, REST API, localStorage, IndexedDB, GraphQL</li>
          <li><strong>Field Types:</strong> String, Number, Date, Boolean, Enum, Custom</li>
          <li><strong>Operations:</strong> Create, Read, Update, Delete with validation</li>
          <li><strong>Export:</strong> CSV, JSON, XLSX support</li>
          <li><strong>Bulk Operations:</strong> Multi-select and batch delete</li>
          <li><strong>Custom Actions:</strong> Add your own row-level buttons</li>
          <li><strong>Optimistic Updates:</strong> Instant UI feedback</li>
          <li><strong>Full TypeScript:</strong> Complete type definitions</li>
        </ul>
      </div>
    </div>
  </ConfigProvider>
);

export default App;
