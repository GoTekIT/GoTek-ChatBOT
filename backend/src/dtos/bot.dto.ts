import {z} from 'zod';

export const createTemplateSchema = z.object({
  shortcut: z.string().trim().min(1).max(50),
  title: z.string().trim().min(1).max(150),
  content: z.string().trim().min(1).max(4000),
  category: z.string().trim().min(1).max(50).optional().default('General'),
  media_urls: z.array(z.string().url().max(2000)).max(10).optional().default([]),
}).strict();

export const updateTemplateSchema = z.object({
  shortcut: z.string().trim().min(1).max(50).optional(),
  title: z.string().trim().min(1).max(150).optional(),
  content: z.string().trim().min(1).max(4000).optional(),
  category: z.string().trim().min(1).max(50).optional(),
  media_urls: z.array(z.string().url().max(2000)).max(10).optional(),
  is_active: z.boolean().optional(),
}).strict();

export const createMediaSchema = z.object({
  title: z.string().trim().min(1).max(150),
  file_url: z.string().url().max(2000),
  mime_type: z.enum(['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml', 'image/gif']),
  byte_size: z.number().int().positive().max(10 * 1024 * 1024), // 10MB max
  tags: z.array(z.string().trim().min(1).max(50)).max(10).optional().default([]),
}).strict();

