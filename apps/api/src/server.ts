import { developmentConfig } from './db/config.ts';
import { openDatabase } from './db/mysql.ts';
import { createApp } from './app.ts';
import { logger } from './shared/logger.ts';

const db=openDatabase(developmentConfig());
const meta=await db.get("SELECT value FROM app_meta WHERE meta_key='identity'");
if(meta?.value!=='maozhi-local-mysql8-v1') { await db.close(); throw new Error('开发库身份不匹配，请执行 npm run db:setup'); }
const version=await db.get('SELECT VERSION() AS version');
if(!String(version?.version).startsWith('8.')) { await db.close(); throw new Error('开发库必须是MySQL 8'); }
const server=createApp(db).listen(4310,'127.0.0.1',()=>logger.info('MySQL 开发 API: http://127.0.0.1:4310'));
function shutdown():void {
  server.close(()=>{void db.close().finally(()=>process.exit(0));});
}
process.on('SIGINT',shutdown);
process.on('SIGTERM',shutdown);
