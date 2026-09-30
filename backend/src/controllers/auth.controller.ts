import type {Request, Response} from 'express';
import {z} from 'zod';
import {transaction} from '../core/db';
import {AuthService} from '../services/auth.service';
import {cookieOptions, extractToken} from '../middlewares/auth.middleware';
import {HttpError} from '../core/security';

import {
  emailSchema,
  passwordSchema,
  uidSchema,
  successResponse,
  genericResponse
} from '../dtos/common.dto';

export {emailSchema, passwordSchema, uidSchema, successResponse, genericResponse};

export class AuthController {
  static async signup(req: Request, res: Response): Promise<void> {
    const data = z
      .object({
        fullName: z.string().trim().min(2).max(120),
        business: z.string().trim().min(2).max(160),
        email: emailSchema,
        phone: z.string().trim().regex(/^\+?[0-9 ()-]{7,25}$/),
        referral: z.string().max(80).optional(),
        password: passwordSchema
      })
      .strict()
      .parse(req.body);

    await transaction(async db => {
      await AuthService.signup(db, data);
    });

    res.status(202).json(genericResponse);
  }

  static async login(req: Request, res: Response): Promise<void> {
    const data = z
      .object({
        email: emailSchema,
        password: z.string().max(128),
        remember: z.boolean().optional()
      })
      .strict()
      .parse(req.body);

    const result = await transaction(async db => {
      return AuthService.login(db, data);
    });

    res
      .cookie('gotek_session', result.token, {...cookieOptions, maxAge: result.maxAge})
      .json({
        ok: true,
        token: result.token,
        user: result.user,
        workspaceId: result.workspaceId
      });
  }

  static async getMe(db: any, identity: any): Promise<any> {
    return AuthService.getMe(db, identity.user_id, identity.workspace_id, identity.role);
  }

  static async logout(req: Request, res: Response): Promise<void> {
    const token = extractToken(req);
    await transaction(async db => {
      await AuthService.logout(db, token);
    });
    res.clearCookie('gotek_session', cookieOptions).json(successResponse);
  }

  static async changePassword(db: any, identity: any, req: Request): Promise<any> {
    const data = z
      .object({
        currentPassword: z.string().min(1).max(128),
        newPassword: passwordSchema
      })
      .strict()
      .parse(req.body);

    const currentToken = extractToken(req);
    await AuthService.changePassword(db, identity.user_id, data, currentToken);
    return successResponse;
  }

  static async requestReset(req: Request, res: Response): Promise<void> {
    const data = z.object({email: emailSchema}).strict().parse(req.body);
    const token = await transaction(async db => {
      return AuthService.requestReset(db, data.email);
    });
    if (process.env.NODE_ENV !== 'production' && token) {
      res.status(202).json({ok: true, token});
      return;
    }
    res.status(202).json(genericResponse);
  }

  static async reset(req: Request, res: Response): Promise<void> {
    const data = z
      .object({
        token: z.string().min(30).max(100),
        password: passwordSchema
      })
      .strict()
      .parse(req.body);

    await transaction(async db => {
      await AuthService.resetPassword(db, data.token, data.password);
    });

    res.clearCookie('gotek_session', cookieOptions).json(successResponse);
  }

  static async verify(req: Request, res: Response): Promise<void> {
    const data = z.object({token: z.string().min(30).max(100)}).strict().parse(req.body);
    await transaction(async db => {
      await AuthService.verifyEmail(db, data.token);
    });
    res.json(successResponse);
  }

  static async resend(db: any, identity: any): Promise<any> {
    const alreadyVerified = await AuthService.resendVerification(db, identity.user_id);
    return alreadyVerified ? successResponse : genericResponse;
  }

  static async sendOtp(req: Request, res: Response): Promise<void> {
    const data = z
      .object({
        email: emailSchema,
        purpose: z.enum(['reset', 'login', 'verify']).optional()
      })
      .strict()
      .parse(req.body);

    const result = await transaction(async db => {
      return AuthService.sendOtp(db, data.email, data.purpose);
    });

    res.json(result);
  }

  static async verifyOtp(req: Request, res: Response): Promise<void> {
    const data = z
      .object({
        email: emailSchema,
        otp: z.string().trim().length(6),
        newPassword: passwordSchema.optional()
      })
      .strict()
      .parse(req.body);

    const result = await transaction(async db => {
      return AuthService.verifyOtp(db, data);
    });

    if (result.token) {
      res
        .cookie('gotek_session', result.token, {...cookieOptions, maxAge: 24 * 60 * 60 * 1000})
        .json(result);
    } else {
      res.clearCookie('gotek_session', cookieOptions).json(result);
    }
  }

  static async googleLogin(req: Request, res: Response): Promise<void> {
    const data = z
      .object({
        credential: z.string().optional(),
        email: emailSchema.optional(),
        name: z.string().optional(),
        googleId: z.string().optional(),
        picture: z.string().optional()
      })
      .parse(req.body);

    if (!data.credential) throw new HttpError(401, 'GOOGLE_CREDENTIAL_REQUIRED');
    const tokenInfo = await fetch(`https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(data.credential)}`);
    if (!tokenInfo.ok) throw new HttpError(401, 'INVALID_GOOGLE_CREDENTIAL');
    const claims = await tokenInfo.json() as {aud?: string; sub?: string; email?: string; email_verified?: string};
    const expectedClientId = process.env.GOOGLE_CLIENT_ID;
    if (!claims.sub || !claims.email || claims.email_verified !== 'true' || (expectedClientId && claims.aud !== expectedClientId)) {
      throw new HttpError(401, 'INVALID_GOOGLE_CREDENTIAL');
    }
    const profileResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {headers: {Authorization: `Bearer ${data.credential}`}});
    if (!profileResponse.ok) throw new HttpError(401, 'INVALID_GOOGLE_CREDENTIAL');
    const profile = await profileResponse.json() as {email?: string; name?: string; sub?: string; picture?: string};
    const googleEmail = profile.email ?? claims.email;
    const googleName = profile.name ?? data.name ?? 'Google User';
    const googleSub = profile.sub ?? claims.sub;
    const googlePic = profile.picture ?? data.picture;

    const result = await transaction(async db => {
      return AuthService.googleAuth(db, {
        email: googleEmail!,
        name: googleName,
        googleId: googleSub,
        picture: googlePic
      });
    });

    res
      .cookie('gotek_session', result.token, {...cookieOptions, maxAge: result.maxAge})
      .json({
        ok: true,
        token: result.token,
        user: result.user,
        workspaceId: result.workspaceId
      });
  }
}
