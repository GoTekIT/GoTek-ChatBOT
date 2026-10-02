import {z} from 'zod';

export const ingestSchema = z.object({
  title: z.string().trim().min(1).max(100),
  content: z.string().trim().min(1).max(2000),
  categoryId: z.string().uuid().nullable().optional(),
  audience: z.enum(['PUBLIC', 'INTERNAL']).optional(),
  maxCharsPerChunk: z.number().int().min(100).max(2000).optional(),
  overlapChars: z.number().int().min(0).max(500).optional(),
}).strict();

export const retrieveSchema = z.object({
  query: z.string().trim().min(1).max(500),
  limit: z.number().int().min(1).max(20).optional(),
  minSimilarity: z.number().min(0).max(1).optional(),
  audience: z.enum(['PUBLIC', 'INTERNAL']).optional(),
}).strict();

export const generateSchema = z.object({
  message: z.string().trim().min(1).max(10000),
  conversationId: z.string().uuid().optional(),
  history: z.array(
    z.object({
      role: z.enum(['visitor', 'agent', 'ai']),
      content: z.string().trim().max(5000),
    })
  ).optional(),
  audience: z.enum(['PUBLIC', 'INTERNAL']).optional(),
  maxContextSources: z.number().int().min(1).max(10).optional(),
  requireGrounded: z.boolean().optional(),
}).strict();

export const playgroundSchema = z.object({
  question: z.string().trim().min(1).max(1000),
}).strict();

export const teachFaqSchema = z.object({
  question: z.string().trim().min(2).max(100),
  answer: z.string().trim().min(2).max(1800).optional(),
  steps: z.array(z.object({
    stepNumber: z.number().int().min(1),
    title: z.string().trim().min(1).max(200),
    description: z.string().trim().min(1).max(1000),
    imageUrl: z.string().url().max(1000).optional(),
  })).max(20).optional(),
  allowedImages: z.array(z.string().url().max(1000)).max(10).optional(),
  categoryId: z.string().uuid().nullable().optional(),
  audience: z.enum(['PUBLIC', 'INTERNAL']).optional().default('PUBLIC'),
}).refine(data => Boolean(data.answer || (data.steps && data.steps.length > 0)), {
  message: 'Phải cung cấp câu trả lời tổng quan hoặc danh sách các bước thực hiện',
});

