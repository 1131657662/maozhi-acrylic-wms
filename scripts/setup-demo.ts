import { existsSync,readFileSync,writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { developmentConfig } from '../apps/api/src/db/config.ts';
import { openDatabase } from '../apps/api/src/db/mysql.ts';
import { migrateUp } from '../apps/api/src/db/migrate.ts';
import { seedDemo } from '../apps/api/src/db/seed.ts';
import { bootstrapMysql,createDevelopmentUser } from './mysql/bootstrap.ts';

await bootstrapMysql();
await createDevelopmentUser();
const db=openDatabase(developmentConfig());
try {
  await migrateUp(db);
  const meta=await db.get("SELECT value FROM app_meta WHERE meta_key='identity'");
  if(meta) {
    if(meta.value!=='maozhi-local-mysql8-v1') throw new Error('数据库身份不匹配');
    console.log('MySQL 开发库已存在，保留全部数据和账户。');
  } else {
    const file=new URL('../.local/demo-access.txt',import.meta.url);
    const password=existsSync(file)?readFileSync(file,'utf8').match(/密码: (.+)/)?.[1]:randomBytes(18).toString('base64url');
    if(!password) throw new Error('现有账户文件格式不正确，拒绝覆盖');
    await seedDemo(db,password);
    if(!existsSync(file)) writeFileSync(file,`仅本地开发\n用户名: owner\n密码: ${password}\n`,{flag:'wx',mode:0o600});
    console.log('MySQL 8 开发库已建立；登录信息见 .local/demo-access.txt。');
  }
} finally { await db.close(); }
