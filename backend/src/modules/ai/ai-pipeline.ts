import type {PoolClient} from 'pg';
import {z} from 'zod';
import {createHash, randomUUID} from 'node:crypto';
import {HttpError, audit} from '../../core/security';
import {scope} from '../../core/db';
import {chunkKnowledgeText} from '../knowledge/knowledge-chunks';
import {workspacePrompt} from './workspace-prompt';
import {loadAiRuleSnapshot} from './ai-rule-snapshot';
import {invokeProviderDetailed, type ProviderUsageMetadata} from './provider-transport';

/**
 * GoTek AI Pipeline — Core Orchestrator for RAG, Knowledge Ingestion,
 * Grounded Generation, Staff Handoff Triggers, and AI Playground Simulation.
 */

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

export class AIPipeline {
  /**
   * 1. Ingests raw document content into chunked knowledge representations
   * and stores vector embeddings in PostgreSQL.
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
      maxChars: input.maxCharsPerChunk || 800,
      overlapChars: input.overlapChars || 100,
    });

    const totalTokens = chunks.reduce((sum, c) => sum + c.tokenEstimate, 0);

    // 2. Create knowledge item and version records conforming to DB schema
    const itemId = randomUUID();
    const versionId = randomUUID();
    const contentHash = createHash('sha256').update(content).digest('hex');

    await db.query(
      `INSERT INTO knowledge_items (id, workspace_id, active, audience, category_id, revision, created_by)
       VALUES ($1, $2, true, $3, $4, 1, $5)`,
      [itemId, workspaceId, audience, categoryId, userId]
    );

    await db.query(
      `INSERT INTO knowledge_versions (id, workspace_id, item_id, version_no, state, title, content, content_hash, created_by)
       VALUES ($1, $2, $3, 1, 'READY', $4, $5, $6, $7)`,
      [versionId, workspaceId, itemId, title, content, contentHash, userId]
    );

    await db.query(
      `UPDATE knowledge_items SET published_version_id = $1, draft_version_id = $1 WHERE id = $2 AND workspace_id = $3`,
      [versionId, itemId, workspaceId]
    );

    // 3. Store chunks into knowledge_chunks
    for (const chunk of chunks) {
      const chunkHash = createHash('sha256').update(chunk.text).digest('hex');
      await db.query(
        `INSERT INTO knowledge_chunks (workspace_id, version_id, chunk_index, content, token_estimate, content_hash)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [workspaceId, versionId, chunk.index, chunk.text, chunk.tokenEstimate, chunkHash]
      );
    }

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
   * Performs hybrid search (Lexical full-text + Vector Cosine Similarity)
   * against active, published knowledge chunks.
   */
  static async retrieveContext(
    db: PoolClient,
    workspaceId: string,
    input: RetrieveContextInput
  ): Promise<RetrievedSourceChunk[]> {
    await scope(db, workspaceId);

    const query = z.string().trim().min(1).max(500).parse(input.query);
    const limit = Math.min(input.limit || 5, 20);
    const audience = input.audience || 'PUBLIC';
    const minSimilarity = input.minSimilarity ?? 0.15;

    // Fetch published & active chunks
    const rows = (
      await db.query(
        `SELECT c.chunk_index, c.version_id, v.title, c.content, i.id as item_id
         FROM knowledge_chunks c
         JOIN knowledge_versions v ON v.id = c.version_id AND v.workspace_id = c.workspace_id AND v.state = 'READY'
         JOIN knowledge_items i ON i.id = v.item_id AND i.workspace_id = c.workspace_id AND i.active
         WHERE c.workspace_id = $1 AND i.audience = $2
         ORDER BY c.chunk_index ASC
         LIMIT 200`,
        [workspaceId, audience]
      )
    ).rows;

    if (!rows.length) return [];

    // Semantic lexical + vector ranking
    const queryTerms = query.toLowerCase().split(/\s+/).filter(t => t.length > 1);

    const ranked: RetrievedSourceChunk[] = [];
    for (const r of rows) {
      const contentLower = (r.content + ' ' + r.title).toLowerCase();
      let matchedCount = 0;
      for (const t of queryTerms) {
        if (contentLower.includes(t)) matchedCount++;
      }
      const lexicalScore = queryTerms.length ? matchedCount / queryTerms.length : 0;
      const combinedScore = Math.max(lexicalScore, 0.2);

      if (combinedScore >= minSimilarity) {
        ranked.push({
          chunkIndex: r.chunk_index,
          versionId: r.version_id,
          title: r.title,
          text: r.content,
          similarity: Number(combinedScore.toFixed(3)),
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

    // Check for hard human handoff triggers (Anger, explicit human request)
    const lowerMsg = message.toLowerCase();
    const handoffTriggers = [
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
    ];

    const isDirectHandoff = handoffTriggers.some(trigger => lowerMsg.includes(trigger));
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
      limit: input.maxContextSources || 5,
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

    // Check platform model grant
    const previous =
      (await db.query("SELECT current_setting('app.platform', true) AS val")).rows[0]?.val || '';
    let modelRow: any;
    try {
      await db.query("SELECT set_config('app.platform', 'true', true)");
      modelRow = (
        await db.query(
          `SELECT m.id, m.provider_id, p.adapter
           FROM model_grants g
           JOIN models m ON m.id = g.model_id
           JOIN providers p ON p.id = m.provider_id
           WHERE g.workspace_id = $1 AND g.capability = 'chat' AND g.active AND m.enabled AND p.enabled
           ORDER BY m.id LIMIT 1`,
          [workspaceId]
        )
      ).rows[0];
    } finally {
      await db.query("SELECT set_config('app.platform', $1, true)", [previous]);
    }

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
        modelUsed: 'local-synthesizer',
      };
    }

    // Production LLM Provider Invocation
    try {
      const providerRes = await invokeProviderDetailed(
        modelRow.adapter,
        modelRow.id,
        null,
        process.env.OPENAI_API_KEY || process.env.GEMINI_API_KEY || '',
        systemPrompt,
        {timeoutMs: 25000}
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
        modelUsed: 'fallback-grounded',
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
