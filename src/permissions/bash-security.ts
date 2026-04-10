/**
 * Bash Security - Path Validation & Command Analysis
 * Inspired by Nole Code's BashTool security system
 */

import { existsSync } from 'fs'
import { resolve, normalize, isAbsolute, join, dirname, relative } from 'path'
import { feature } from '../feature-flags/index.js'

// Dangerous patterns that require validation
const DANGEROUS_PATTERNS = [
  // Command substitution
  { pattern: /\$\(/, name: '$() command substitution' },
  { pattern: /`[^`]+`/, name: 'backtick command substitution' },
  
  // Process substitution
  { pattern: /<\(/, name: 'process substitution <()' },
  { pattern: />\(/, name: 'process substitution >()' },
  
  // Parameter expansion
  { pattern: /\$\{[^}]+\}/, name: '${} parameter expansion' },
  { pattern: /\$\[/, name: '$[] arithmetic expansion' },
  
  // Redirection
  { pattern: />\s*\/dev\/null/, name: 'redirect to /dev/null (may hide output)' },
  { pattern: /2>&1/, name: 'redirect stderr to stdout' },
  
  // Dangerous commands
  { pattern: /\bcurl\s+-[A-Za-z]*\s*[A-Za-z]*\s*http/, name: 'curl HTTP request' },
  { pattern: /\bwget\s+/, name: 'wget download' },
  { pattern: /\bnc\s+/, name: 'netcat connection' },
  { pattern: /\bncat\s+/, name: 'ncat connection' },
  { pattern: /\bsocat\s+/, name: 'socat connection' },
  { pattern: /\bopenssl\s+s_client/, name: 'OpenSSL client' },
  { pattern: /\bpython[23]?\s+-c\s+/, name: 'python -c code execution' },
  { pattern: /\bnode\s+-e\s+/, name: 'node -e code execution' },
  { pattern: /\bruby\s+-e\s+/, name: 'ruby -e code execution' },
  { pattern: /\bperl\s+-e\s+/, name: 'perl -e code execution' },
  { pattern: /\bphp\s+-r\s+/, name: 'php -r code execution' },
  { pattern: /\bbash\s+-[cC]\s+/, name: 'bash -c code execution' },
  { pattern: /\bsh\s+-[cC]\s+/, name: 'sh -c code execution' },
  
  // Privilege escalation
  { pattern: /\bsudo\s+/, name: 'sudo command' },
  { pattern: /\bsu\s+/, name: 'switch user' },
  { pattern: /\bchmod\s+[0-7][0-7][0-7]/, name: 'chmod with full permissions' },
  { pattern: /\bchmod\s+\+[sx]/, name: 'chmod +x (add executable)' },
  
  // Network
  { pattern: /\bwget\s+http/, name: 'wget HTTP download' },
  { pattern: /\bcurl\s+http/, name: 'curl HTTP request' },
  { pattern: /\bgit\s+clone\s+http/, name: 'git clone over HTTP' },
]

// Patterns that are safe to auto-allow
const SAFE_PATTERNS = [
  /^(ls|ll|la|dir|tree)\s/,
  /^(cd|pwd|mkdir|rmdir)\s/,
  /^(cat|head|tail|grep|find|locate)\s/,
  /^(wc|sort|uniq|cut|tr|awk|sed)\s/,
  /^(git\s+(status|log|diff|branch))\s/,
  /^(npm\s+(install|run|test|build|start))\s/,
  /^(bun\s+(install|run|add|dev|build))\s/,
  /^(yarn\s+(install|run|start|build))\s/,
  /^(pnpm\s+(install|run|dev|build))\s/,
  /^(python[3]?\s+(-m\s+)?(pip|venv|http\.server))\s/,
  /^(docker\s+(ps|images|logs|exec))\s/,
  /^(kubectl\s+(get|describe|logs))\s/,
  /^(curl\s+-s\s+(http|https):\/\/)/,  // Safe curl for HTTP GET only
  /^(echo|printf|true|false|:)\s/,
  /^(cp|mv|rm|ln)\s+/,  // File operations (need path validation)
]

// Paths that are always denied
const DENIED_PATTERNS = [
  /^\/etc\/passwd$/,
  /^\/etc\/shadow$/,
  /^\/etc\/sudoers$/,
  /^\/etc\/group$/,
  /^\/etc\/shadow$/,
  /^\.ssh\//,
  /^\/root\//,
  /^\/home\/[^\/]+\/\.aws\//,
  /^\/home\/[^\/]+\/\.config\/[^/]+\/credentials$/,
]

export interface SecurityCheckResult {
  allowed: boolean
  reason: string
  risk: 'safe' | 'low' | 'medium' | 'high' | 'critical'
  requiresConfirmation: boolean
  dangerousPatterns?: string[]
}

export interface PathValidationResult {
  valid: boolean
  reason: string
  resolvedPath?: string
}

/**
 * Check if a command is safe to execute
 */
export function checkCommandSecurity(command: string): SecurityCheckResult {
  // Check safe patterns first
  for (const pattern of SAFE_PATTERNS) {
    if (pattern.test(command.trim())) {
      return {
        allowed: true,
        reason: 'Matches safe command pattern',
        risk: 'safe',
        requiresConfirmation: false,
      }
    }
  }
  
  // Check for dangerous patterns
  const foundDangerous: string[] = []
  for (const { pattern, name } of DANGEROUS_PATTERNS) {
    if (pattern.test(command)) {
      foundDangerous.push(name)
    }
  }
  
  if (foundDangerous.length > 0) {
    const risk = foundDangerous.some(d => 
      d.includes('execution') || d.includes('substitution')
    ) ? 'critical' : 'high'
    
    return {
      allowed: false,
      reason: `Dangerous patterns: ${foundDangerous.join(', ')}`,
      risk,
      requiresConfirmation: true,
      dangerousPatterns: foundDangerous,
    }
  }
  
  // Unknown command - medium risk
  return {
    allowed: true,
    reason: 'Command not in safe list - proceeding with caution',
    risk: 'medium',
    requiresConfirmation: false,
  }
}

/**
 * Validate a file path against project boundaries
 */
export function validatePath(
  path: string,
  cwd: string,
  allowedPaths?: string[]
): PathValidationResult {
  // Resolve to absolute path
  let resolvedPath: string
  try {
    resolvedPath = isAbsolute(path) 
      ? normalize(path) 
      : resolve(cwd, path)
  } catch {
    return {
      valid: false,
      reason: 'Invalid path',
    }
  }
  
  // Check denied patterns
  for (const pattern of DENIED_PATTERNS) {
    if (pattern.test(resolvedPath)) {
      return {
        valid: false,
        reason: 'Access to system files denied',
        resolvedPath,
      }
    }
  }
  
  // If allowedPaths is specified, check against it
  if (allowedPaths && allowedPaths.length > 0) {
    const isAllowed = allowedPaths.some(allowed => 
      resolvedPath.startsWith(normalize(allowed))
    )
    
    if (!isAllowed) {
      return {
        valid: false,
        reason: 'Path outside allowed directory',
        resolvedPath,
      }
    }
  }
  
  // Check for path traversal
  const parts = resolvedPath.split('/')
  if (parts.includes('..')) {
    // Verify the path actually resolves correctly
    const normalized = normalize(resolvedPath)
    if (normalized.includes('..')) {
      return {
        valid: false,
        reason: 'Path traversal detected',
        resolvedPath: normalized,
      }
    }
  }
  
  return {
    valid: true,
    reason: 'Path validated',
    resolvedPath,
  }
}

/**
 * Validate all paths in a command
 */
export function validateCommandPaths(
  command: string,
  cwd: string,
  allowedPaths?: string[]
): { valid: boolean; invalidPaths: string[] } {
  // Extract paths from command
  const pathPatterns = [
    /([\/.a-zA-Z0-9_-]+)/g,  // Simple path pattern
  ]
  
  // Extract arguments that look like paths
  const words = command.split(/\s+/)
  const invalidPaths: string[] = []
  
  for (const word of words) {
    // Skip if it's clearly a command or flag
    if (word.startsWith('-') || word.startsWith('"') || word.startsWith("'")) continue
    if (/^[a-zA-Z]+$/.test(word)) continue  // Plain command
    
    // Check if it looks like a path
    if (word.includes('/') || word.includes('.') || word.includes('~')) {
      const result = validatePath(word, cwd, allowedPaths)
      if (!result.valid) {
        invalidPaths.push(word)
      }
    }
  }
  
  return {
    valid: invalidPaths.length === 0,
    invalidPaths,
  }
}

/**
 * Parse a bash command into its components
 */
export function parseCommand(command: string): {
  baseCommand: string
  args: string[]
  operators: string[]
  redirections: string[]
} {
  // Split by operators
  const parts = command
    .replace(/&&/g, ' NOLE_OP_AND ')
    .replace(/\|\|/g, ' NOLE_OP_OR ')
    .replace(/\|/g, ' NOLE_OP_PIPE ')
    .replace(/;/g, ' NOLE_OP_SEMI ')
    .split(' NOLE_OP_')
    .flatMap(part => part.split(' NOLE_OP_PIPE_'))
  
  const operators: string[] = []
  const allParts: string[] = []
  
  for (const part of parts) {
    if (part.startsWith('AND ')) {
      operators.push('&&')
      allParts.push(part.slice(4))
    } else if (part.startsWith('OR ')) {
      operators.push('||')
      allParts.push(part.slice(3))
    } else if (part === 'PIPE') {
      operators.push('|')
    } else if (part === 'SEMI') {
      operators.push(';')
    } else {
      allParts.push(part)
    }
  }
  
  // Extract redirections
  const redirections: string[] = []
  const commandOnly = command.replace(/>/g, () => {
    redirections.push('stdout redirect')
    return ''
  }).replace(/</g, () => {
    redirections.push('stdin redirect')
    return ''
  })
  
  // Get base command
  const words = commandOnly.trim().split(/\s+/)
  const baseCommand = words[0] || ''
  const args = words.slice(1)
  
  return {
    baseCommand,
    args,
    operators,
    redirections,
  }
}

/**
 * Full security check for a command
 */
export function fullSecurityCheck(
  command: string,
  cwd: string,
  allowedPaths?: string[]
): SecurityCheckResult {
  if (!feature('PATH_VALIDATION') && !feature('COMMAND_ANALYSIS')) {
    return {
      allowed: true,
      reason: 'Security checks disabled',
      risk: 'medium',
      requiresConfirmation: false,
    }
  }
  
  // Parse the command
  const parsed = parseCommand(command)
  
  // Check for dangerous base commands
  const dangerousCommands = ['eval', 'exec', 'source', '. ']
  if (dangerousCommands.includes(parsed.baseCommand)) {
    return {
      allowed: false,
      reason: `Dangerous command: ${parsed.baseCommand}`,
      risk: 'critical',
      requiresConfirmation: true,
      dangerousPatterns: [`Dangerous command: ${parsed.baseCommand}`],
    }
  }
  
  // Command-level security check
  const cmdResult = checkCommandSecurity(command)
  if (!cmdResult.allowed || cmdResult.risk === 'critical') {
    return cmdResult
  }
  
  // Path validation if enabled
  if (feature('PATH_VALIDATION')) {
    const pathResult = validateCommandPaths(command, cwd, allowedPaths)
    if (!pathResult.valid) {
      return {
        allowed: false,
        reason: `Invalid paths: ${pathResult.invalidPaths.join(', ')}`,
        risk: 'high',
        requiresConfirmation: true,
        dangerousPatterns: pathResult.invalidPaths,
      }
    }
  }
  
  // Check for compound command with dangerous operations
  if (parsed.operators.length > 0 && cmdResult.risk !== 'safe') {
    return {
      ...cmdResult,
      reason: cmdResult.reason + ' (compound command)',
      risk: cmdResult.risk === 'low' ? 'medium' : cmdResult.risk,
    }
  }
  
  return cmdResult
}
