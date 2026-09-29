import {Router} from 'express';
import {platformRoutes} from '../modules/platform/platform';

/**
 * Platform Administration Route Group
 * Manages SaaS-wide providers, models, workspace provisioning, and audit logs.
 */
export const platformRouter = Router();

// Mount platform handlers onto this modular router
platformRoutes(platformRouter);
