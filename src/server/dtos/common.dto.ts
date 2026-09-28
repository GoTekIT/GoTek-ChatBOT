import {z} from 'zod';

export const emailSchema = z
  .string()
  .trim()
  .email()
  .max(254)
  .transform(v => v.toLowerCase());

export const passwordSchema = z.string().min(12).max(128);

export const uidSchema = z.string().uuid();

export const successResponse = {ok: true} as const;

export const genericResponse = {
  ok: true,
  message: 'Nếu thông tin hợp lệ, hướng dẫn sẽ được gửi.'
} as const;
