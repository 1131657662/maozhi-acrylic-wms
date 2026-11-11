import type { Database } from '../../db/mysql.ts';
import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { sessionSchema,type Session } from '@wms/contracts';
import { AppError } from '../../shared/errors.ts';
import { hash } from '../../shared/hash.ts';
import { audit,type Actor } from '../../shared/audit.ts';
import { identifyAuditActor } from '../audit/context.ts';

interface LoginInput extends Session { password:string }
const dummyHash=bcrypt.hashSync(randomBytes(32).toString('hex'),12);
export async function login(db:Database,input:LoginInput,actor:Actor):Promise<Session & {token:string}> {
  const row=await db.get('SELECT password_hash FROM owner WHERE username=?',[input.username]);
  const valid=await bcrypt.compare(input.password,row?String(row.password_hash):dummyHash);
  if(!row||!valid) throw new AppError('INVALID_CREDENTIALS','用户名或密码错误',401);
  const token=randomBytes(32).toString('base64url');
  await db.transaction(async (tx)=>{
    await tx.run('DELETE FROM sessions WHERE expires_at<?',[Date.now()]);
    await tx.run('INSERT INTO sessions(token_hash,username,channel,expires_at) VALUES(?,?,?,?)',
      [hash(token),input.username,input.channel,Date.now()+8*3600000]);
    // Channel is read back from the server-issued session, never from a client header.
    const issued = await authenticate(tx, token);
    identifyAuditActor({ ...issued, traceId: actor.traceId });
    await audit(tx,{...actor,username:input.username},
      {action:'auth.login',targetId:input.username,before:null,after:{channel:input.channel}});
  });
  return {username:input.username,channel:input.channel,token};
}
export async function authenticate(db:Database,token:string):Promise<Session> {
  const row=await db.get('SELECT username,channel FROM sessions WHERE token_hash=? AND expires_at>?',[hash(token),Date.now()]);
  if(!row) throw new AppError('UNAUTHORIZED','登录已过期，请重新登录；本机扫码记录会保留',401);
  return sessionSchema.parse(row);
}
export async function logout(db:Database,token:string,actor:Actor):Promise<void> {
  await db.transaction(async(tx)=>{
    await tx.run('DELETE FROM sessions WHERE token_hash=?',[hash(token)]);
    await audit(tx,actor,{action:'auth.logout',targetId:actor.username,before:null,after:null});
  });
}
