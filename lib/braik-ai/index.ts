export { buildContext, type BuildResult } from "./context-builder"
export { detectDomain } from "./detect-domain"
export { detectIntent } from "./detect-intent"
export { detectEntities } from "./detect-entities"
export { mergeContext, type MergeInput } from "./merge-context"
export { buildCoachBPrompt, createGenericContext, type BuildPromptInput } from "./prompt-builder"
export { sendCoachBPrompt, isOpenAIConfigured } from "./openai-client"
export type {
  QuestionDomain,
  QuestionIntent,
  DetectedEntities,
  BraikContext,
  PlayerContext,
  PlayContext,
  InjuryContext,
  ScheduleContext,
  RosterContext,
  ReportContext,
  TeamInfo,
  ContextModuleInput,
} from "./types"
