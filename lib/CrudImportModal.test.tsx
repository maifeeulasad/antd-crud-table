import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import CrudImportModal from './CrudImportModal';
import type { ImportColumn } from './utils/importData';
import { enUS } from './locale/en_US';

const columns: ImportColumn[] = [
  { title: 'Name', dataIndex: 'name', fieldType: 'string', rules: [{ required: true, message: 'Name is required' }] },
  { title: 'Age', dataIndex: 'age', fieldType: 'number' },
  {
    title: 'Role',
    dataIndex: 'role',
    fieldType: 'enum',
    enumOptions: { admin: { text: 'Administrator' }, user: { text: 'User' } },
  },
  { title: 'Secret', dataIndex: 'secret', fieldType: 'password' },
];

const csvFile = (contents: string, name = 'people.csv') =>
  new File([contents], name, { type: 'text/csv' });

const uploadInput = () => document.querySelector('input[type="file"]') as HTMLInputElement;

describe('CrudImportModal', () => {
  it('parses a CSV, previews validated rows, and imports the valid ones', async () => {
    const user = userEvent.setup();
    const create = vi.fn(async (draft: Record<string, unknown>) => draft);
    const onImported = vi.fn();

    render(
      <CrudImportModal
        open
        columns={columns}
        formats={['csv']}
        sink={{ create }}
        locale={enUS}
        onImported={onImported}
        onClose={() => {}}
      />,
    );

    // A valid row and a row missing the required name.
    const csv = 'Name,Age,Role,Secret\nAlice,30,Administrator,hunter2\n,20,User,x';
    await user.upload(uploadInput(), csvFile(csv));

    // Summary reflects 1 valid, 1 to skip.
    await waitFor(() => expect(screen.getByText(enUS.importSummary(1, 1))).toBeTruthy());
    // The invalid row surfaces its validation message.
    expect(screen.getByText('Name is required')).toBeTruthy();

    // Import the valid row.
    await user.click(screen.getByRole('button', { name: enUS.importRun }));

    await waitFor(() => expect(create).toHaveBeenCalledTimes(1));
    expect(create).toHaveBeenCalledWith({ name: 'Alice', age: 30, role: 'admin' });
    // Password column is never imported.
    expect(create.mock.calls[0][0]).not.toHaveProperty('secret');
    expect(onImported).toHaveBeenCalledWith({ created: 1, invalid: 1, failed: 0 });
  });
});
