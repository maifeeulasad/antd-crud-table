import './../App.css';
import CrudTableLazy from '../../lib/CrudTableLazy';
import type { CrudColumn } from '../../lib/CrudTable';

interface Product {
  id: number;
  name: string;
  description: string;
  homepage: string;
  contactEmail: string;
  price: number;
  discount: number;
  rating: number;
  completion: number;
  launchTime: string;
  availability: [string, string];
  tags: string[];
  thumbnail: string;
  themeColor: string;
  metadata: Record<string, unknown>;
}

const mockProducts: Product[] = [
  {
    id: 1,
    name: 'Aurora Desk Lamp',
    description: 'A dimmable desk lamp with a warm-to-cool spectrum, designed for late night work sessions.',
    homepage: 'https://example.com/aurora',
    contactEmail: 'aurora@example.com',
    price: 89.99,
    discount: 15,
    rating: 4.5,
    completion: 80,
    launchTime: '09:30:00',
    availability: ['2026-01-01T00:00:00.000Z', '2026-06-30T00:00:00.000Z'],
    tags: ['lighting', 'desk', 'smart-home'],
    thumbnail: 'https://picsum.photos/seed/aurora/96',
    themeColor: '#faad14',
    metadata: { sku: 'AUR-001', warehouse: 'east' },
  },
  {
    id: 2,
    name: 'Borealis Keyboard',
    description: 'Low-profile mechanical keyboard with hot-swappable switches and per-key RGB.',
    homepage: 'https://example.com/borealis',
    contactEmail: 'borealis@example.com',
    price: 149.0,
    discount: 0,
    rating: 5,
    completion: 100,
    launchTime: '14:00:00',
    availability: ['2026-03-15T00:00:00.000Z', '2026-12-31T00:00:00.000Z'],
    tags: ['keyboard', 'mechanical'],
    thumbnail: 'https://picsum.photos/seed/borealis/96',
    themeColor: '#1677ff',
    metadata: { sku: 'BOR-002', warehouse: 'west' },
  },
];

const productColumns: CrudColumn<Product>[] = [
  { dataIndex: 'name', title: 'Name', fieldType: 'string', formConfig: { required: true } },
  { dataIndex: 'description', title: 'Description', fieldType: 'textarea', searchable: false },
  { dataIndex: 'homepage', title: 'Homepage', fieldType: 'url', searchable: false },
  { dataIndex: 'contactEmail', title: 'Contact', fieldType: 'email' },
  { dataIndex: 'price', title: 'Price', fieldType: 'money' },
  { dataIndex: 'discount', title: 'Discount', fieldType: 'percent', searchable: false },
  { dataIndex: 'rating', title: 'Rating', fieldType: 'rating' },
  { dataIndex: 'completion', title: 'Completion', fieldType: 'progress' },
  { dataIndex: 'launchTime', title: 'Launch Time', fieldType: 'time', searchable: false },
  { dataIndex: 'availability', title: 'Availability', fieldType: 'dateRange', searchable: false },
  { dataIndex: 'tags', title: 'Tags', fieldType: 'tags', searchable: false },
  { dataIndex: 'thumbnail', title: 'Thumbnail', fieldType: 'image' },
  { dataIndex: 'themeColor', title: 'Theme', fieldType: 'color' },
  { dataIndex: 'metadata', title: 'Metadata', fieldType: 'json' },
];

const FieldTypesShowcase = () => (
  <div style={{ marginBottom: '2rem', border: '1px solid #1677ff', padding: '1rem', borderRadius: '8px' }}>
    <h2>Example 5: Field Type Showcase</h2>
    <p style={{ color: '#666', marginBottom: '1rem' }}>
      Every extended field type in one table: textarea, url, email, money, percent,
      rating, progress, time, dateRange, tags, image, color and json.
    </p>
    <CrudTableLazy<Product>
      title="Product Catalog (All Field Types)"
      rowKey="id"
      defaultPageSize={5}
      hookConfig={{
        staticData: mockProducts,
        optimisticUpdates: true,
      }}
      columns={productColumns}
    />
  </div>
);

export default FieldTypesShowcase;
