import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { message } from 'antd';

import CrudTable from './CrudTable';
import type { CrudColumn } from './CrudTable';
import { StaticDataSource } from './core';
import type { CrudDataSource, CrudPage, CrudQuery } from './core';

interface User {
  id: number;
  name: string;
  age: number;
  status: 'active' | 'inactive';
}

const seed: User[] = [
  { id: 1, name: 'Alice', age: 30, status: 'active' },
  { id: 2, name: 'Bob', age: 25, status: 'inactive' },
];

const columns: CrudColumn<User>[] = [
  { dataIndex: 'name', title: 'Name', fieldType: 'string', formConfig: { required: true } },
  { dataIndex: 'age', title: 'Age', fieldType: 'number' },
  {
    dataIndex: 'status',
    title: 'Status',
    fieldType: 'enum',
    enumOptions: { active: { text: 'Active' }, inactive: { text: 'Inactive' } },
  },
];

/** Records the queries a table issues, so request shaping can be asserted. */
const spySource = (base?: CrudDataSource<User, 'id'>) => {
  const inner = base ?? new StaticDataSource<User, 'id'>(seed, 'id');
  const queries: CrudQuery<User>[] = [];
  const source: CrudDataSource<User, 'id'> = {
    list: async (query): Promise<CrudPage<User>> => {
      queries.push(query);
      return inner.list(query);
    },
    create: (draft) => inner.create(draft),
    update: (id, draft) => inner.update(id, draft),
    remove: (id) => inner.remove(id),
  };
  return { source, queries };
};

const renderTable = (config: Partial<Parameters<typeof CrudTable<User, 'id'>>[0]> = {}) =>
  render(
    <CrudTable<User, 'id'>
      title="Users"
      rowKey="id"
      columns={columns}
      hookConfig={{ staticData: seed }}
      {...config}
    />,
  );

// antd's message is a global singleton whose toasts outlive the test that
// raised them, so it is asserted through the API rather than the DOM.
vi.mock('antd', async () => {
  const actual = await vi.importActual<typeof import('antd')>('antd');
  return {
    ...actual,
    message: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
  };
});

beforeEach(() => vi.clearAllMocks());

/**
 * The most recently opened confirmation dialog's action button.
 *
 * `Modal.confirm` is a static call mounting its own root outside the tree
 * Testing Library manages, and `Modal.destroyAll` closes with an animation
 * rather than detaching synchronously, so a dialog from an earlier test can
 * still be in the document. Taking the last match targets this test's dialog
 * regardless of what is left over.
 */
const confirmButton = async (name: RegExp): Promise<HTMLElement> => {
  const buttons = await screen.findAllByRole('button', { name });
  return buttons[buttons.length - 1];
};

describe('CrudTable rendering', () => {
  it('renders the rows returned by the data source', async () => {
    renderTable();
    expect(await screen.findByText('Alice')).toBeDefined();
    expect(screen.getByText('Bob')).toBeDefined();
  });

  it('renders the title and an action column per row', async () => {
    renderTable();
    await screen.findByText('Alice');

    expect(screen.getByText('Users')).toBeDefined();
    // Rows stream in; under coverage instrumentation the second can arrive a
    // tick after the first, so this waits rather than sampling once.
    await waitFor(() =>
      expect(screen.getAllByRole('button', { name: 'Edit' })).toHaveLength(2),
    );
    expect(screen.getAllByRole('button', { name: 'Delete' })).toHaveLength(2);
  });

  it('appends custom actions after the built-in ones', async () => {
    renderTable({
      customActions: (record) => [<button key="x">ping {record.name}</button>],
    });
    expect(await screen.findByText('ping Alice')).toBeDefined();
  });
});

// #33: the flag was declared but never read, so the controls were always on.
describe('CrudTable toolbar flags', () => {
  it('shows the column settings control by default', async () => {
    renderTable();
    await screen.findByText('Alice');
    expect(screen.getByLabelText('setting')).toBeDefined();
  });

  it('hides the column settings control when disabled', async () => {
    renderTable({ enableColumnSettings: false });
    await screen.findByText('Alice');
    expect(screen.queryByLabelText('setting')).toBeNull();
  });

  it('omits export entries when export is disabled', async () => {
    const user = userEvent.setup();
    renderTable({ enableExport: false });
    await screen.findByText('Alice');

    await user.hover(screen.getByRole('button', { name: 'ellipsis' }));

    expect(await screen.findByText('Refresh')).toBeDefined();
    expect(screen.queryByText('Export CSV')).toBeNull();
  });

  it('offers export entries when export is enabled', async () => {
    const user = userEvent.setup();
    renderTable();
    await screen.findByText('Alice');

    await user.hover(screen.getByRole('button', { name: 'ellipsis' }));

    expect(await screen.findByText('Export CSV')).toBeDefined();
    expect(screen.getByText('Export JSON')).toBeDefined();
  });
});

// #30: params were spread after filters, so a searchable+filterable column
// silently lost its filter.
describe('CrudTable request shaping', () => {
  it('requests the first page with the configured size', async () => {
    const { source, queries } = spySource();
    renderTable({ hookConfig: { dataSource: source }, defaultPageSize: 5 });

    await screen.findByText('Alice');
    expect(queries[0]).toMatchObject({ page: 1, pageSize: 5 });
  });

  it('passes search values through as typed filters', async () => {
    const user = userEvent.setup();
    const { source, queries } = spySource();
    renderTable({ hookConfig: { dataSource: source } });
    await screen.findByText('Alice');

    await user.type(screen.getByLabelText('Name'), 'Ali');
    await user.click(screen.getByRole('button', { name: 'Query' }));

    await waitFor(() => expect(queries.at(-1)?.filters).toMatchObject({ name: 'Ali' }));
  });

  it('does not forward keys that have no declared column', async () => {
    const user = userEvent.setup();
    const { source, queries } = spySource();
    renderTable({ hookConfig: { dataSource: source } });
    await screen.findByText('Alice');

    await user.click(screen.getByRole('button', { name: 'Query' }));

    await waitFor(() => expect(queries.length).toBeGreaterThan(1));
    for (const key of Object.keys(queries.at(-1)?.filters ?? {})) {
      expect(['name', 'age', 'status']).toContain(key);
    }
  });
});

// #25: the list path swallowed its error, so onError never fired for the
// load, pagination, sorting or search.
describe('CrudTable error reporting', () => {
  const failing: CrudDataSource<User, 'id'> = {
    list: async () => {
      throw new Error('backend unavailable');
    },
    create: async () => seed[0],
    update: async () => seed[0],
    remove: async () => undefined,
  };

  it('reports a failed initial load through onError', async () => {
    const onError = vi.fn();
    renderTable({ hookConfig: { dataSource: failing, onError } });

    await waitFor(() => expect(onError).toHaveBeenCalledWith('list', expect.any(Error)));
  });

  it('passes the original error, not a generic string', async () => {
    const onError = vi.fn();
    renderTable({ hookConfig: { dataSource: failing, onError } });

    await waitFor(() => expect(onError).toHaveBeenCalled());
    expect(onError.mock.calls[0][1].message).toBe('backend unavailable');
  });
});

describe('CrudTable create and edit', () => {
  it('opens an empty form from the New button', async () => {
    const user = userEvent.setup();
    renderTable();
    await screen.findByText('Alice');

    await user.click(screen.getByRole('button', { name: /New/ }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Create Item')).toBeDefined();
  });

  it('prefills the form when editing an existing record', async () => {
    const user = userEvent.setup();
    renderTable();
    await screen.findByText('Alice');

    await user.click(screen.getAllByRole('button', { name: 'Edit' })[0]);

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Edit Item')).toBeDefined();
    await waitFor(() =>
      expect(within(dialog).getByRole('textbox')).toHaveProperty('value', 'Alice'),
    );
  });

  it('blocks submission when a required field is empty', async () => {
    const user = userEvent.setup();
    const { source } = spySource();
    const create = vi.spyOn(source, 'create');
    renderTable({ hookConfig: { dataSource: source } });
    await screen.findByText('Alice');

    await user.click(screen.getByRole('button', { name: /New/ }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'OK' }));

    expect(await screen.findByText('Name is required')).toBeDefined();
    expect(create).not.toHaveBeenCalled();
  });

  it('creates a record from the submitted form', async () => {
    const user = userEvent.setup();
    const { source } = spySource(new StaticDataSource<User, 'id'>(seed, 'id'));
    const create = vi.spyOn(source, 'create');
    renderTable({ hookConfig: { dataSource: source } });
    await screen.findByText('Alice');

    await user.click(screen.getByRole('button', { name: /New/ }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByRole('textbox'), 'Carol');
    await user.click(within(dialog).getByRole('button', { name: 'OK' }));

    await waitFor(() =>
      expect(create).toHaveBeenCalledWith(expect.objectContaining({ name: 'Carol' })),
    );
  });

  it('applies a column transform before writing', async () => {
    const user = userEvent.setup();
    const { source } = spySource(new StaticDataSource<User, 'id'>(seed, 'id'));
    const create = vi.spyOn(source, 'create');

    render(
      <CrudTable<User, 'id'>
        title="Users"
        rowKey="id"
        hookConfig={{ dataSource: source }}
        columns={[
          {
            dataIndex: 'name',
            title: 'Name',
            fieldType: 'string',
            formConfig: { transform: (value) => value.toUpperCase() as User['name'] },
          },
        ]}
      />,
    );
    await screen.findByText('Alice');

    await user.click(screen.getByRole('button', { name: /New/ }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByRole('textbox'), 'carol');
    await user.click(within(dialog).getByRole('button', { name: 'OK' }));

    await waitFor(() => expect(create).toHaveBeenCalledWith({ name: 'CAROL' }));
  });
});

// #24: the hook refreshed and the table reloaded, costing two list requests
// for every write.
describe('CrudTable request counts', () => {
  it('issues exactly one list per create', async () => {
    const user = userEvent.setup();
    const { source, queries } = spySource(new StaticDataSource<User, 'id'>(seed, 'id'));
    renderTable({ hookConfig: { dataSource: source } });
    await screen.findByText('Alice');

    const before = queries.length;

    await user.click(screen.getByRole('button', { name: /New/ }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByRole('textbox'), 'Carol');
    await user.click(within(dialog).getByRole('button', { name: 'OK' }));

    await waitFor(() => expect(queries.length).toBe(before + 1));
    // Settle, then confirm no second read arrives late.
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(queries.length).toBe(before + 1);
  });
});

// #46: ProConfigProvider's intl does not reach plain antd components, so the
// footer used to fall back to antd's default locale and render Chinese.
describe('CrudTable modal chrome', () => {
  it('labels the modal footer in English', async () => {
    const user = userEvent.setup();
    renderTable();
    await screen.findByText('Alice');

    await user.click(screen.getByRole('button', { name: /New/ }));
    const dialog = await screen.findByRole('dialog');

    expect(within(dialog).getByRole('button', { name: 'OK' })).toBeDefined();
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toBeDefined();
  });

  it('closes without writing when cancelled', async () => {
    const user = userEvent.setup();
    const { source } = spySource();
    const create = vi.spyOn(source, 'create');
    renderTable({ hookConfig: { dataSource: source } });
    await screen.findByText('Alice');

    await user.click(screen.getByRole('button', { name: /New/ }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));

    expect(create).not.toHaveBeenCalled();
  });
});

// #31: settled results were discarded, so a partly-rejected bulk delete still
// cleared the selection and reported success.
describe('CrudTable bulk delete', () => {
  /** Rejects the ids given, resolves the rest. */
  const refusing = (...refuse: number[]): CrudDataSource<User, 'id'> => {
    const inner = new StaticDataSource<User, 'id'>(seed, 'id');
    return {
      list: (query) => inner.list(query),
      create: (draft) => inner.create(draft),
      update: (id, draft) => inner.update(id, draft),
      remove: async (id) => {
        if (refuse.includes(id)) throw new Error(`refused ${id}`);
        return inner.remove(id);
      },
    };
  };

  const selectAllAndDelete = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(screen.getAllByRole('checkbox')[0]);
    await user.click(await screen.findByRole('button', { name: /Delete Selected/ }));
    await user.click(await confirmButton(/Yes, Delete All/));
  };

  it('offers bulk delete only once rows are selected', async () => {
    const user = userEvent.setup();
    renderTable({ enableBulkOperations: true });
    await screen.findByText('Alice');

    expect(screen.queryByRole('button', { name: /Delete Selected/ })).toBeNull();

    await user.click(screen.getAllByRole('checkbox')[0]);

    expect(await screen.findByRole('button', { name: /Delete Selected \(2\)/ })).toBeDefined();
  });

  it('reports partial failure with accurate counts', async () => {
    const user = userEvent.setup();
    const onError = vi.fn();
    renderTable({
      enableBulkOperations: true,
      hookConfig: { dataSource: refusing(2), onError },
    });
    await screen.findByText('Alice');

    await selectAllAndDelete(user);

    await waitFor(() =>
      expect(message.error).toHaveBeenCalledWith('Deleted 1 of 2. 1 failed.'),
    );
    expect(onError).toHaveBeenCalledWith('delete', expect.any(Error));
  });

  it('keeps failed rows selected so they can be retried', async () => {
    const user = userEvent.setup();
    renderTable({ enableBulkOperations: true, hookConfig: { dataSource: refusing(2) } });
    await screen.findByText('Alice');

    await selectAllAndDelete(user);

    // One row failed, so the bulk control stays available for exactly that row.
    expect(await screen.findByRole('button', { name: /Delete Selected \(1\)/ })).toBeDefined();
  });

  it('clears the selection when every delete succeeds', async () => {
    const user = userEvent.setup();
    renderTable({ enableBulkOperations: true, hookConfig: { dataSource: refusing() } });
    await screen.findByText('Alice');

    await selectAllAndDelete(user);

    await waitFor(() =>
      expect(screen.queryByRole('button', { name: /Delete Selected/ })).toBeNull(),
    );
  });
});

describe('CrudTable single delete', () => {
  it('asks for confirmation before deleting', async () => {
    const user = userEvent.setup();
    const { source } = spySource();
    const remove = vi.spyOn(source, 'remove');
    renderTable({ hookConfig: { dataSource: source } });
    await screen.findByText('Alice');

    await user.click(screen.getAllByRole('button', { name: 'Delete' })[0]);

    expect(await confirmButton(/Yes, Delete/)).toBeDefined();
    expect(remove).not.toHaveBeenCalled();
  });

  it('deletes the chosen record once confirmed', async () => {
    const user = userEvent.setup();
    const { source } = spySource(new StaticDataSource<User, 'id'>(seed, 'id'));
    const remove = vi.spyOn(source, 'remove');
    renderTable({ hookConfig: { dataSource: source } });
    await screen.findByText('Alice');

    await user.click(screen.getAllByRole('button', { name: 'Delete' })[0]);
    await user.click(await confirmButton(/Yes, Delete/));

    await waitFor(() => expect(remove).toHaveBeenCalledWith(1));
  });
});
