import {Router} from 'express';
import {AuthController} from '../controllers/auth.controller';
import {authed} from '../middlewares/auth.middleware';

export const authRouter = Router();

authRouter.post('/auth/signup', AuthController.signup);
authRouter.post('/auth/login', AuthController.login);
authRouter.get(
  '/me',
  authed((db, identity) => AuthController.getMe(db, identity))
);
authRouter.post('/auth/logout', AuthController.logout);
authRouter.post('/auth/request-reset', AuthController.requestReset);
authRouter.post('/auth/reset', AuthController.reset);
authRouter.post('/auth/verify', AuthController.verify);
authRouter.post(
  '/auth/resend',
  authed((db, identity) => AuthController.resend(db, identity))
);
