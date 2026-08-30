import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConfigProvider } from 'antd';
import frFR from 'antd/locale/fr_FR';
import deDE from 'antd/locale/de_DE';

import CrudTable from '../CrudTable';
import type { CrudColumn } from '../CrudTable';
import { enUS } from './en_US';

interface User {
  id: number;
  name: string;
}

const rows: User[] = [
  { id: 1, name: 'Alice' },
  { id: 2, name: 'Bob' },
];

const columns: CrudColumn<User>[] = [
  { dataIndex: 'name', title: 'Name', fieldType: 'string', formConfig: { required: true } },
];

/**
 * The most recently opened dialog.
 *
 * `Modal` and `Modal.confirm` mount roots outside the tree Testing Library
 * manages and close with an animation, so a dialog from an earlier test can
 * still be in the document. Taking the last match targets this test's own.
 */
const latestDialog = async (): Promise<HTMLElement> => {
  const dialogs = await screen.findAllByRole('dialog');
  return dialogs[dialogs.length - 1];
};

const table = (props: Partial<Parameters<typeof CrudTable<User, 'id'>>[0]> = {}) => (
  <CrudTable<User, 'id'>
    title="Users"
    rowKey="id"
    columns={columns}
    hookConfig={{ staticData: rows }}
    {...props}
  />
);

describe('default locale, with no ConfigProvider', () => {
  // The regression this exists for: rendered outside a ConfigProvider, antd's
  // own components fall back to their built-in defaults, which are Chinese.
  // ProTable's intl does not feed them, so the table showed English chrome
  // beside Chinese pagination and modal buttons.
  it('renders antd chrome in English', async () => {
    render(table());
    await screen.findByText('Alice');

    const body = document.body.textContent ?? '';
    expect(body).not.toMatch(/[一-鿿]/);
  });

  it('labels the library chrome in English', async () => {
    render(table());
    await screen.findByText('Alice');

    expect(screen.getByText('Actions')).toBeDefined();
    expect(screen.getAllByRole('button', { name: 'Edit' }).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /New/ })).toBeDefined();
  });

  it('labels the modal footer in English', async () => {
    const user = userEvent.setup();
    render(table());
    await screen.findByText('Alice');

    await user.click(screen.getByRole('button', { name: /New/ }));
    const dialog = await latestDialog();

    expect(within(dialog).getByRole('button', { name: 'OK' })).toBeDefined();
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toBeDefined();
  });
});

describe('inheriting a ConfigProvider locale', () => {
  it('follows the app locale for antd chrome instead of forcing English', async () => {
    render(<ConfigProvider locale={frFR}>{table()}</ConfigProvider>);
    await screen.findByText('Alice');

    // ProTable's search form is localised through its intl, which is derived
    // from the surrounding antd locale.
    await waitFor(() => expect(screen.getByRole('button', { name: /Rechercher/i })).toBeDefined());
  });

  it('does not override the consumer ConfigProvider', async () => {
    render(
      <ConfigProvider locale={deDE}>
        <div data-testid="host">{table()}</div>
      </ConfigProvider>,
    );
    await screen.findByText('Alice');

    await waitFor(() => expect(screen.getByRole('button', { name: /Suchen/i })).toBeDefined());
  });
});

describe('locale overrides', () => {
  it('replaces the library strings it is given', async () => {
    render(
      table({
        locale: {
          actions: 'Aktionen',
          edit: 'Bearbeiten',
          delete: 'Löschen',
          create: 'Neu',
        },
      }),
    );
    await screen.findByText('Alice');

    expect(screen.getByText('Aktionen')).toBeDefined();
    expect(screen.getAllByRole('button', { name: 'Bearbeiten' }).length).toBe(2);
    expect(screen.getByRole('button', { name: /Neu/ })).toBeDefined();
  });

  it('falls back to English for strings it is not given', async () => {
    render(table({ locale: { actions: 'Aktionen' } }));
    await screen.findByText('Alice');

    expect(screen.getByText('Aktionen')).toBeDefined();
    // Not overridden, so still the default.
    expect(screen.getAllByRole('button', { name: 'Edit' }).length).toBe(2);
  });

  it('uses overridden wording in the delete confirmation', async () => {
    const user = userEvent.setup();
    render(
      table({
        locale: {
          confirmDeleteTitle: 'Wirklich löschen?',
          confirmDeleteOk: 'Ja, löschen',
        },
      }),
    );
    await screen.findByText('Alice');

    await user.click(screen.getAllByRole('button', { name: 'Delete' })[0]);

    expect((await screen.findAllByText('Wirklich löschen?')).length).toBeGreaterThan(0);
    expect((await screen.findAllByRole('button', { name: /Ja, löschen/ })).length).toBeGreaterThan(0);
  });

  it('uses overridden wording for interpolated strings', async () => {
    const user = userEvent.setup();
    render(
      table({
        enableBulkOperations: true,
        locale: { deleteSelected: (count) => `${count} entfernen` },
      }),
    );
    await screen.findByText('Alice');

    await user.click(screen.getAllByRole('checkbox')[0]);

    expect(await screen.findByRole('button', { name: '2 entfernen' })).toBeDefined();
  });

  it('uses overridden wording for export menu entries', async () => {
    const user = userEvent.setup();
    render(table({ locale: { exportAll: (format) => `Tout exporter en ${format}` } }));
    await screen.findByText('Alice');

    await user.hover(screen.getByRole('button', { name: 'ellipsis' }));

    expect(await screen.findByText('Tout exporter en CSV')).toBeDefined();
  });

  it('uses overridden validation wording', async () => {
    const user = userEvent.setup();
    render(table({ locale: { requiredField: (label) => `${label} fehlt` } }));
    await screen.findByText('Alice');

    await user.click(screen.getByRole('button', { name: /New/ }));
    const dialog = await latestDialog();
    await user.click(within(dialog).getByRole('button', { name: 'OK' }));

    expect((await screen.findAllByText('Name fehlt')).length).toBeGreaterThan(0);
  });
});

describe('enUS default', () => {
  it('supplies every key the contract declares', () => {
    // A missing key would surface as `undefined` in the UI rather than a
    // compile error, since overrides are partial by design.
    for (const [key, value] of Object.entries(enUS)) {
      expect(value, `enUS.${key} is missing`).toBeDefined();
      expect(['string', 'function']).toContain(typeof value);
    }
  });

  it('interpolates counts and labels', () => {
    expect(enUS.requiredField('Name')).toBe('Name is required');
    expect(enUS.confirmBulkDeleteTitle(3)).toBe('Delete 3 items?');
    expect(enUS.bulkDeletePartial(6, 10, 4)).toBe('Deleted 6 of 10. 4 failed.');
    expect(enUS.exportAll('CSV')).toBe('Export all as CSV');
    expect(enUS.selectPlaceholder('Status')).toBe('Select status');
  });
});

describe('hook toasts', () => {
  it('uses the resolved locale for success messages', async () => {
    const user = userEvent.setup();
    const { message } = await import('antd');
    const success = vi.spyOn(message, 'success');

    render(table({ locale: { createSuccess: 'Créé avec succès' } }));
    await screen.findByText('Alice');

    await user.click(screen.getByRole('button', { name: /New/ }));
    const dialog = await latestDialog();
    await user.type(within(dialog).getAllByRole('textbox')[0], 'Carol');
    await user.click(within(dialog).getByRole('button', { name: 'OK' }));

    await waitFor(() => expect(success).toHaveBeenCalledWith('Créé avec succès'));
  });
});
