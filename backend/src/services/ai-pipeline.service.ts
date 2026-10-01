import type {PoolClient} from 'pg';
import {
  AIPipeline,
  type IngestDocumentInput,
  type IngestDocumentResult,
  type RetrieveContextInput,
  type RetrievedSourceChunk,
  type GenerateAnswerInput,
  type GenerateAnswerResult,
  type TeachFaqInput,
} from '../modules/ai/ai-pipeline';

/**
 * Service layer wrapper for AIPipeline adhering to Clean Architecture.
 */
export class AiPipelineService {
  static async ingestDocument(
    db: PoolClient,
    workspaceId: string,
    userId: string,
    input: IngestDocumentInput
  ): Promise<IngestDocumentResult> {
    return AIPipeline.ingestDocument(db, workspaceId, userId, input);
  }

  static async retrieveContext(
    db: PoolClient,
    workspaceId: string,
    input: RetrieveContextInput
  ): Promise<RetrievedSourceChunk[]> {
    return AIPipeline.retrieveContext(db, workspaceId, input);
  }

  static async generateAnswer(
    db: PoolClient,
    workspaceId: string,
    input: GenerateAnswerInput
  ): Promise<GenerateAnswerResult> {
    return AIPipeline.generateAnswer(db, workspaceId, input);
  }

  static async testInPlayground(
    db: PoolClient,
    workspaceId: string,
    question: string
  ): Promise<GenerateAnswerResult & {groundedPromptPreview: string}> {
    return AIPipeline.testInPlayground(db, workspaceId, question);
  }

  static async teachFaq(
    db: PoolClient,
    workspaceId: string,
    userId: string,
    input: TeachFaqInput
  ): Promise<IngestDocumentResult> {
    return AIPipeline.teachFaq(db, workspaceId, userId, input);
  }
}
