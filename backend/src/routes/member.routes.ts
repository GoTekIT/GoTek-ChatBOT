import {Router} from 'express';
import {authed} from '../middlewares/auth.middleware';
import {MemberController} from '../controllers/member.controller';

export const memberRouter = Router();

memberRouter.get(
  '/members',
  authed((db, identity) => MemberController.listMembers(db, identity), 'members.manage')
);

memberRouter.patch(
  '/members/:id',
  authed((db, identity, req) => MemberController.updateMember(db, identity, req), 'members.manage')
);

memberRouter.get(
  '/invitations',
  authed((db, identity) => MemberController.listInvitations(db, identity), 'members.manage')
);

memberRouter.post(
  '/invitations',
  authed((db, identity, req) => MemberController.createInvitation(db, identity, req), 'members.manage')
);

memberRouter.post(
  '/invitations/:id/revoke',
  authed((db, identity, req) => MemberController.revokeInvitation(db, identity, req), 'members.manage')
);

memberRouter.post(
  '/invitations/accept',
  authed((db, identity, req) => MemberController.acceptInvitation(db, identity, req))
);
