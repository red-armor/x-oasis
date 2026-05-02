import { defineConfig } from 'vitepress';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';

// Load auto-generated sidebar from JSON
let sidebarPackages: any[] = [];

const sidebarJsonPath = path.resolve(__dirname, 'sidebar-auto.json');
if (fs.existsSync(sidebarJsonPath)) {
  try {
    const sidebarContent = fs.readFileSync(sidebarJsonPath, 'utf-8');
    sidebarPackages = JSON.parse(sidebarContent);
  } catch (err) {
    console.warn('Failed to load auto-generated sidebar JSON:', err);
  }
}

// Fallback manual sidebar configuration (used if auto-generated sidebar doesn't exist)
const fallbackSidebar = [
  {
    text: 'Overview',
    items: [{ text: 'All Packages', link: '/packages/' }],
  },
  {
    text: 'Assertion',
    items: [
      { text: 'Overview', link: '/packages/assertion/' },
      { text: 'is-empty', link: '/packages/assertion/is-empty/' },
      { text: 'is-null', link: '/packages/assertion/is-null/' },
      { text: 'is-object', link: '/packages/assertion/is-object/' },
      { text: 'is-function', link: '/packages/assertion/is-function/' },
      { text: 'is-promise', link: '/packages/assertion/is-promise/' },
      { text: 'is-class', link: '/packages/assertion/is-class/' },
      { text: 'is-primitive', link: '/packages/assertion/is-primitive/' },
      {
        text: 'is-primitive-empty',
        link: '/packages/assertion/is-primitive-empty/',
      },
      { text: 'is-nan', link: '/packages/assertion/is-nan/' },
      { text: 'is-ascii', link: '/packages/assertion/is-ascii/' },
    ],
  },
  {
    text: 'Async',
    items: [
      { text: 'Overview', link: '/packages/async/' },
      { text: 'async-call-rpc', link: '/packages/async/async-call-rpc/' },
      {
        text: 'Middleware',
        items: [
          {
            text: 'Overview',
            link: '/packages/async/async-call-rpc/middleware/overview',
          },
          {
            text: 'Sender Pipeline',
            link: '/packages/async/async-call-rpc/middleware/sender-pipeline',
          },
          {
            text: 'Receiver Pipeline',
            link: '/packages/async/async-call-rpc/middleware/receiver-pipeline',
          },
          {
            text: 'Custom Middleware',
            link: '/packages/async/async-call-rpc/middleware/custom-middleware',
          },
        ],
      },
      { text: 'Examples', link: '/packages/async/async-call-rpc/examples' },
      { text: 'API Reference', link: '/packages/async/async-call-rpc/api' },
      {
        text: 'async-call-rpc-web',
        link: '/packages/async/async-call-rpc-web/',
      },
      {
        text: 'async-call-rpc-node',
        link: '/packages/async/async-call-rpc-node/',
      },
      {
        text: 'async-call-rpc-electron',
        link: '/packages/async/async-call-rpc-electron/',
      },
      {
        text: 'async-call-rpc-react',
        link: '/packages/async/async-call-rpc-react/',
      },
    ],
  },
  {
    text: 'Comparison',
    items: [
      { text: 'Overview', link: '/packages/comparison/' },
      { text: 'shallow-equal', link: '/packages/comparison/shallow-equal/' },
      {
        text: 'shallow-array-equal',
        link: '/packages/comparison/shallow-array-equal/',
      },
      { text: 'clamp', link: '/packages/comparison/clamp/' },
      { text: 'is-clamped', link: '/packages/comparison/is-clamped/' },
      {
        text: 'resolve-changed',
        link: '/packages/comparison/resolve-changed/',
      },
    ],
  },
  {
    text: 'CSS',
    items: [
      { text: 'Overview', link: '/packages/css/' },
      { text: 'color', link: '/packages/css/color/' },
    ],
  },
  {
    text: 'Diff',
    items: [
      { text: 'Overview', link: '/packages/diff/' },
      { text: 'diff-match-patch', link: '/packages/diff/diff-match-patch/' },
      {
        text: 'html-fragment-diff',
        link: '/packages/diff/html-fragment-diff/',
      },
      { text: 'map-diff-range', link: '/packages/diff/map-diff-range/' },
      { text: 'diff-tag', link: '/packages/diff/diff-tag/' },
      { text: 'git-diff', link: '/packages/diff/git-diff/' },
      { text: 'operation-delete', link: '/packages/diff/operation-delete/' },
    ],
  },
  {
    text: 'Dimension',
    items: [
      { text: 'Overview', link: '/packages/dimension/' },
      { text: 'layout-equal', link: '/packages/dimension/layout-equal/' },
      { text: 'select-value', link: '/packages/dimension/select-value/' },
    ],
  },
  {
    text: 'DOM',
    items: [
      { text: 'Overview', link: '/packages/dom/' },
      { text: 'bind-events', link: '/packages/dom/bind-events/' },
      { text: 'env', link: '/packages/dom/env/' },
      {
        text: 'find-parent-element',
        link: '/packages/dom/find-parent-element/',
      },
      { text: 'in-bounding-box', link: '/packages/dom/in-bounding-box/' },
    ],
  },
  {
    text: 'Error',
    items: [
      { text: 'Overview', link: '/packages/error/' },
      { text: 'invariant', link: '/packages/error/invariant/' },
      { text: 'log', link: '/packages/error/log/' },
      { text: 'null-throw', link: '/packages/error/null-throw/' },
    ],
  },
  {
    text: 'Event',
    items: [
      { text: 'Overview', link: '/packages/event/' },
      { text: 'emitter', link: '/packages/event/emitter/' },
      { text: 'disposable', link: '/packages/event/disposable/' },
    ],
  },
  {
    text: 'Functional',
    items: [
      { text: 'Overview', link: '/packages/functional/' },
      { text: 'each', link: '/packages/functional/each/' },
      {
        text: 'find-last-index',
        link: '/packages/functional/find-last-index/',
      },
      {
        text: 'get-map-key-by-value',
        link: '/packages/functional/get-map-key-by-value/',
      },
      { text: 'group-by', link: '/packages/functional/group-by/' },
      { text: 'omit', link: '/packages/functional/omit/' },
      {
        text: 'unique-array-object',
        link: '/packages/functional/unique-array-object/',
      },
    ],
  },
  {
    text: 'IoC',
    items: [
      { text: 'Overview', link: '/packages/ioc/' },
      { text: 'di', link: '/packages/ioc/di/' },
    ],
  },
  {
    text: 'Misc',
    items: [
      { text: 'Overview', link: '/packages/misc/' },
      { text: 'capitalize', link: '/packages/misc/capitalize/' },
      { text: 'default-value', link: '/packages/misc/default-value/' },
      {
        text: 'default-number-value',
        link: '/packages/misc/default-number-value/',
      },
      {
        text: 'default-boolean-value',
        link: '/packages/misc/default-boolean-value/',
      },
      { text: 'id', link: '/packages/misc/id/' },
      { text: 'noop', link: '/packages/misc/noop/' },
      { text: 'return-hook', link: '/packages/misc/return-hook/' },
    ],
  },
  {
    text: 'Promise',
    items: [
      { text: 'Overview', link: '/packages/promise/' },
      { text: 'deferred', link: '/packages/promise/deferred/' },
    ],
  },
  {
    text: 'Proto',
    items: [
      { text: 'Overview', link: '/packages/proto/' },
      { text: 'inherit', link: '/packages/proto/inherit/' },
      {
        text: 'create-hidden-property',
        link: '/packages/proto/create-hidden-property/',
      },
      { text: 'hide-property', link: '/packages/proto/hide-property/' },
      { text: 'own-keys', link: '/packages/proto/own-keys/' },
      { text: 'to-string', link: '/packages/proto/to-string/' },
      { text: 'can-i-use-proxy', link: '/packages/proto/can-i-use-proxy/' },
    ],
  },
  {
    text: 'Schedule',
    items: [
      { text: 'Overview', link: '/packages/schedule/' },
      { text: 'debounce', link: '/packages/schedule/debounce/' },
      { text: 'throttle', link: '/packages/schedule/throttle/' },
      { text: 'batchinator', link: '/packages/schedule/batchinator/' },
      { text: 'batchinate-last', link: '/packages/schedule/batchinate-last/' },
    ],
  },
  {
    text: 'Stream',
    items: [
      { text: 'Overview', link: '/packages/stream/' },
      { text: 'event-stream', link: '/packages/stream/event-stream/' },
      { text: 'push-stream', link: '/packages/stream/push-stream/' },
      { text: 'web-stream', link: '/packages/stream/web-stream/' },
    ],
  },
  {
    text: 'Struct',
    items: [
      { text: 'Overview', link: '/packages/struct/' },
      { text: 'heap', link: '/packages/struct/heap/' },
      {
        text: 'prefix-interval-tree',
        link: '/packages/struct/prefix-interval-tree/',
      },
      {
        text: 'integer-buffer-set',
        link: '/packages/struct/integer-buffer-set/',
      },
      { text: 'recycler', link: '/packages/struct/recycler/' },
    ],
  },
];

// Use auto-generated sidebar if available, otherwise use fallback
const packagesSidebar =
  sidebarPackages.length > 0 ? sidebarPackages : fallbackSidebar;

export default defineConfig({
  title: 'x-oasis',
  description:
    '63 practical JavaScript/TypeScript utility packages organized into 17 categories',
  theme: 'light',
  ignoreDeadLinks: true,

  vite: {
    plugins: [react()],
  },

  themeConfig: {
    logo: '/logo.svg',

    nav: [
      { text: 'Home', link: '/' },
      { text: 'Packages', link: '/packages/' },
      { text: 'Skills', link: '/skills/' },
      { text: 'GitHub', link: 'https://github.com/red-armor/x-oasis' },
    ],

    sidebar: {
      '/packages/': packagesSidebar,
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/red-armor/x-oasis' },
    ],

    footer: {
      message: 'MIT Licensed',
      copyright: 'Copyright © 2024 x-oasis contributors',
    },

    search: {
      provider: 'local',
    },
  },
});
