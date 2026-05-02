import { h } from 'vue';
import { Theme } from 'vitepress';
import DefaultTheme from 'vitepress/theme';
import './custom.css';

export default {
  extends: DefaultTheme,
  Layout: () => {
    return h(DefaultTheme.Layout, null, {
      'home-features-after': () => h('div', 'Welcome to x-oasis documentation'),
    });
  },
  enhanceApp() {
    // app is the Vue 3 app instance from createApp()
    // router is VitePress' custom router (see `vue-router` source for details)
    // siteData is a ref of the siteData object placeholder.
  },
} as Theme;
