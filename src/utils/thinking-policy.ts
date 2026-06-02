// Thinking policy for MiniMax-M3.
//
// M3 reasons by default; the thinking trace dominates latency (~36 tok/s, often
// 10-18k thinking tokens before the answer). Disabling it (thinking:{type:
// 'disabled'}) is ~5x faster but costs correctness on genuine multi-step
// reasoning. This module decides, per task, whether to keep thinking.
//
// Three modes (NOLE_THINKING env, or --fast → 'auto'):
//   on    — always think (default; current behaviour)
//   off   — never think (NOLE_THINKING=off)
//   auto  — heuristic: think for reasoning-heavy work + error recovery, skip for
//           mechanical actions, keep thinking when uncertain (--fast / NOLE_THINKING=auto)
//
// The heuristic is deliberately conservative: it only drops thinking when the
// task looks like a plain mechanical action AND shows no reasoning signal. It is
// a coarse keyword classifier, not a model — easy to read and tune below.

export type ThinkingMode = 'on' | 'off' | 'auto'

export function getThinkingMode(): ThinkingMode {
  const v = (process.env.NOLE_THINKING || '').trim().toLowerCase()
  if (v === 'off') return 'off'
  if (v === 'auto') return 'auto'
  if (v === 'on') return 'on'
  return 'on' // default: unchanged behaviour
}

// Signals that a task needs the reasoning pass — debugging, algorithms with
// subtle correctness, math/logic, analysis, design. If any of these appear we
// keep thinking regardless of how the request is phrased.
const REASONING_HINTS: RegExp[] = [
  /\bdebug|\bbug\b|root cause|\bdiagnos/i,
  /\bwhy\b|\bexplain|\banaly[sz]e/i,
  /race condition|deadlock|concurren|thread.?safe|data race/i,
  /optimi[sz]e|performance|complexity|big-?o\b/i,
  /\brefactor|\bredesign|\barchitect|\bdesign\b/i,
  /\balgorithm|\bprove\b|\bproof\b|\bderive\b|\binvariant/i,
  /edge case|corner case|off-by-one|\btricky\b/i,
  /security|vulnerab|exploit|injection/i,
  /how many|\bcount\b|\bprobabilit|combinator|number of ways/i,
  /trade-?off|\bcompare\b|\bdecide\b|\bplan\b|figure out|reason about/i,
  /\bfix\b.*\b(bug|issue|error|fail|crash|broken)/i,
]

// Signals that a task is a plain mechanical action the model likely already
// knows how to do without deliberation. Matched only at the start of the task.
const SIMPLE_ACTION_START =
  /^\s*(create|write|add|make|generate|scaffold|rename|move|copy|delete|remove|list|show|print|read|display|cat|format|prettif|lint|install|run|execute|append|insert|replace|set|update the|bump|commit|stage)\b/i

export interface ThinkingDecision {
  /** true → send thinking:{type:'disabled'} (skip the reasoning pass) */
  disable: boolean
  /** human-readable explanation, surfaced under NOLE_DEBUG */
  reason: string
}

/**
 * Decide whether to disable thinking for a task in 'auto' mode.
 * `errorLatched` is set by the caller once a turn has hit a tool error / test /
 * diagnose failure this run — recovery is reasoning, so we keep thinking after that.
 */
export function decideThinking(taskText: string, errorLatched: boolean): ThinkingDecision {
  if (errorLatched) return { disable: false, reason: 'error recovery — keep thinking' }

  const text = (taskText || '').slice(0, 2000)
  const hint = REASONING_HINTS.find((re) => re.test(text))
  if (hint) return { disable: false, reason: `reasoning signal (${hint.source.slice(0, 24)}…)` }

  if (SIMPLE_ACTION_START.test(text)) {
    return { disable: true, reason: 'mechanical action, no reasoning signal — skip thinking' }
  }

  return { disable: false, reason: 'uncertain — keep thinking (conservative default)' }
}

/**
 * Resolve the per-turn disable-thinking decision for the whole loop.
 * Returns { disable, reason } given the mode, the task text, and the error latch.
 */
export function resolveThinking(
  mode: ThinkingMode,
  taskText: string,
  errorLatched: boolean,
): ThinkingDecision {
  if (mode === 'off') return { disable: true, reason: 'NOLE_THINKING=off' }
  if (mode === 'on') return { disable: false, reason: 'thinking on (default)' }
  return decideThinking(taskText, errorLatched)
}
