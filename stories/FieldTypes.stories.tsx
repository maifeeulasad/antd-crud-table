import type { Meta, StoryObj } from '@storybook/react-vite';

import CrudTable from '../lib/CrudTable';
import type { CrudColumn } from '../lib/CrudTable';
import { fieldRegistry } from '../lib/fields/registry';
import type { FieldType } from '../lib/fields/registry';

/**
 * One row shape carrying a representative value for every field type, so each
 * story renders the same record through a different column definition.
 */
interface Sample {
  id: number;
  string: string;
  number: number;
  date: string;
  boolean: boolean;
  enum: string;
  textarea: string;
  email: string;
  url: string;
  password: string;
  money: number;
  percent: number;
  rating: number;
  progress: number;
  time: string;
  dateRange: [string, string];
  tags: string[];
  image: string;
  color: string;
  json: Record<string, unknown>;
  custom: number;
}

const rows: Sample[] = [
  {
    id: 1,
    string: 'Aurora Desk Lamp',
    number: 1234567,
    date: '2024-03-05T10:30:00.000Z',
    boolean: true,
    enum: 'active',
    textarea: 'A dimmable desk lamp with a warm-to-cool spectrum.',
    email: 'aurora@example.com',
    url: 'https://example.com/aurora',
    password: 'hunter2',
    money: 89.99,
    percent: 42,
    rating: 4.5,
    progress: 72,
    time: '14:25:00',
    dateRange: ['2024-01-01T00:00:00.000Z', '2024-02-01T00:00:00.000Z'],
    tags: ['lighting', 'desk'],
    image: 'https://placehold.co/96x96/png',
    color: '#1677ff',
    json: { warranty: '2y', dimmable: true },
    custom: 3,
  },
  {
    id: 2,
    string: 'Nimbus Monitor Arm',
    number: 42,
    date: '2023-11-20T08:15:00.000Z',
    boolean: false,
    enum: 'inactive',
    textarea: 'A gas-spring arm with a 9 kg load rating.',
    email: 'nimbus@example.com',
    url: 'https://example.com/nimbus',
    password: 'correct-horse',
    money: 149.5,
    percent: 8,
    rating: 3,
    progress: 15,
    time: '09:05:00',
    dateRange: ['2024-04-10T00:00:00.000Z', '2024-05-10T00:00:00.000Z'],
    tags: ['ergonomics'],
    image: 'https://placehold.co/96x96/png',
    color: '#52c41a',
    json: { warranty: '5y', dimmable: false },
    custom: 1,
  },
];

const enumOptions = {
  active: { text: 'Active', color: 'green' },
  inactive: { text: 'Inactive', color: 'red' },
};

/** The column definition each field-type story renders. */
const columnFor = (type: FieldType): CrudColumn<Sample> => {
  const base = {
    dataIndex: type as keyof Sample,
    title: type,
    fieldType: type,
  } as CrudColumn<Sample>;

  if (type === 'enum') return { ...base, enumOptions } as CrudColumn<Sample>;
  if (type === 'custom') {
    return {
      ...base,
      customRender: (value) => <strong>{'★'.repeat(Number(value) || 0)}</strong>,
    } as CrudColumn<Sample>;
  }
  return base;
};

const meta = {
  title: 'Field types',
  component: CrudTable,
  parameters: {
    docs: {
      description: {
        component:
          'Every column type the field registry understands. Each story renders the same ' +
          'records through one field type, showing its cell renderer and the control it ' +
          'uses in the create/edit form.',
      },
    },
  },
} satisfies Meta<typeof CrudTable>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Builds a story rendering a single field type beside its identifying column. */
const storyFor = (type: FieldType): Story =>
  ({
    name: type,
    render: () => (
      <CrudTable<Sample, 'id'>
        title={`${type} column`}
        rowKey="id"
        defaultPageSize={5}
        columns={[
          { dataIndex: 'string', title: 'Product', fieldType: 'string' },
          columnFor(type),
        ]}
        hookConfig={{ staticData: rows }}
      />
    ),
  }) as Story;

// One story per registry entry. Adding a field type adds a story for free.
const [
  StringType, NumberType, DateType, BooleanType, EnumType, CustomType,
  TextareaType, EmailType, UrlType, PasswordType, MoneyType, PercentType,
  RatingType, ProgressType, TimeType, DateRangeType, TagsType, ImageType,
  ColorType, JsonType,
] = (Object.keys(fieldRegistry) as FieldType[]).map(storyFor);

export {
  StringType, NumberType, DateType, BooleanType, EnumType, CustomType,
  TextareaType, EmailType, UrlType, PasswordType, MoneyType, PercentType,
  RatingType, ProgressType, TimeType, DateRangeType, TagsType, ImageType,
  ColorType, JsonType,
};
