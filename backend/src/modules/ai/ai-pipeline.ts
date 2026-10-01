/**
 * GoTek AI Pipeline — Core Orchestrator for RAG, Knowledge Ingestion,
 * Grounded Generation, Staff Handoff Triggers, and AI Playground Simulation.
 * Re-exports AiPipelineService for module-level backward compatibility conforming to Clean Architecture.
 */
export {
  AiPipelineService as AIPipeline,
  AI_CONSTANTS,
  type IngestDocumentInput,
  type IngestDocumentResult,
  type RetrieveContextInput,
  type RetrievedSourceChunk,
  type GenerateAnswerInput,
  type GenerateAnswerResult,
  type TeachFaqInput,
} from '../../services/ai-pipeline.service';
