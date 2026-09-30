import type {Request, Response} from 'express';
import {z} from 'zod';
import {transaction} from '../core/db';
import {AuthService} from '../services/auth.service';
import {cookieOptions, extractToken} from '../middlewares/auth.middleware';

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

    let googleEmail = data.email;
    let googleName = data.name || 'Google User';
    let googleSub = data.googleId || 'mock-google-id-' + Date.now();
    let googlePic = data.picture;

    // Nếu gửi kèm Google credential (JWT ID Token)
    if (data.credential) {
      try {
        const payloadBase64 = data.credential.split('.')[1];
        if (payloadBase64) {
          const decoded = JSON.parse(Buffer.from(payloadBase64, 'base64').toString('utf8'));
          if (decoded.email) googleEmail = decoded.email;
          if (decoded.name) googleName = decoded.name;
          if (decoded.sub) googleSub = decoded.sub;
          if (decoded.picture) googlePic = decoded.picture;
        }
      } catch {
        // Fallback to provided data
      }
    }

    if (!googleEmail) {
      googleEmail = 'google.user@gotek.vn';
    }

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
