/**
 * Loop Executor — Single-process autonomous loop
 * 
 * Validates loop logic before adding background process + IPC complexity.
 * Blocks until complete or error.
 */

import {
  Checkpoint,
  createCheckpoint,
  loadCheckpoint,
  loadLatestCheckpoint,
  saveCheckpoint,
  setSteps,
  startStep,
  completeStep,
  failStep,
  skipStep,
  pauseCheckpoint,
  resumeCheckpoint,
  completeCheckpoint,
  abortCheckpoint,
  shouldContinue,
  buildRetryContext,
  getProgress,
  addStep,
  type LoopState,
} from './checkpoint.js'

import { LLMClient } from '../api/llm.js'
import { getToolDefinitions, executeTool } from '../tools/registry.js'
import { loadSettings } from '../project/onboarding.js'
import { c, bold, dim } from '../ui/output/styles.js'

// ============ Failure Detection ============

const FAILURE_SIGNATURES = [
  /No such file or directory/,
  /Permission denied/,
  /command not found/,
  /cannot access/,
  /ENOENT/,
  /EPERM/,
  /EACCES/,
  /exit code [1-9]/,
  /No such file/,
  /timed out/i,
  /connection refused/i,
  /host not found/i,
  /Enter host password/i,
  /password:/i,
]

function isActualFailure(result: string): boolean {
  return FAILURE_SIGNATURES.some(r => r.test(result))
}

// ============ Types ============

export interface ExecutorOptions {
  goal: string
  cwd?: string
  checkpointId?: string          // Resume existing checkpoint
  autoConfirm?: boolean         // Skip confirmations
  maxSteps?: number             // Cap total steps
  verbose?: boolean
}

export interface ExecutionResult {
  success: boolean
  checkpoint: Checkpoint
  message: string
}

// ============ Display ============

function clearLine(): void {
  process.stdout.write('\r' + '\x1b[K')
}

function printProgress(checkpoint: Checkpoint): void {
  const progress = getProgress(checkpoint)
  const state = checkpoint.state.toUpperCase()
  
  // State color
  let stateColor = dim
  if (checkpoint.state === 'running') stateColor = c.yellow
  if (checkpoint.state === 'complete') stateColor = green
  if (checkpoint.state === 'failed' || checkpoint.state === 'aborted') stateColor = c.red
  
  // Header
  clearLine()
  process.stdout.write(
    `\r${c.cyan('◉')} ${bold(checkpoint.goal.slice(0, 60))} ` +
    `[${progress.current}/${progress.total}] ` +
    `${stateColor(state)}`
  )
  
  // Current step
  if (progress.currentStep) {
    const step = progress.currentStep
    const prefix = step.status === 'running' ? '▶' : step.status === 'failed' ? '✗' : '○'
    const stepColor = step.status === 'running' ? c.yellow : step.status === 'failed' ? c.red : dim
    process.stdout.write(`\n  ${stepColor(prefix)} ${step.description.slice(0, 70)}`)
  }
  
  // Newline at end
  process.stdout.write('\n')
}

function printStepComplete(stepNum: number, step: Checkpoint['steps'][0], ms: number): void {
  const elapsed = ms > 1000 ? `${(ms/1000).toFixed(1)}s` : `${ms}ms`
  console.log(`  ${c.green('✓')} Step ${stepNum + 1}: ${step.description.slice(0, 60)} ${dim(`[${elapsed}]`)}`)
}

function printStepFailed(stepNum: number, step: Checkpoint['steps'][0], error: string): void {
  console.log(`  ${c.red('✗')} Step ${stepNum + 1}: ${step.description.slice(0, 60)}`)
  console.log(`    ${c.red(error.slice(0, 100))}`)
}

function printSummary(checkpoint: Checkpoint, totalMs: number): void {
  const elapsed = (totalMs / 1000).toFixed(0)
  const progress = getProgress(checkpoint)
  const errors = checkpoint.context.errorsEncountered.length
  
  console.log('\n' + dim('─'.repeat(70)))
  
  if (checkpoint.state === 'complete') {
    console.log(`${c.green('✓')} Loop complete`)
  } else if (checkpoint.state === 'aborted') {
    console.log(`${c.yellow('⚠')} Loop aborted`)
  } else if (checkpoint.state === 'failed') {
    console.log(`${c.red('✗')} Loop failed`)
  } else {
    console.log(`${c.yellow('◷')} Loop paused`)
  }
  
  console.log(`  Goal: ${checkpoint.goal.slice(0, 60)}`)
  console.log(`  Steps: ${progress.current}/${progress.total} (${progress.percent}%)`)
  console.log(`  Time: ${elapsed}s`)
  console.log(`  Errors: ${errors}`)
  console.log(`  Files created: ${checkpoint.context.filesCreated.length}`)
  
  if (checkpoint.context.filesCreated.length > 0) {
    console.log(`  ${dim('Created:')}`)
    for (const f of checkpoint.context.filesCreated.slice(0, 5)) {
      console.log(`    ${dim(f)}`)
    }
    if (checkpoint.context.filesCreated.length > 5) {
      console.log(`    ${dim(`...and ${checkpoint.context.filesCreated.length - 5} more`)}`)
    }
  }
  
  console.log(`\n  ${dim('Checkpoint:')} ${checkpoint.id}`)
  console.log(dim('─'.repeat(70)))
}

// ============ Planner ============

/**
 * Break goal into steps using LLM
 */
export async function planSteps(goal: string, client: LLMClient, cwd: string): Promise<string[]> {
  const systemPrompt = `You are a task planner for an autonomous coding agent.

CRITICAL RULES:
1. Each step must be ONE atomic action
2. When user asks to "create a post", "make a curl call", "run a command" → plan a SINGLE Bash tool step that does EVERYTHING in one command (curl + redirect OR && echo)
3. NEVER split into Glob + Bash + Read — one Bash command that does the full task
4. For WordPress/REST API tasks: single curl command with -o or | tee or && echo to save output
5. Maximum 8 steps, minimum 1 step

BAD examples:
- User: "create a file" → Plan: "Glob to find location" + "Write file" (WRONG)
- User: "run curl to create post" → Plan: "Check environment" + "Execute curl" (WRONG)
- User: "create WordPress post" → Plan: "Read existing files" + "Execute curl" (WRONG)

GOOD examples:
- "Run curl to create WordPress post and save response to ~/output.txt" (one step)
- "Create /tmp/test.txt with hello world content" (Write tool)
- "Run git status and echo result" (Bash tool)

Return a JSON array of step descriptions:
["Action description 1", "Action description 2", ...]`

  try {
    const result = await client.chat([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Goal: ${goal}\nCWD: ${cwd}` }
    ], { max_tokens: 1000, temperature: 0 })
    
    // Try to parse as JSON array
    const content = result.content.trim()
    
    // Handle markdown code blocks
    let jsonStr = content
    if (content.includes('```json')) {
      jsonStr = content.split('```json')[1].split('```')[0]
    } else if (content.includes('```')) {
      jsonStr = content.split('```')[1].split('```')[0]
    }
    
    const steps = JSON.parse(jsonStr.trim())
    if (Array.isArray(steps)) {
      return steps.map(s => String(s))
    }
    
    // Fallback: split by newlines
    return content.split('\n').filter(l => l.trim()).slice(0, 10)
  } catch (err) {
    console.log(`${c.yellow('⚠')} Planning failed: ${err}, using fallback`)
    // Fallback steps
    return [
      `Analyze goal and create plan for: ${goal.slice(0, 50)}`,
      `Execute the first part of the plan`,
      `Execute the second part`,
      `Verify the results`,
      `Make any necessary corrections`,
    ]
  }
}

// ============ Tool Executor ============

/**
 * Execute a step's worth of tools
 */
async function executeStep(
  step: Checkpoint['steps'][0],
  context: Checkpoint['context'],
  cwd: string,
  sessionMessages: Array<{ role: string; content: string }>,
  client: LLMClient,
  options: { verbose?: boolean }
): Promise<{ toolCalls: Checkpoint['steps'][0]['toolCalls']; shouldContinue: boolean }> {
  const toolDefs = getToolDefinitions()
  const toolCalls: Checkpoint['steps'][0]['toolCalls'] = []
  let shouldContinue = true
  
  // Build context for this step
  const stepContext = `
Current step: ${step.description}
Working directory: ${cwd}
Files created so far: ${context.filesCreated.join(', ') || 'none'}
Errors so far: ${context.errorsEncountered.length}

${step.retryCount > 0 ? buildRetryContext({ steps: [step], context } as Checkpoint, 0) : ''}
`.trim()

  // Ask LLM what to do for this step
  try {
    const result = await client.chat([
      ...sessionMessages.slice(-20), // Last 20 messages for context
      { role: 'user', content: `\n\nTASK: ${step.description}\n\nContext:\n${stepContext}\n\nWhat tools should I use to complete this step? Respond with specific tool calls.` }
    ], { tools: toolDefs, max_tokens: 2000, temperature: 0 })

    // Extract tool calls from response
    if (result.toolCalls && result.toolCalls.length > 0) {
      for (const tc of result.toolCalls) {
        if (options.verbose) {
          console.log(`  ${dim('→')} ${tc.name}(${JSON.stringify(tc.input).slice(0, 50)}...)`)
        }
        
        try {
          const execResult = await executeTool(tc.name, tc.input, { cwd, sessionId: 'loop' })
          
          // Detect failures from result content (not just isError flag)
          // This catches bash exit code failures that appear as "success" execution
          const isToolFailure = execResult.isError || isActualFailure(execResult.content)
          
          toolCalls.push({
            name: tc.name,
            input: tc.input,
            result: execResult.content,
            success: !isToolFailure,
          })
          
          if (isToolFailure) {
            context.errorsEncountered.push({
              step: step.id,
              error: execResult.content,
              timestamp: new Date().toISOString(),
            })
            shouldContinue = false
            break
          }
          
          // Add to session messages
          sessionMessages.push({
            role: 'assistant',
            content: `Used ${tc.name} to ${tc.input.description || tc.input.command || 'execute task'}`,
            tool_calls: [{ id: tc.id, name: tc.name, input: tc.input }]
          })
          sessionMessages.push({
            role: 'tool',
            content: execResult.content.slice(0, 500), // Truncate for context
            tool_call_id: tc.id,
            name: tc.name,
          })
          
        } catch (err) {
          toolCalls.push({
            name: tc.name,
            input: tc.input,
            result: String(err),
            success: false,
          })
          shouldContinue = false
          break
        }
      }
    } else {
      // No tool calls, just text response
      if (result.content) {
        toolCalls.push({
          name: 'Response',
          input: {},
          result: result.content,
          success: true,
        })
      }
    }
  } catch (err) {
    toolCalls.push({
      name: 'Error',
      input: {},
      result: String(err),
      success: false,
    })
    shouldContinue = false
  }
  
  return { toolCalls, shouldContinue }
}

// ============ Main Executor ============

/**
 * Run the autonomous loop
 */
export async function runLoop(options: ExecutorOptions): Promise<ExecutionResult> {
  const startTime = Date.now()
  const cwd = options.cwd || process.cwd()
  
  console.log(`\n${c.cyan('◉')} ${bold('Starting autonomous loop')}`)
  console.log(`  ${dim('Goal:')} ${options.goal.slice(0, 70)}`)
  console.log(`  ${dim('CWD:')} ${cwd}`)
  console.log(dim('─'.repeat(70)))
  
  // Initialize or resume checkpoint
  let checkpoint: Checkpoint
  
  if (options.checkpointId) {
    const loaded = loadCheckpoint(options.checkpointId)
    if (!loaded) {
      return { success: false, checkpoint: null!, message: `Checkpoint ${options.checkpointId} not found` }
    }
    checkpoint = loaded
    console.log(`  ${dim('Resuming checkpoint:')} ${checkpoint.id}`)
  } else {
    checkpoint = createCheckpoint(options.goal, cwd, {
      maxRetries: options.maxSteps ? 2 : 2,
    })
  }
  
  // Initialize LLM client
  const settings = loadSettings()
  const { getMiniMaxToken } = await import('../index.js')
  const token = getMiniMaxToken()
  const client = new LLMClient(token, settings.model || 'MiniMax-M2.7')
  
  // Session messages for context
  const sessionMessages: Array<{ role: string; content: string; name?: string }> = []
  
  // Plan steps if pending
  if (checkpoint.state === 'pending' || checkpoint.steps.length === 0) {
    console.log(`\n  ${dim('Planning...')}`)
    checkpoint.state = 'running'
    const steps = await planSteps(options.goal, client, cwd)
    setSteps(checkpoint, steps)
    console.log(`  ${dim(`Created ${steps.length} steps`)}`)
  }
  
  // Main loop
  while (shouldContinue(checkpoint).continue) {
    const currentStepId = checkpoint.currentStep
    
    // Check if all steps done
    if (currentStepId >= checkpoint.steps.length) {
      completeCheckpoint(checkpoint)
      break
    }
    
    const step = checkpoint.steps[currentStepId]
    
    // Start step
    startStep(checkpoint, currentStepId)
    printProgress(checkpoint)
    
    const stepStartTime = Date.now()
    
    // Execute step
    const { toolCalls, shouldContinue: stepShouldContinue } = await executeStep(
      step,
      checkpoint.context,
      cwd,
      sessionMessages,
      client,
      { verbose: options.verbose }
    )
    
    const stepMs = Date.now() - stepStartTime
    
    // Handle step result
    if (!stepShouldContinue) {
      // Check retry count
      if (step.retryCount >= (checkpoint.settings?.maxRetries ?? 2)) {
        failStep(checkpoint, currentStepId, step.error || 'Max retries exceeded', toolCalls)
        printStepFailed(currentStepId, step, step.error || 'Max retries exceeded')
        abortCheckpoint(checkpoint)
        break
      }
      
      // Retry the same step
      failStep(checkpoint, currentStepId, step.error || 'Step failed', toolCalls)
      printStepFailed(currentStepId, step, step.error || 'Step failed')
      console.log(`  ${c.yellow('↻')} Retrying step ${currentStepId + 1} (attempt ${step.retryCount + 1}/${checkpoint.settings.maxRetries})`)
      continue
    }
    
    // Step succeeded
    completeStep(checkpoint, currentStepId, toolCalls)
    printStepComplete(currentStepId, step, stepMs)
    
    // Progress display every N steps
    if ((currentStepId + 1) % checkpoint.settings.reportEveryNSteps === 0) {
      printProgress(checkpoint)
    }
  }
  
  const totalMs = Date.now() - startTime
  printSummary(checkpoint, totalMs)
  
  return {
    success: checkpoint.state === 'complete',
    checkpoint,
    message: checkpoint.state === 'complete' 
      ? `Completed ${checkpoint.steps.length} steps in ${(totalMs/1000).toFixed(0)}s`
      : `Stopped at step ${checkpoint.currentStep + 1}: ${checkpoint.state}`,
  }
}

/**
 * Pause the loop (signal handler)
 */
export function pauseLoop(checkpoint: Checkpoint): void {
  pauseCheckpoint(checkpoint)
  console.log(`\n${c.yellow('⏸')} Loop paused. Resume with /resume ${checkpoint.id}`)
}

/**
 * Resume a paused loop
 */
export async function resumeLoop(checkpointId: string): Promise<ExecutionResult> {
  const checkpoint = loadCheckpoint(checkpointId)
  if (!checkpoint) {
    return { success: false, checkpoint: null!, message: 'Checkpoint not found' }
  }
  
  resumeCheckpoint(checkpoint)
  return runLoop({ goal: checkpoint.goal, checkpointId, cwd: checkpoint.context.cwd })
}
