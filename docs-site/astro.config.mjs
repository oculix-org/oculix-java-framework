// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

// https://astro.build/config
export default defineConfig({
  site: 'https://oculix-org.github.io',
  base: '/oculix-java-framework',
  trailingSlash: 'ignore',

  integrations: [
    starlight({
      title: 'OculiX Java Framework',
      description:
        'Java framework on top of OculiX — Manager-based wrappers, page-object friendly.',

      logo: {
        src: './src/assets/logo.svg',
        replacesTitle: false,
      },

      favicon: '/favicon.svg',

      social: [
        {
          icon: 'github',
          label: 'GitHub',
          href: 'https://github.com/oculix-org/oculix-java-framework',
        },
      ],

      editLink: {
        baseUrl:
          'https://github.com/oculix-org/oculix-java-framework/edit/main/docs-site/',
      },

      lastUpdated: true,

      sidebar: [
        {
          label: 'Start here',
          items: [
            { label: 'Overview', link: '/overview/' },
            { label: 'Getting started', link: '/getting-started/' },
            { label: 'Architecture', link: '/architecture/' },
          ],
        },
        {
          label: 'Managers',
          items: [
            { label: 'ScreenOperationsManager', link: '/managers/screen-operations/' },
            { label: 'ClickManager', link: '/managers/clicking/' },
            { label: 'TypeManager', link: '/managers/typing/' },
            { label: 'WaitManager', link: '/managers/waiting/' },
            { label: 'OCRManager', link: '/managers/ocr/' },
            { label: 'RegionManager', link: '/managers/regions/' },
            { label: 'CaptureManager', link: '/managers/captures/' },
          ],
        },
        {
          label: 'Patterns',
          items: [
            { label: 'Page-object pattern', link: '/patterns/page-object/' },
            { label: 'Parallel VNC sessions', link: '/patterns/parallel-vnc/' },
            { label: 'PaddleOCR setup', link: '/patterns/paddleocr-setup/' },
          ],
        },
        {
          label: 'Reference',
          items: [
            { label: 'Troubleshooting', link: '/reference/troubleshooting/' },
            { label: 'Cookbook', link: '/reference/cookbook/' },
          ],
        },
      ],

      customCss: ['./src/styles/custom.css'],
    }),
  ],
});
