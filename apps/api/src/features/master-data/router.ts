import { Router } from 'express';
import { z } from 'zod';
import { partyOwnerSchema } from '@wms/contracts';
import type { Database } from '../../db/mysql.ts';
import { actorFrom, ok, requireChannel } from '../../middleware/http.ts';
import { masterDataController } from './controller.ts';
import { listContacts } from './contacts-read.ts';
import { createContact, updateContact, setDefaultContact, deleteContact } from './contacts-write.ts';
import { listVehicles, readVehicle, createVehicle, updateVehicle } from './vehicles.ts';
export function masterRouter(db: Database, origins: string[]): Router {
  const router = Router(),
    master = masterDataController(db);
  router.use(requireChannel('web', origins));
  router.get('/contacts', async (req, res) => ok(res, await listContacts(db, partyOwnerSchema.parse(req.query))));
  router.post('/contacts', async (req, res) => ok(res, await createContact(db, req.body, actorFrom(res))));
  router.patch('/contacts/:id', async (req, res) =>
    ok(res, await updateContact(db, z.uuid().parse(req.params.id), req.body, actorFrom(res))),
  );
  router.put('/contacts/:id/default', async (req, res) => {
    z.strictObject({}).parse(req.body ?? {});
    ok(res, await setDefaultContact(db, z.uuid().parse(req.params.id), actorFrom(res)));
  });
  router.delete('/contacts/:id', async (req, res) => {
    await deleteContact(db, z.uuid().parse(req.params.id), actorFrom(res));
    ok(res, null);
  });
  router.get('/vehicles', async (req, res) => ok(res, await listVehicles(db, req.query)));
  router.get('/vehicles/:id', async (req, res) => ok(res, await readVehicle(db, z.uuid().parse(req.params.id))));
  router.post('/vehicles', async (req, res) => ok(res, await createVehicle(db, req.body, actorFrom(res))));
  router.patch('/vehicles/:id', async (req, res) =>
    ok(res, await updateVehicle(db, z.uuid().parse(req.params.id), req.body, actorFrom(res))),
  );
  router.get('/:catalog', master.list);
  router.get('/:catalog/:code', master.read);
  router.post('/:catalog', master.create);
  router.patch('/:catalog/:code', master.update);
  return router;
}
