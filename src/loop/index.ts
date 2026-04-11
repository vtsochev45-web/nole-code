/**
 * Loop Module — Autonomous execution with checkpointing
 */

export {
  // Checkpoint operations
  createCheckpoint,
  loadCheckpoint,
  loadLatestCheckpoint,
  saveCheckpoint,
  deleteCheckpoint,
  listCheckpoints,
  
  // Step operations
  addStep,
  setSteps,
  startStep,
  completeStep,
  failStep,
  skipStep,
  
  // State transitions
  pauseCheckpoint,
  resumeCheckpoint,
  waitForConfirmation,
  completeCheckpoint,
  abortCheckpoint,
  
  // Query helpers
  getProgress,
  shouldContinue,
  buildRetryContext,
  
  // Types
  type Checkpoint,
  type LoopStep,
  type LoopState,
  type ExecutorOptions,
  type ExecutionResult,
} from './checkpoint.js'

export {
  runLoop,
  pauseLoop,
  resumeLoop,
} from './executor.js'
