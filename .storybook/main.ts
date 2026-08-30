import type { StorybookConfig } from '@storybook/react-vite';

const config: StorybookConfig = {
  stories: ['../stories/**/*.stories.@(ts|tsx)'],
  framework: {
    name: '@storybook/react-vite',
    options: {},
  },
  core: {
    // A library's build should not phone home on a contributor's machine.
    disableTelemetry: true,
  },
  // Served from a subdirectory of the deployed site, alongside the demo at the
  // root and the API reference at /api.
  viteFinal: async (viteConfig) => ({
    ...viteConfig,
    base: process.env.STORYBOOK_BASE ?? '/',
  }),
};

export default config;
