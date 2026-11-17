import request from 'supertest';
import { fixture } from './fixture.ts';
export const identityOrigin = 'http://127.0.0.1:5173';
export const currentPassword = 'test-only-password';
export const nextPassword = 'Next-safe-password-123';
export async function identityFixture() {
  const c = await fixture();
  const web = request.agent(c.app);
  try {
    const response = await web
      .post('/api/v1/auth/login')
      .send({ username: 'owner', password: currentPassword, channel: 'web' })
      .expect(200);
    const cookies: unknown = response.headers['set-cookie'];
    if (!Array.isArray(cookies) || typeof cookies[0] !== 'string') throw new Error('测试登录缺少Cookie');
    const token = decodeURIComponent(cookies[0].split(';')[0]!.slice('wms_session='.length));
    return { ...c, web, token };
  } catch (error) {
    await c.dispose();
    throw error;
  }
}
