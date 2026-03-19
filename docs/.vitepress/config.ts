import { defineConfig } from 'vitepress';

const title = 'React MobX Manager';
const description = 'MobX store manager for React with relative, parent and global stores.';

export default defineConfig({
  title,
  description,
  base: '/react-mobx-manager/',
  cleanUrls: true,
  lastUpdated: true,
  sitemap: {
    hostname: 'https://lomray-software.github.io/react-mobx-manager/',
  },
  themeConfig: {
    nav: [
      { text: 'Guide', link: '/guide/getting-started' },
      { text: 'API', link: '/api/manager' },
      { text: 'Examples', link: '/examples/recipes' },
      { text: 'AI Usage', link: '/ai-usage' },
      {
        text: 'GitHub',
        link: 'https://github.com/Lomray-Software/react-mobx-manager',
      },
    ],
    search: {
      provider: 'local',
    },
    sidebar: [
      {
        text: 'Guide',
        items: [
          { text: 'Introduction', link: '/' },
          { text: 'Getting Started', link: '/guide/getting-started' },
          { text: 'Core Concepts', link: '/guide/core-concepts' },
          { text: 'Lifecycle', link: '/guide/lifecycle' },
          { text: 'Component Props', link: '/guide/component-props' },
          { text: 'SSR', link: '/guide/ssr' },
          { text: 'HMR', link: '/guide/hmr' },
        ],
      },
      {
        text: 'API',
        items: [
          { text: 'Manager', link: '/api/manager' },
          { text: 'withStores', link: '/api/with-stores' },
          { text: 'Helpers', link: '/api/helpers' },
        ],
      },
      {
        text: 'Examples',
        items: [
          { text: 'Recipes', link: '/examples/recipes' },
        ],
      },
      {
        text: 'Reference',
        items: [
          { text: 'AI Usage', link: '/ai-usage' },
          { text: 'Talking Points', link: '/reference/talking-points' },
          { text: 'Useful Links', link: '/reference/useful-links' },
        ],
      },
    ],
    socialLinks: [
      { icon: 'github', link: 'https://github.com/Lomray-Software/react-mobx-manager' },
    ],
    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © Lomray Software',
    },
  },
});
