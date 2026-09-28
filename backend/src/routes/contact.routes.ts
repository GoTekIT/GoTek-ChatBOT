import {Router} from 'express';
import {authed} from '../middlewares/auth.middleware';
import {
  createContact,
  listContacts,
  getContact,
  updateContact,
  deleteContact,
  restoreContact,
  mergeContacts,
  previewMergeContacts,
  undoMergeContacts,
  exportContacts,
  setContactTags,
  listContactTags
} from '../modules/chat/contacts';

export const contactRouter = Router();

contactRouter.get(
  '/contacts',
  authed((db, i, req) => listContacts(db, i, req.query))
);

contactRouter.get(
  '/contact-tags',
  authed((db, i) => listContactTags(db, i))
);

contactRouter.get(
  '/contacts/export',
  authed((db, i, req) => exportContacts(db, i, req.query))
);

contactRouter.get(
  '/contacts/:id',
  authed((db, i, req) => getContact(db, i, String(req.params.id)))
);

contactRouter.put(
  '/contacts/:id',
  authed((db, i, req) => updateContact(db, i, String(req.params.id), req.body))
);

contactRouter.delete(
  '/contacts/:id',
  authed((db, i, req) => deleteContact(db, i, String(req.params.id), req.body))
);

contactRouter.post(
  '/contacts/:id/restore',
  authed((db, i, req) => restoreContact(db, i, String(req.params.id), req.body))
);

contactRouter.put(
  '/contacts/:id/tags',
  authed((db, i, req) => setContactTags(db, i, String(req.params.id), req.body))
);

contactRouter.post(
  '/contacts',
  authed((db, i, req) => createContact(db, i, req.body))
);

contactRouter.post(
  '/contacts/merge',
  authed((db, i, req) => mergeContacts(db, i, req.body))
);

contactRouter.get(
  '/contacts/merge/preview',
  authed((db, i, req) => previewMergeContacts(db, i, req.query))
);

contactRouter.post(
  '/contacts/merge/undo',
  authed((db, i, req) => undoMergeContacts(db, i, req.body))
);
