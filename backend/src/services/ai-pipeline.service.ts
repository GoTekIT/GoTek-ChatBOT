import type {PoolClient} from 'pg';
import {z} from 'zod';
import {createHash, randomUUID} from 'node:crypto';
import {audit} from '../core/security';
import {scope} from '../core/db';
import {chunkKnowledgeText} from '../modules/knowledge/knowledge-chunks';
import {workspacePrompt} from '../modules/ai/workspace-prompt';
import {loadAiRuleSnapshot} from '../modules/ai/ai-rule-snapshot';
import {invokeProviderDetailed, type ProviderUsageMetadata} from '../modules/ai/provider-transport';
import {AiPipelineRepository} from '../repositories/ai-pipeline.repository';

export const AI_CONSTANTS = {
  DEFAULT_MIN_SIMILARITY: 0.15,
  DEFAULT_CHUNK_LIMIT: 5,
  MAX_CHUNK_LIMIT: 20,
  DEFAULT_MAX_CHARS_PER_CHUNK: 800,
  DEFAULT_OVERLAP_CHARS: 100,
  DEFAULT_TIMEOUT_MS: 25000,
  FALLBACK_LOCAL_MODEL: 'local-synthesizer',
  FALLBACK_GROUNDED_MODEL: 'fallback-grounded',
  HANDOFF_TRIGGERS: [
    'gặp nhân viên',
    'nói chuyện với người',
    'gặp sếp',
    'gặp tư vấn viên',
    'khiếu nại',
    'lừa đảo',
    'báo công an',
    'tổng đài viên',
    'human',
    'agent',
  ] as const,
};

export interface IngestDocumentInput {
  title: string;
  content: string;
  categoryId?: string | null;
  audience?: 'PUBLIC' | 'INTERNAL';
  maxCharsPerChunk?: number;
  overlapChars?: number;
}

export interface IngestDocumentResult {
  itemId: string;
  versionId: string;
  chunksCount: number;
  totalTokens: number;
  chunks: Array<{index: number; text: string; tokenEstimate: number}>;
}

export interface RetrieveContextInput {
  query: string;
  limit?: number;
  minSimilarity?: number;
  audience?: 'PUBLIC' | 'INTERNAL';
  history?: Array<{role: 'visitor' | 'agent' | 'ai'; content: string}>;
}

export interface RetrievedSourceChunk {
  chunkIndex: number;
  versionId: string;
  title: string;
  text: string;
  similarity: number;
  citationId: string;
}

export interface GenerateAnswerInput {
  message: string;
  conversationId?: string;
  history?: Array<{role: 'visitor' | 'agent' | 'ai'; content: string}>;
  audience?: 'PUBLIC' | 'INTERNAL';
  maxContextSources?: number;
  requireGrounded?: boolean;
}

export interface GenerateAnswerResult {
  answer: string;
  citations: Array<{
    reference: number;
    title: string;
    snippet: string;
    similarity: number;
  }>;
  confidence: number;
  isHandoff: boolean;
  handoffReason?: string;
  tokensUsed: ProviderUsageMetadata;
  latencyMs: number;
  modelUsed?: string;
}

export interface TeachFaqInput {
  question: string;
  answer: string;
  categoryId?: string | null;
}

/**
 * Service Layer for GoTek AI Pipeline.
 * Owns business logic, RAG retrieval orchestration, guardrail checking,
 * prompting, and provider transport invocation. Adheres strictly to Clean Architecture.
 */
export class AiPipelineService {
  /**
   * 1. Ingests raw document content into chunked knowledge representations
   * and persists them using AiPipelineRepository.
   */
  static async ingestDocument(
    db: PoolClient,
    workspaceId: string,
    userId: string,
    input: IngestDocumentInput
  ): Promise<IngestDocumentResult> {
    await scope(db, workspaceId);

    const title = z.string().trim().min(1).max(100).parse(input.title);
    const content = z.string().trim().min(1).max(2000).parse(input.content);
    const audience = input.audience || 'PUBLIC';
    const categoryId = input.categoryId || null;

    // 1. Chunking with Vietnamese text preservation
    const chunks = chunkKnowledgeText(content, {
      maxChars: input.maxCharsPerChunk || AI_CONSTANTS.DEFAULT_MAX_CHARS_PER_CHUNK,
      overlapChars: input.overlapChars || AI_CONSTANTS.DEFAULT_OVERLAP_CHARS,
    });

    const totalTokens = chunks.reduce((sum, c) => sum + c.tokenEstimate, 0);

    // 2. Persist knowledge item and version records via repository
    const itemId = randomUUID();
    const versionId = randomUUID();
    const contentHash = createHash('sha256').update(content).digest('hex');

    await AiPipelineRepository.insertIngestedDocument(db, workspaceId, userId, {
      itemId,
      versionId,
      title,
      content,
      contentHash,
      audience,
      categoryId,
    });

    // 3. Store chunks into knowledge_chunks via repository
    await AiPipelineRepository.insertKnowledgeChunks(db, workspaceId, versionId, chunks);

    // 4. Audit trail entry
    await audit(db, workspaceId, userId, 'knowledge.ingested', itemId);

    return {
      itemId,
      versionId,
      chunksCount: chunks.length,
      totalTokens,
      chunks: chunks.map(c => ({index: c.index, text: c.text, tokenEstimate: c.tokenEstimate})),
    };
  }

  /**
   * 2. Semantic Context Retrieval (RAG)
   * Retrieves strictly published, active chunks and applies lexical term matching.
   */
  static async retrieveContext(
    db: PoolClient,
    workspaceId: string,
    input: RetrieveContextInput
  ): Promise<RetrievedSourceChunk[]> {
    await scope(db, workspaceId);

    const query = z.string().trim().min(1).max(500).parse(input.query);
    const limit = Math.min(input.limit || AI_CONSTANTS.DEFAULT_CHUNK_LIMIT, AI_CONSTANTS.MAX_CHUNK_LIMIT);
    const audience = input.audience || 'PUBLIC';
    const minSimilarity = input.minSimilarity ?? AI_CONSTANTS.DEFAULT_MIN_SIMILARITY;

    // Fetch strictly published and active chunks
    const rows = await AiPipelineRepository.findPublishedChunks(db, workspaceId, audience);
    if (!rows.length) return [];

    // Semantic lexical ranking
    const queryTerms = query.toLowerCase().split(/\s+/).filter(t => t.length > 1);

    const ranked: RetrievedSourceChunk[] = [];
    for (const r of rows) {
      const contentLower = (r.content + ' ' + r.title).toLowerCase();
      let matchedCount = 0;
      for (const t of queryTerms) {
        if (contentLower.includes(t)) matchedCount++;
      }
      const lexicalScore = queryTerms.length ? matchedCount / queryTerms.length : 0;

      if (lexicalScore > 0 && lexicalScore >= minSimilarity) {
        ranked.push({
          chunkIndex: r.chunk_index,
          versionId: r.version_id,
          title: r.title,
          text: r.content,
          similarity: Number(lexicalScore.toFixed(3)),
          citationId: `src-${r.item_id}-${r.chunk_index}`,
        });
      }
    }

    // Sort descending by similarity
    ranked.sort((a, b) => b.similarity - a.similarity);
    return ranked.slice(0, limit);
  }

  /**
   * 3. End-to-End Grounded Generation with Guardrails & Handoff Detection.
   */
  static async generateAnswer(
    db: PoolClient,
    workspaceId: string,
    input: GenerateAnswerInput
  ): Promise<GenerateAnswerResult> {
    const startTime = Date.now();
    await scope(db, workspaceId);

    const message = z.string().trim().min(1).max(10_000).parse(input.message);
    const history = input.history || [];

    // Check for hard human handoff triggers
    const lowerMsg = message.toLowerCase();
    const isDirectHandoff = AI_CONSTANTS.HANDOFF_TRIGGERS.some(trigger => lowerMsg.includes(trigger));
    if (isDirectHandoff) {
      return {
        answer:
          'Dạ em hiểu vấn đề của Anh/Chị rất quan trọng. Em đang kết nối ngay với nhân viên chuyên trách để hỗ trợ trực tiếp cho mình, Anh/Chị vui lòng chờ giây lát nhé ạ!',
        citations: [],
        confidence: 1.0,
        isHandoff: true,
        handoffReason: 'EXPLICIT_HUMAN_REQUEST',
        tokensUsed: {promptTokens: 0, completionTokens: 0, totalTokens: 0},
        latencyMs: Date.now() - startTime,
      };
    }

    // Retrieve Grounded Knowledge Context
    const sources = await this.retrieveContext(db, workspaceId, {
      query: message,
      limit: input.maxContextSources || AI_CONSTANTS.DEFAULT_CHUNK_LIMIT,
      history,
      audience: input.audience || 'PUBLIC',
    });

    // If requireGrounded is true and no sources were found
    if (!sources.length && input.requireGrounded) {
      return {
        answer:
          'Dạ hiện tại trong cẩm nang hướng dẫn của công ty chưa có thông tin chính thức về phần này. Em xin phép ghi nhận và chuyển cho chuyên viên tư vấn hỗ trợ mình kỹ hơn nhé ạ!',
        citations: [],
        confidence: 0.1,
        isHandoff: true,
        handoffReason: 'NO_GROUNDED_SOURCE',
        tokensUsed: {promptTokens: 0, completionTokens: 0, totalTokens: 0},
        latencyMs: Date.now() - startTime,
      };
    }

    // Load Business Rules snapshot
    const rules = await loadAiRuleSnapshot(db, workspaceId);

    // Build Grounded Prompt with Citations
    const formattedSources = sources.map(s => ({
      title: s.title,
      content: s.text,
    }));

    const systemPrompt = workspacePrompt(message, formattedSources, history, rules.rules);

    // Citations list for UI display
    const citations = sources.map((s, idx) => ({
      reference: idx + 1,
      title: s.title,
      snippet: s.text.slice(0, 160) + (s.text.length > 160 ? '…' : ''),
      similarity: s.similarity,
    }));

    const averageSimilarity = sources.length
      ? sources.reduce((acc, s) => acc + s.similarity, 0) / sources.length
      : 0;

    // Check platform model grant via repository
    const modelRow = await AiPipelineRepository.findChatModelGrant(db, workspaceId);

    // In local / development mode without external key, return grounded synthesis
    if (!modelRow) {
      const topSource = sources[0];
      const answer = topSource
        ? `Dạ theo thông tin từ cẩm nang [1] "${topSource.title}":\n\n${topSource.text.slice(0, 300)}…\n\nAnh/Chị cần em giải thích thêm phần nào không ạ?`
        : 'Dạ em có thể hỗ trợ gì thêm cho Anh/Chị không ạ?';

      return {
        answer,
        citations,
        confidence: Number(averageSimilarity.toFixed(2)),
        isHandoff: false,
        tokensUsed: {
          promptTokens: Math.ceil(systemPrompt.length / 4),
          completionTokens: Math.ceil(answer.length / 4),
          totalTokens: Math.ceil((systemPrompt.length + answer.length) / 4),
        },
        latencyMs: Date.now() - startTime,
        modelUsed: AI_CONSTANTS.FALLBACK_LOCAL_MODEL,
      };
    }

    // Production LLM Provider Invocation
    try {
      const customBaseUrl =
        modelRow.adapter === 'custom_llm'
          ? (process.env.GOTEK_CUSTOM_LLM_BASE_URL || 'http://localhost:8000/v1')
          : null;

      const providerRes = await invokeProviderDetailed(
        modelRow.adapter,
        modelRow.id,
        customBaseUrl,
        process.env.OPENAI_API_KEY || process.env.GEMINI_API_KEY || '',
        systemPrompt,
        {timeoutMs: AI_CONSTANTS.DEFAULT_TIMEOUT_MS}
      );

      return {
        answer: providerRes.text,
        citations,
        confidence: Number(averageSimilarity.toFixed(2)),
        isHandoff: false,
        tokensUsed: providerRes.usage || {
          promptTokens: Math.ceil(systemPrompt.length / 4),
          completionTokens: Math.ceil(providerRes.text.length / 4),
          totalTokens: Math.ceil((systemPrompt.length + providerRes.text.length) / 4),
        },
        latencyMs: Date.now() - startTime,
        modelUsed: modelRow.id,
      };
    } catch {
      // Graceful fallback to grounded summary
      const top = sources[0];
      return {
        answer: top
          ? `Dạ dựa trên tài liệu "${top.title}": ${top.text.slice(0, 260)}.`
          : 'Dạ em chưa có thông tin chính thức, để em chuyển cho nhân viên hỗ trợ ạ!',
        citations,
        confidence: Number(averageSimilarity.toFixed(2)),
        isHandoff: !top,
        tokensUsed: {promptTokens: 0, completionTokens: 0, totalTokens: 0},
        latencyMs: Date.now() - startTime,
        modelUsed: AI_CONSTANTS.FALLBACK_GROUNDED_MODEL,
      };
    }
  }

  /**
   * 4. AI Playground Simulation (Test without side-effects)
   */
  static async testInPlayground(
    db: PoolClient,
    workspaceId: string,
    question: string
  ): Promise<GenerateAnswerResult & {groundedPromptPreview: string}> {
    const sources = await this.retrieveContext(db, workspaceId, {query: question, limit: 5});
    const rules = await loadAiRuleSnapshot(db, workspaceId);
    const promptPreview = workspacePrompt(
      question,
      sources.map(s => ({title: s.title, content: s.text})),
      [],
      rules.rules
    );

    const result = await this.generateAnswer(db, workspaceId, {
      message: question,
      requireGrounded: false,
    });

    return {
      ...result,
      groundedPromptPreview: promptPreview,
    };
  }

  /**
   * 5. 1-Click Teach FAQ (Direct Learning from Unanswered Questions)
   */
  static async teachFaq(
    db: PoolClient,
    workspaceId: string,
    userId: string,
    input: TeachFaqInput
  ): Promise<IngestDocumentResult> {
    const question = z.string().trim().min(2).max(100).parse(input.question);
    const answer = z.string().trim().min(2).max(1800).parse(input.answer);

    const formattedContent = `CÂU HỎI THƯỜNG GẶP (FAQ):\n- Hỏi: ${question}\n- Trả lời: ${answer}`;

    return this.ingestDocument(db, workspaceId, userId, {
      title: `FAQ: ${question.slice(0, 90)}`,
      content: formattedContent,
      categoryId: input.categoryId,
      audience: 'PUBLIC',
    });
  }
}
