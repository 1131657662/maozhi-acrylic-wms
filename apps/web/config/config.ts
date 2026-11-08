import { defineConfig } from '@umijs/max';
import routes from './routes';
import proxy from './proxy';

const { UMI_ENV = 'dev' } = process.env;

export default defineConfig({
  routes,
  proxy: proxy[UMI_ENV as keyof typeof proxy],
  fastRefresh: true,
  // Workspace contracts change with the app; do not freeze their exports in the vendor cache.
  mfsu: { exclude: ['@wms/contracts'] },
  esbuildMinifyIIFE: true,
  antd: {},
  layout: {
    locale: false,
    siderWidth: 232,
    navTheme: 'light',
    colorPrimary: '#105957',
  },
  title: '茂智云仓 · 腈纶仓储管理系统',
  define: {
    'process.env.NODE_ENV': process.env.NODE_ENV,
  },
});
