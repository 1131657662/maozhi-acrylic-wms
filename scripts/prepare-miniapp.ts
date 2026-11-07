import { cpSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../apps/miniapp/', import.meta.url));
const source = `${root}/node_modules/@vant/weapp/dist`;
const destination = `${root}/miniprogram_npm/@vant/weapp`;
if (!existsSync(`${source}/button/index.wxml`)) throw new Error('请先执行 npm ci --prefix apps/miniapp');
mkdirSync(destination, { recursive: true });
cpSync(source, destination, { recursive: true });
const app = JSON.parse(readFileSync(`${root}/app.json`, 'utf8'));
for (const component of Object.values(app.usingComponents)) {
  if (typeof component !== 'string' || !existsSync(`${root}/${component}.json`))
    throw new Error(`组件入口缺失：${component}`);
}
for (const page of app.pages)
  for (const suffix of ['.js', '.json', '.wxml']) {
    if (!existsSync(`${root}/${page}${suffix}`)) throw new Error(`页面文件缺失：${page}${suffix}`);
  }
console.log('Vant 发行资源已准备；所有页面与注册组件入口验证通过。无需依赖全局开发工具构建 npm。');
