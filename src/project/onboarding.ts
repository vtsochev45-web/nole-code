// Nole Code - Project Onboarding
// NOLE.md creation and project initialization
// Adapted from Nole Code's projectOnboardingState

import {
  existsSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
} from 'fs'
import { join, resolve } from 'path'
import { homedir } from 'os'

export interface OnboardingStep {
  key: string
  text: string
  isComplete: boolean
  isCompletable: boolean
  isEnabled: boolean
}

const CONFIG_DIR = join(homedir(), '.nole-code')
const PROJECT_CONFIG = join(CONFIG_DIR, 'projects.json')

interface ProjectConfig {
  [cwd: string]: {
    hasCompletedOnboarding: boolean
    noleMdPath?: string
    lastVisited?: string
  }
}

function loadProjectConfig(): ProjectConfig {
  mkdirSync(CONFIG_DIR, { recursive: true })
  if (existsSync(PROJECT_CONFIG)) {
    try {
      return JSON.parse(readFileSync(PROJECT_CONFIG, 'utf-8'))
    } catch {}
  }
  return {}
}

function saveProjectConfig(config: ProjectConfig) {
  mkdirSync(CONFIG_DIR, { recursive: true })
  writeFileSync(PROJECT_CONFIG, JSON.stringify(config, null, 2))
}

export function isDirEmpty(cwd: string): boolean {
  try {
    const { execSync } = require('child_process')
    const output = execSync(`ls -A "${cwd}" 2>/dev/null`, { encoding: 'utf-8' })
    return !output.trim()
  } catch {
    return true
  }
}

export function getOnboardingSteps(cwd: string): OnboardingStep[] {
  const noleMdPath = join(cwd, 'NOLE.md')
  const empty = isDirEmpty(cwd)

  return [
    {
      key: 'workspace',
      text: 'Create a new app or clone a repository',
      isComplete: !empty,
      isCompletable: true,
      isEnabled: empty,
    },
    {
      key: 'nolemd',
      text: 'Run /init to create a NOLE.md file',
      isComplete: existsSync(noleMdPath),
      isCompletable: true,
      isEnabled: !empty,
    },
    {
      key: 'context',
      text: 'Add project context files',
      isComplete: existsSync(join(cwd, '.nolecode')) || existsSync(join(cwd, 'NOLE.md')),
      isCompletable: true,
      isEnabled: !empty,
    },
  ]
}

export function isOnboardingComplete(cwd: string): boolean {
  return getOnboardingSteps(cwd)
    .filter(s => s.isCompletable && s.isEnabled)
    .every(s => s.isComplete)
}

export function markOnboardingComplete(cwd: string) {
  const config = loadProjectConfig()
  if (!config[cwd]) config[cwd] = {}
  config[cwd].hasCompletedOnboarding = true
  saveProjectConfig(config)
}

// Create NOLE.md — auto-scans project to populate
export function createNoleMd(cwd: string, projectName?: string): string {
  const name = projectName || cwd.split('/').pop() || 'this project'

  // Auto-detect project info
  let techStack = ''
  let shellCmds = ''
  let description = 'Brief description of what this project does.'

  // Check package.json
  const pkgPath = join(cwd, 'package.json')
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))
      if (pkg.description) description = pkg.description
      const deps = Object.keys(pkg.dependencies || {})
      const devDeps = Object.keys(pkg.devDependencies || {})
      const allDeps = [...deps, ...devDeps]
      const detected: string[] = []
      if (allDeps.some(d => d.includes('react'))) detected.push('React')
      if (allDeps.some(d => d.includes('vue'))) detected.push('Vue')
      if (allDeps.some(d => d.includes('next'))) detected.push('Next.js')
      if (allDeps.some(d => d.includes('express'))) detected.push('Express')
      if (allDeps.some(d => d.includes('fastify'))) detected.push('Fastify')
      if (devDeps.some(d => d.includes('typescript'))) detected.push('TypeScript')
      if (allDeps.some(d => d.includes('prisma'))) detected.push('Prisma')
      if (allDeps.some(d => d.includes('drizzle'))) detected.push('Drizzle')
      if (detected.length > 0) techStack = detected.join(', ')
      else techStack = deps.slice(0, 5).join(', ') || 'Node.js'

      // Commands from scripts
      const scripts = pkg.scripts || {}
      const cmdLines: string[] = []
      if (scripts.dev) cmdLines.push(`npm run dev    # ${scripts.dev.slice(0, 40)}`)
      if (scripts.build) cmdLines.push(`npm run build  # ${scripts.build.slice(0, 40)}`)
      if (scripts.test) cmdLines.push(`npm test       # ${scripts.test.slice(0, 40)}`)
      if (scripts.start) cmdLines.push(`npm start      # ${scripts.start.slice(0, 40)}`)
      shellCmds = cmdLines.join('\n') || 'npm run dev'
    } catch {}
  }

  // Python
  if (existsSync(join(cwd, 'pyproject.toml')) || existsSync(join(cwd, 'setup.py'))) {
    techStack = techStack || 'Python'
    shellCmds = shellCmds || 'python -m pytest\npython main.py'
  }

  // Rust
  if (existsSync(join(cwd, 'Cargo.toml'))) {
    techStack = techStack || 'Rust'
    shellCmds = shellCmds || 'cargo build\ncargo test\ncargo run'
  }

  // Go
  if (existsSync(join(cwd, 'go.mod'))) {
    techStack = techStack || 'Go'
    shellCmds = shellCmds || 'go build\ngo test ./...\ngo run .'
  }

  // Scan directory structure
  let structure = ''
  try {
    const { execSync: ex } = require('child_process')
    structure = ex('find . -maxdepth 2 -type d ! -path "*/node_modules/*" ! -path "*/.git/*" ! -path "*/dist/*" | head -20', {
      encoding: 'utf-8', cwd, timeout: 3000
    }).trim()
  } catch {}

  const template = `# ${name}

## Overview
${description}

## Tech Stack
${techStack || '- Add your tech stack here'}

## Commands
\`\`\`bash
${shellCmds || '# Add your development commands'}
\`\`\`

## Structure
\`\`\`
${structure || '# Project directory structure'}
\`\`\`

## Notes
- Important things to know when working in this project
`

  const path = join(cwd, 'NOLE.md')
  writeFileSync(path, template, 'utf-8')
  return path
}

// Load NOLE.md if exists - returns object with content and projectInstructions
export interface ProjectContext {
  content: string | null
  projectInstructions: string
}

export function loadProjectContext(cwd: string): ProjectContext {
  const paths = [
    join(cwd, 'NOLE.md'),
    join(cwd, '.nole.md'),
    join(cwd, '.nolecode'),
    join(cwd, 'CONTEXT.md'),
  ]

  let content: string | null = null
  let projectInstructions = ''

  for (const p of paths) {
    if (existsSync(p)) {
      try {
        content = readFileSync(p, 'utf-8')
        // Check if it's a NOLE.md or .nolecode file and extract project instructions
        if (p.endsWith('NOLE.md') || p.endsWith('.nolecode') || p.endsWith('.nole.md')) {
          projectInstructions = content
        }
        break
      } catch {}
    }
  }

  return { content, projectInstructions }
}

// Settings management
export interface NoleSettings {
  apiKey?: string
  model?: string
  temperature?: number
  maxTokens?: number
  maxTurns?: number
  editor?: string
  shell?: string
  autoSaveSession?: boolean
  streamResponses?: boolean
  showTimestamps?: boolean
  toolPermissions?: 'all' | 'ask' | 'none'
}

const SETTINGS_FILE = join(CONFIG_DIR, 'settings.json')

export function loadSettings(): NoleSettings {
  if (existsSync(SETTINGS_FILE)) {
    try {
      return JSON.parse(readFileSync(SETTINGS_FILE, 'utf-8'))
    } catch {}
  }
  return {
    autoSaveSession: true,
    streamResponses: true,
    showTimestamps: false,
    toolPermissions: 'all',
    temperature: 0.7,
    maxTokens: 4096,
    editor: process.env.EDITOR || 'vim',
    shell: process.env.SHELL || '/bin/bash',
  }
}

export function saveSettings(settings: Partial<NoleSettings>): NoleSettings {
  const current = loadSettings()
  const updated = { ...current, ...settings }
  writeFileSync(SETTINGS_FILE, JSON.stringify(updated, null, 2))
  return updated
}
