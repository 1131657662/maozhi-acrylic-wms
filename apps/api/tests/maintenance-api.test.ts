import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import request from 'supertest';
import { backupArtifactsSchema, maintenanceHealthSchema, maintenanceJobsSchema } from '@wms/contracts';
import { maintenanceHttpFixture, artifactFixture } from './maintenance-fixture.ts';
import { BackupFiles } from '../src/features/maintenance/files.ts';

const base = '/api/v1/maintenance',
  origin = 'http://127.0.0.1:5173';
test('B8a-1 HTTP异步真实备份可查询和下载，幂等重试不新增', async () => {
  const c = await maintenanceHttpFixture();
  try {
    const key = randomUUID();
    const accepted = await c.api
      .post(`${base}/backups`)
      .set('Origin', origin)
      .set('Idempotency-Key', key)
      .send({})
      .expect(202);
    await c.service.settled();
    const replay = await c.api
      .post(`${base}/backups`)
      .set('Origin', origin)
      .set('Idempotency-Key', key)
      .send({})
      .expect(202);
    assert.deepEqual(replay.body.data, accepted.body.data);
    const jobs = maintenanceJobsSchema.parse(
      (await c.api.get(`${base}/jobs?kind=backup&limit=1`).expect(200)).body.data,
    );
    assert.equal(jobs.items[0]?.status, 'succeeded');
    assert.equal(jobs.items[0]?.operator, 'owner');
    const list = await c.api.get(`${base}/artifacts`).expect(200);
    const [file] = backupArtifactsSchema.parse(list.body.data).items;
    assert.ok(file);
    assert.equal('path' in list.body.data.items[0], false);
    const download = await c.api.get(`${base}/artifacts/${file.id}/download`).expect(200);
    const bytes = Buffer.isBuffer(download.body) ? download.body : Buffer.from(download.text);
    assert.equal(bytes.length, file.bytes);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), file.sha256);
    assert.match(download.headers['cache-control'] ?? '', /no-store/);
  } finally {
    await c.dispose();
  }
});

test('B8a-1 同大小篡改产物拒绝下载且不泄露SQL', async () => {
  const c = await maintenanceHttpFixture();
  try {
    const file = await artifactFixture(c.db, {
      root: c.options.directory,
      at: new Date().toISOString(),
      content: 'original',
    });
    await writeFile(path.join(c.options.directory, `${file.id}.sql`), 'tampered');
    const response = await c.api.get(`${base}/artifacts/${file.id}/download`).expect(409);
    assert.equal(response.body.code, 'BACKUP_CORRUPT');
    assert.doesNotMatch(response.text, /tampered|original|\.local|password/i);
    assert.equal(response.headers['content-disposition'], undefined);
  } finally {
    await c.dispose();
  }
});

test('B8a-1 并发HTTP创建只持久化一个备份任务', async () => {
  const c = await maintenanceHttpFixture();
  try {
    const responses = await Promise.all(
      [randomUUID(), randomUUID()].map((key) =>
        c.api.post(`${base}/backups`).set('Origin', origin).set('Idempotency-Key', key).send({}),
      ),
    );
    assert.deepEqual(responses.map((r) => r.status).sort(), [202, 409]);
    await c.service.settled();
    assert.equal(Number((await c.db.get('SELECT COUNT(*) AS n FROM maintenance_jobs'))?.n), 1);
  } finally {
    await c.dispose();
  }
});

test('B8a-1 维护接口拒绝匿名、移动端、跨源及客户端命令/路径/身份覆盖', async () => {
  const c = await maintenanceHttpFixture();
  try {
    await request(c.app).get(`${base}/health`).expect(401);
    const pda = await request(c.app)
      .post('/api/v1/auth/login')
      .send({ username: 'owner', password: 'maintenance-test-password', channel: 'pda' })
      .expect(200);
    await request(c.app).get(`${base}/artifacts`).set('Authorization', `Bearer ${pda.body.data.token}`).expect(403);
    await c.api.post(`${base}/backups`).set('Origin', 'https://invalid.example').send({}).expect(403);
    await c.api.post(`${base}/backups`).send({}).expect(403);
    for (const field of ['command', 'path', 'database', 'operator', 'kind'])
      await c.api
        .post(`${base}/backups`)
        .set('Origin', origin)
        .set('Idempotency-Key', randomUUID())
        .send({ [field]: 'bad' })
        .expect(422);
    await c.api.get(`${base}/jobs?limit=101`).expect(422);
    await c.api.get(`${base}/jobs?kind=bad`).expect(422);
    await c.api.get(`${base}/artifacts/invalid/download`).expect(422);
    assert.equal(Number((await c.db.get('SELECT COUNT(*) AS n FROM maintenance_jobs'))?.n), 0);
  } finally {
    await c.dispose();
  }
});

test('B8a-1 健康真实探测，HTTP缺采集不伪报零，缺文件路径拒绝下载', async () => {
  const c = await maintenanceHttpFixture();
  try {
    await new BackupFiles(c.options.directory).prepare();
    const data = maintenanceHealthSchema.parse((await c.api.get(`${base}/health`).expect(200)).body.data);
    assert.equal(data.database.status, 'ok');
    assert.ok(data.database.latencyMs! >= 0);
    assert.ok(data.disk.freeBytes! > 0);
    assert.equal(data.http.status, 'unsupported');
    assert.equal(data.http.requests, null);
    assert.equal(data.http.errors, null);
    assert.equal(data.http.p95Ms, null);
    assert.equal(data.backup.reason, '从未备份');
    const file = await artifactFixture(c.db, { root: c.options.directory, at: new Date().toISOString() });
    const filename = path.join(c.options.directory, `${file.id}.sql`),
      original = await readFile(filename);
    await c.db.run("UPDATE backup_artifacts SET path='../unowned.sql' WHERE id=?", [file.id]);
    await c.api.get(`${base}/artifacts/${file.id}/download`).expect(409);
    assert.deepEqual(await readFile(filename), original);
  } finally {
    await c.dispose();
  }
});
