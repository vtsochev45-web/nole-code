/**
 * Plan Mode - Step-by-Step Approval Workflow
 * When enabled, each major step requires user confirmation
 */

import * as readline from 'readline'
import { feature } from '../feature-flags/index.js'

export interface PlanStep {
  id: string
  description: string
  tool?: string
  input?: Record<string, unknown>
  status: 'pending' | 'approved' | 'denied' | 'modified' | 'skipped'
  modifiedInput?: Record<string, unknown>
  reason?: string
}

export interface Plan {
  id: string
  title: string
  goal: string
  steps: PlanStep[]
  currentStep: number
  status: 'active' | 'completed' | 'aborted'
  createdAt: string
}

let currentPlan: Plan | null = null
let rl: readline.Interface | null = null

/**
 * Enter plan mode for a task
 */
export function enterPlanMode(goal: string, steps: PlanStep[]): Plan {
  if (currentPlan && currentPlan.status === 'active') {
    console.log('\n⚠️  Plan already active. Use /plan approve to continue or /plan abort to cancel.')
    return currentPlan
  }

  const cleanGoal = goal
    .replace(/^(let['’]?s?\s+)?(make\s+a\s+plan|plan|break\s+this\s+down|walk\s+me\s+through|step\s+by\s+step|enter\s+plan\s*mode)\s*/i, '')
    .trim()
  const title = cleanGoal ? cleanGoal.slice(0, 60) : goal.slice(0, 60)

  currentPlan = {
    id: `plan_${Date.now()}`,
    title,
    goal,
    steps: steps.map((s, i) => ({ ...s, id: `step_${i}`, status: 'pending' as const })),
    currentStep: 0,
    status: 'active',
    createdAt: new Date().toISOString(),
  }

  console.log('\n' + '='.repeat(60))
  console.log('📋 PLAN MODE')
  console.log('='.repeat(60))
  console.log(`\nGoal: ${goal}\n`)
  
  displayPlan(currentPlan)
  
  console.log('\nCommands:')
  console.log('  approve (y)  - Approve current step')
  console.log('  deny (n)      - Deny current step')
  console.log('  modify (m)   - Modify step input')
  console.log('  skip (s)      - Skip this step')
  console.log('  abort         - Cancel entire plan')
  console.log('  help         - Show this help\n')

  return currentPlan
}

/**
 * Display plan status
 */
export function displayPlan(plan: Plan): void {
  console.log(`Plan: ${plan.title}`)
  console.log(`Progress: ${plan.currentStep + 1}/${plan.steps.length} steps\n`)
  
  for (let i = 0; i < plan.steps.length; i++) {
    const step = plan.steps[i]
    const prefix = i === plan.currentStep 
      ? '  → ' 
      : i < plan.currentStep 
        ? '    ' 
        : '    '
    
    const statusIcon = step.status === 'approved' ? '✅'
      : step.status === 'denied' ? '❌'
      : step.status === 'skipped' ? '⏭'
      : step.status === 'modified' ? '✏️'
      : i === plan.currentStep ? '⏳'
      : '  '
    
    const toolPart = step.tool ? `[${step.tool}] ` : ''
    console.log(`${prefix}${statusIcon} ${toolPart}${step.description}`)
    
    if (step.status === 'denied' && step.reason) {
      console.log(`${prefix}   Reason: ${step.reason}`)
    }
    if (step.status === 'modified' && step.modifiedInput) {
      console.log(`${prefix}   Modified: ${JSON.stringify(step.modifiedInput)}`)
    }
  }
}

/**
 * Get current plan
 */
export function getCurrentPlan(): Plan | null {
  return currentPlan
}

/**
 * Get current step
 */
export function getCurrentStep(): PlanStep | null {
  if (!currentPlan) return null
  if (currentPlan.currentStep >= currentPlan.steps.length) return null
  return currentPlan.steps[currentPlan.currentStep]
}

/**
 * Approve current step
 */
export function approveStep(): { approved: boolean; step?: PlanStep; plan?: Plan } {
  if (!currentPlan || currentPlan.status !== 'active') {
    return { approved: false }
  }

  const step = getCurrentStep()
  if (!step) {
    return { approved: false }
  }

  step.status = 'approved'
  currentPlan.currentStep++

  // Check if plan is complete
  if (currentPlan.currentStep >= currentPlan.steps.length) {
    currentPlan.status = 'completed'
    console.log('\n✅ Plan completed!')
  } else {
    console.log(`\n✅ Step approved. ${currentPlan.steps.length - currentPlan.currentStep} steps remaining.`)
    displayPlan(currentPlan)
  }

  return { approved: true, step, plan: currentPlan }
}

/**
 * Deny current step
 */
export function denyStep(reason?: string): { denied: boolean; step?: PlanStep; plan?: Plan } {
  if (!currentPlan || currentPlan.status !== 'active') {
    return { denied: false }
  }

  const step = getCurrentStep()
  if (!step) {
    return { denied: false }
  }

  step.status = 'denied'
  step.reason = reason || 'User denied this step'
  currentPlan.status = 'aborted'

  console.log(`\n❌ Step denied: ${reason || 'User denied'}`)
  console.log('Plan aborted.')

  return { denied: true, step, plan: currentPlan }
}

/**
 * Skip current step
 */
export function skipStep(): { skipped: boolean; step?: PlanStep; plan?: Plan } {
  if (!currentPlan || currentPlan.status !== 'active') {
    return { skipped: false }
  }

  const step = getCurrentStep()
  if (!step) {
    return { skipped: false }
  }

  step.status = 'skipped'
  currentPlan.currentStep++

  if (currentPlan.currentStep >= currentPlan.steps.length) {
    currentPlan.status = 'completed'
    console.log('\n✅ Plan completed (with skips)!')
  } else {
    console.log(`\n⏭  Step skipped. ${currentPlan.steps.length - currentPlan.currentStep} steps remaining.`)
    displayPlan(currentPlan)
  }

  return { skipped: true, step, plan: currentPlan }
}

/**
 * Modify current step input
 */
export function modifyStep(newInput: Record<string, unknown>): { modified: boolean; step?: PlanStep; plan?: Plan } {
  if (!currentPlan || currentPlan.status !== 'active') {
    return { modified: false }
  }

  const step = getCurrentStep()
  if (!step) {
    return { modified: false }
  }

  step.modifiedInput = { ...step.input, ...newInput }
  step.status = 'modified'

  console.log(`\n✏️  Step modified: ${JSON.stringify(step.modifiedInput)}`)

  return { modified: true, step, plan: currentPlan }
}

/**
 * Abort entire plan
 */
export function abortPlan(): Plan | null {
  if (!currentPlan) return null

  currentPlan.status = 'aborted'
  const plan = currentPlan
  currentPlan = null

  console.log('\n🛑 Plan aborted.')
  return plan
}

/**
 * Prompt for user input in plan mode
 */
export async function promptForPlanAction(): Promise<string> {
  return new Promise((resolve) => {
    rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    })

    rl.question('\nPlan action: ', (answer) => {
      resolve(answer.trim().toLowerCase())
    })
  })
}

/**
 * Handle plan mode command
 */
export function handlePlanCommand(input: string): {
  action: 'approve' | 'deny' | 'modify' | 'skip' | 'abort' | 'none'
  args?: string[]
} {
  const trimmed = input.trim().toLowerCase()
  
  if (trimmed === 'y' || trimmed === 'yes' || trimmed === 'approve') {
    return { action: 'approve' }
  }
  
  if (trimmed === 'n' || trimmed === 'no' || trimmed === 'deny') {
    return { action: 'deny' }
  }
  
  if (trimmed === 's' || trimmed === 'skip') {
    return { action: 'skip' }
  }
  
  if (trimmed === 'm' || trimmed === 'modify') {
    return { action: 'modify' }
  }
  
  if (trimmed === 'abort' || trimmed === 'cancel') {
    return { action: 'abort' }
  }
  
  if (trimmed === 'help' || trimmed === '?') {
    console.log('\nCommands:')
    console.log('  approve (y)  - Approve current step')
    console.log('  deny (n)     - Deny current step')
    console.log('  modify (m)  - Modify step input')
    console.log('  skip (s)     - Skip this step')
    console.log('  abort       - Cancel entire plan\n')
    return { action: 'none' }
  }
  
  return { action: 'none' }
}

/**
 * Check if plan mode is active
 */
export function isPlanModeActive(): boolean {
  return currentPlan !== null && currentPlan.status === 'active'
}

/**
 * Generate plan from task description
 * Creates a simple step-by-step breakdown
 */
export function generatePlanSteps(goal: string): PlanStep[] {
  const steps: PlanStep[] = []
  
  // Clean up goal for title extraction
  let cleanGoal = goal
    .replace(/^(plan|lets?\s+make\s+a\s+plan|lets?\s+plan|make\s+a\s+plan|step\s+by\s+step|enter\s+plan\s*mode)\s*/i, '')
    .trim()
  
  // If nothing left after cleaning, use original
  if (!cleanGoal) cleanGoal = goal
  
  const lowerGoal = cleanGoal.toLowerCase()
  
  if (lowerGoal.includes('create') || lowerGoal.includes('build') || lowerGoal.includes('make')) {
    steps.push({
      id: '',
      description: 'Understand requirements and project structure',
      status: 'pending',
    })
    steps.push({
      id: '',
      description: 'Create/update necessary files',
      status: 'pending',
    })
    steps.push({
      id: '',
      description: 'Test the implementation',
      status: 'pending',
    })
  }
  
  if (lowerGoal.includes('fix') || lowerGoal.includes('bug') || lowerGoal.includes('error')) {
    steps.push({
      id: '',
      description: 'Identify the root cause',
      status: 'pending',
    })
    steps.push({
      id: '',
      description: 'Implement the fix',
      status: 'pending',
    })
    steps.push({
      id: '',
      description: 'Verify the fix works',
      status: 'pending',
    })
  }
  
  if (lowerGoal.includes('test') || lowerGoal.includes('spec')) {
    steps.push({
      id: '',
      description: 'Write or update tests',
      status: 'pending',
    })
    steps.push({
      id: '',
      description: 'Run tests to verify',
      status: 'pending',
    })
  }
  
  // Default: single step
  if (steps.length === 0) {
    steps.push({
      id: '',
      description: goal,
      status: 'pending',
    })
  }
  
  return steps
}

/**
 * Cleanup plan mode
 */
export function cleanupPlanMode(): void {
  if (rl) {
    rl.close()
    rl = null
  }
}

