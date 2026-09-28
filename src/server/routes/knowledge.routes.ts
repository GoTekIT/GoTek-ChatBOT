import express, {Router} from 'express';
import {createHash} from 'node:crypto';
import {z} from 'zod';
import {transaction} from '../db';
import {uuid, HttpError, requireRole} from '../security';
import {authed, identity} from '../middlewares/auth.middleware';
import {upload, uploadRateLimit} from '../middlewares/security.middleware';
import {uidSchema} from '../dtos/common.dto';
import {listKnowledgeCategories, createKnowledgeCategory} from '../knowledge-categories';
import {KnowledgeRepository} from '../repositories/knowledge.repository';
import {
  listKnowledge,
  getKnowledge,
  createKnowledge,
  updateKnowledge,
  importKnowledgeBatch,
  importKnowledgeFile
} from '../knowledge';
import {
  beginKnowledgeImport,
  completeKnowledgeImport,
  getKnowledgeImport,
  getKnowledgeImportFile,
  listKnowledgeImports,
  failKnowledgeImport
} from '../knowledge-imports';
import {extractDocumentText} from '../document-extract';
import {processKnowledge, publishKnowledge, rollbackKnowledge} from '../knowledge-lifecycle';
import {retrieveStoredChunks} from '../knowledge-chunk-store';
import {retrieveKnowledge} from '../knowledge-retrieval';

export const knowledgeRouter = Router();

knowledgeRouter.get(
  '/knowledge-categories',
  authed((db, i) => listKnowledgeCategories(db, i))
);

knowledgeRouter.post(
  '/knowledge-categories',
  authed((db, i, req) => createKnowledgeCategory(db, i, req.body))
);

knowledgeRouter.get(
  '/knowledge/items',
  authed((db, i, req) => listKnowledge(db, i, req.query))
);

knowledgeRouter.get(
  '/knowledge/items/:id',
  authed((db, i, req) => getKnowledge(db, i, String(req.params.id)))
);

knowledgeRouter.post(
  '/knowledge/items',
  authed((db, i, req) => createKnowledge(db, i, req.body))
);

knowledgeRouter.post(
  '/knowledge/import',
  authed((db, i, req) => importKnowledgeBatch(db, i, req.body))
);

knowledgeRouter.post(
  '/knowledge/import-file',
  authed((db, i, req) => importKnowledgeFile(db, i, req.body))
);

knowledgeRouter.post(
  '/knowledge/import-document',
  uploadRateLimit,
  async (req, res, next) => {
    try {
      await transaction(async db => {
        const i = await identity(db, req);
        requireRole(i.role);
      });
      next();
    } catch (error) {
      next(error);
    }
  },
  upload.single('file'),
  async (req, res) => {
    const outcome = await transaction(async db => {
      const i = await identity(db, req);
      requireRole(i.role);
      if (!req.file) throw new HttpError(400, 'FILE_REQUIRED');

      const requestId = uidSchema.parse(req.get('x-gotek-import-id') || uuid());
      const payload = {
        filename: req.file.originalname,
        hash: createHash('sha256').update(req.file.buffer).digest('hex'),
        categoryId: req.body?.categoryId ?? null
      };

      await KnowledgeRepository.lockKnowledgeMutation(db, i.workspace_id, requestId);
      const old = await KnowledgeRepository.findMutation(db, i.workspace_id, requestId, payload);

      if (old) {
        if (old.operation !== 'knowledge.document_imported' || !old.same) {
          throw new HttpError(409, 'IDEMPOTENCY_CONFLICT');
        }
        return old.response;
      }

      let extracted;
      try {
        extracted = await extractDocumentText(req.file.originalname, req.file.buffer);
      } catch (error) {
        if (!(error instanceof HttpError)) throw error;
        const failed = await beginKnowledgeImport(db, i, {
          filename: req.file.originalname,
          mimeType: req.file.mimetype,
          bytes: req.file.buffer
        });
        await failKnowledgeImport(db, i, failed.id, error.code);
        const response = {error: error.code, httpStatus: error.status, requestId, importId: failed.id};
        await KnowledgeRepository.recordMutation(
          db,
          i.workspace_id,
          requestId,
          'knowledge.document_imported',
          payload,
          response
        );
        return response;
      }

      const points = Array.from(extracted.content);
      const items = [];
      for (let offset = 0; offset < points.length; offset += 2000) {
        items.push({
          requestId: uuid(),
          title: Array.from(extracted.filename).slice(0, 80).join('') + ' · ' + (items.length + 1),
          content: points.slice(offset, offset + 2000).join(''),
          categoryId: typeof req.body?.categoryId === 'string' ? req.body.categoryId : undefined
        });
      }

      const importedFile = await beginKnowledgeImport(db, i, {
        filename: req.file.originalname,
        mimeType: req.file.mimetype,
        bytes: req.file.buffer
      });
      const result = await importKnowledgeBatch(db, i, {items});
      const receipt = await completeKnowledgeImport(db, i, importedFile.id, result.imported);
      const response = {...result, warnings: extracted.warnings, requestId, importId: receipt.id};

      await KnowledgeRepository.recordMutation(
        db,
        i.workspace_id,
        requestId,
        'knowledge.document_imported',
        payload,
        response
      );
      return response;
    });

    if (outcome.error) {
      res.status(outcome.httpStatus).json({error: outcome.error, requestId: outcome.requestId, importId: outcome.importId});
      return;
    }
    res.json(outcome);
  }
);

knowledgeRouter.get(
  '/knowledge/imports',
  authed((db, i, req) => listKnowledgeImports(db, i, req.query))
);

knowledgeRouter.get('/knowledge/imports/:id/file', async (req, res) => {
  const file = await transaction(async db => getKnowledgeImportFile(db, await identity(db, req), String(req.params.id)));
  res.set('Cache-Control', 'no-store').attachment(file.filename).type('application/octet-stream').send(file.bytes);
});

knowledgeRouter.get(
  '/knowledge/imports/:id',
  authed((db, i, req) => getKnowledgeImport(db, i, String(req.params.id)))
);

knowledgeRouter.get(
  '/knowledge/versions/:versionId/chunks',
  authed(async (db, i, req) => {
    requireRole(i.role);
    const versionId = uidSchema.parse(req.params.versionId);
    const query = z.string().trim().min(1).max(500).parse(String(req.query.query || ''));
    const limit = z.coerce.number().int().min(1).max(20).parse(req.query.limit ?? 8);
    return retrieveStoredChunks(db, i.workspace_id, versionId, query, limit);
  })
);

knowledgeRouter.post(
  '/knowledge/import-bytes',
  express.raw({type: ['application/octet-stream', 'text/plain', 'text/csv', 'application/json'], limit: '120kb'}),
  authed((db, i, req) => {
    const filename = req.get('x-gotek-filename');
    if (!filename) throw new HttpError(400, 'FILENAME_REQUIRED');
    const content = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : '';
    return importKnowledgeFile(db, i, {filename, content, categoryId: req.get('x-gotek-category-id') || undefined});
  })
);

knowledgeRouter.patch(
  '/knowledge/items/:id/draft',
  authed((db, i, req) => updateKnowledge(db, i, String(req.params.id), req.body))
);

knowledgeRouter.post(
  '/knowledge/items/:id/process',
  authed((db, i, req) => processKnowledge(db, i, String(req.params.id), req.body))
);

knowledgeRouter.post(
  '/knowledge/items/:id/publish',
  authed((db, i, req) => publishKnowledge(db, i, String(req.params.id), req.body))
);

knowledgeRouter.post(
  '/knowledge/items/:id/rollback',
  authed((db, i, req) => rollbackKnowledge(db, i, String(req.params.id), req.body))
);

knowledgeRouter.get(
  '/knowledge/retrieve',
  authed((db, i, req) => {
    requireRole(i.role);
    return retrieveKnowledge(db, i.workspace_id, req.query);
  })
);
