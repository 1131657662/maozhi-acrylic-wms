import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fixture, actor } from './fixture.ts';
import { activeMaster } from '../src/features/master-data/catalogs.ts';
import { createMasterItem, listMasterItems, updateMasterItem } from '../src/features/master-data/service.ts';

test('主数据可建立、改名和停用；停用项不能进入新业务单据', async () => {
  const { db, dispose } = await fixture();
  try {
    const { code } = await createMasterItem(db, 'suppliers', { name: '测试供应商' }, actor);
    await updateMasterItem(db, 'suppliers', code, { name: '已校正供应商' }, actor);
    await updateMasterItem(db, 'suppliers', code, { active: false }, actor);
    assert.equal((await listMasterItems(db, 'suppliers')).items.find((row) => row.code === code)?.active, false);
    await assert.rejects(activeMaster(db, 'suppliers', code), { code: 'MASTER_DATA_INACTIVE' });
    assert.equal((await db.all('SELECT * FROM operation_log WHERE target_id=?', [`suppliers:${code}`])).length, 3);
  } finally {
    await dispose();
  }
});
