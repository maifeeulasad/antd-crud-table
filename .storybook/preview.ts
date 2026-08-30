import type { Preview } from '@storybook/react-vite';

import '../lib/CrudTable.css';

const preview: Preview = {
  parameters: {
    controls: { expanded: true },
    layout: 'fullscreen',
  },
};

export default preview;
