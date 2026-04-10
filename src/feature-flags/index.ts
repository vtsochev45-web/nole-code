/**
 * Feature Flags System
 * Inspired by Nole Code's bun:bundle DCE system
 * 
 * Features are enabled via NOLE_FEATURES env var (comma-separated)
 * or via setFeature() for runtime toggling.
 * 
 * Usage:
 *   import { feature, setFeature, enableFeature, disableFeature } from './feature-flags'
 *   
 *   if (feature('SESSION_COMPACT')) {
 *     // Enable session memory compaction
 *   }
 */

// Feature registry
const ENABLED_FEATURES = new Set<string>([
  'TOOL_RESULT_STREAMING',  // Stream tool results to UI as they arrive
  'VERBOSE_OUTPUT',         // Show detailed tool execution info
])

// Environment override
const envFeatures = process.env.NOLE_FEATURES
if (envFeatures) {
  for (const f of envFeatures.split(',')) {
    const trimmed = f.trim()
    if (trimmed) ENABLED_FEATURES.add(trimmed)
  }
}

/**
 * Check if a feature is enabled
 */
export function feature(name: string): boolean {
  return ENABLED_FEATURES.has(name)
}

/**
 * Enable a feature at runtime
 */
export function enableFeature(name: string): void {
  ENABLED_FEATURES.add(name)
}

export function setFeature(name: string, enabled: boolean): void {
  if (enabled) {
    ENABLED_FEATURES.add(name)
  } else {
    ENABLED_FEATURES.delete(name)
  }
}

/**
 * Disable a feature at runtime
 */
export function disableFeature(name: string): void {
  ENABLED_FEATURES.delete(name)
}

/**
 * List all enabled features
 */
export function listFeatures(): string[] {
  return Array.from(ENABLED_FEATURES).sort()
}

/**
 * Get feature configuration
 */
export function getFeatureConfig(): Record<string, boolean> {
  const config: Record<string, boolean> = {}
  for (const f of ALL_FEATURES) {
    config[f] = feature(f)
  }
  return config
}

// All available features
export const ALL_FEATURES = [
  // Session & Context Management
  'SESSION_COMPACT',        // Token budget + message pruning
  'AUTO_COMPACT',          // Trigger compaction automatically
  'SESSION_MEMORY',         // Extract key facts from session
  'CONTEXT_SUMMARIZER',    // LLM-based context summarization
  
  // Tool Execution
  'TOOL_RESULT_STREAMING',  // Stream tool output to UI in real-time
  'LONG_TOOL_WARNING',     // Warn before tools that run >30s
  'TOOL_TIMEOUT_CONFIG',   // Allow custom timeout per tool type
  
  // Security
  'PATH_VALIDATION',       // Validate paths against project boundaries
  'COMMAND_ANALYSIS',     // Parse and analyze bash commands
  'DESTRUCTIVE_CONFIRM',  // Confirm destructive operations
  'SANDBOX_MODE',         // Run bash in restricted sandbox
  
  // Permissions
  'PERMISSION_RULES',     // Pattern-based permission rules
  'AUTO_PERMISSION',      // Auto-allow safe patterns
  'READONLY_MODE',        // Lock to read-only operations
  
  // UI/UX
  'VERBOSE_OUTPUT',       // Detailed execution info
  'TOOL_TIMING',         // Show execution time per tool
  'STREAMING_OUTPUT',     // Progressive response streaming
  'COLOR_SCHEMES',        // Multiple terminal color themes
  
  // MCP
  'MCP_AUTH',             // OAuth flow for MCP servers
  'MCP_STREAMABLE_HTTP',  // streamableHTTP MCP transport
  'MCP_WEBSOCKET',        // WebSocket MCP transport
  
  // Multi-Agent
  'TEAM_SYSTEM',          // Multi-agent team coordination
  'AGENT_SPAWNING',       // Spawn sub-agents
  'SHARED_TEAM_MEMORY',   // Shared memory between agents
  
  // Plan Mode
  'PLAN_MODE',            // Step-by-step approval workflow
  'PLAN_MODE_AUTO',       // Auto-enter plan mode for large tasks
  
  // Development
  'DEBUG_MODE',           // Verbose debug output
  'PROFILING',            // Performance profiling
] as const

export type FeatureName = typeof ALL_FEATURES[number]
