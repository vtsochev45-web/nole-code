/**
 * Built-in Skills — Core skills that come with Nole Code.
 */

import type { Skill, SkillContext } from './types.js'

// Import tools registry at runtime
async function getToolRegistry() {
  const { tools } = await import('../tools/registry.js')
  return tools
}

async function callLlm(prompt: string): Promise<string> {
  const { default: { llm } } = await import('../api/llm.js')
  const result = await llm([{ role: 'user', content: prompt }], {
    model: 'default',
  })
  return result.content
}

export const builtinSkills: Skill[] = [
  {
    name: 'code-review',
    description: 'Analyze code for issues, bugs, and improvements',
    read_when: ['review', 'analyze', 'check code', 'find issues', 'code review'],
    allowed_tools: ['Read', 'Grep', 'Glob'],
    execute: async (input: string, ctx: SkillContext): Promise<string> => {
      // Extract file paths from input
      const files = input.split(/\s+/).filter(f => f && !f.startsWith('-'))
      if (!files.length) return 'Usage: /skill run code-review <file> [file...]'

      const prompts: string[] = []
      for (const file of files) {
        const { existsSync, readFileSync } = require('fs')
        if (!existsSync(file)) {
          prompts.push(`File not found: ${file}`)
          continue
        }
        const content = readFileSync(file, 'utf-8').slice(0, 5000)
        prompts.push(`## ${file}\n\n\`\`\`\n${content}\n\`\`\`)
      }

      if (!prompts.length) return 'No valid files found'

      const prompt = `You are a code reviewer. Analyze the following code for issues, bugs, and improvements. Return your findings in this format:

### Issues Found
[ numbered list ]

### Suggestions
[ numbered list ]

### Overall
[ brief assessment ]

## Code to Review:
${prompts.join('\n\n')}`

      return callLlm(prompt)
    },
  },
  {
    name: 'refactor',
    description: 'Refactor code with LLM suggestions',
    read_when: ['refactor', 'improve', 'clean up', 'restructure'],
    allowed_tools: ['Read', 'Edit', 'Write'],
    execute: async (input: string, ctx: SkillContext): Promise<string> => {
      const parts = input.split(/\s+/)
      let file = ''
      // Find first existing file
      for (const p of parts) {
        if (!p.startsWith('-')) {
          const { existsSync } = require('fs')
          if (existsSync(p)) {
            file = p
            break
          }
        }
      }

      if (!file) return 'Usage: /skill run refactor <file>'

      const { readFileSync } = require('fs')
      const content = readFileSync(file, 'utf-8')

      const prompt = `You are a code refactorer. Improve this code for readability and maintainability. Return:
1. A brief summary of changes
2. The refactored code in a code block

## Original Code (${file}):
\`\`\`typescript
${content.slice(0, 6000)}
\`\`\`

      const result = await callLlm(prompt)
      // Extract code block if present
      const codeMatch = result.match(/```(?:typescript|javascript|ts|js)?\n([\s\S]*?)```/)?.[1]
      if (codeMatch) {
        return `## Refactoring ${file}

${result.split('```')[0]}\n\nApply? (yes/no)`
      }
      return result
    },
  },
  {
    name: 'explain',
    description: 'Explain code in plain English',
    read_when: ['explain', 'what does', 'how does', 'describe', 'understand'],
    allowed_tools: ['Read'],
    execute: async (input: string, ctx: SkillContext): Promise<string> => {
      const parts = input.split(/\s+/)
      let file = ''
      for (const p of parts) {
        if (!p.startsWith('-')) {
          const { existsSync } = require('fs')
          if (existsSync(p)) {
            file = p
            break
          }
        }
      }

      if (!file) return 'Usage: /skill run explain <file>'

      const { readFileSync } = require('fs')
      const content = readFileSync(file, 'utf-8').slice(0, 4000)

      const prompt = `Explain this code in simple terms. Cover:
- What it does
- How it works
- Key concepts for someone new to this codebase

## Code to Explain:
\`\`\`
${content}
\`\`\``

      return callLlm(prompt)
    },
  },
  {
    name: 'test-gen',
    description: 'Generate tests for code',
    read_when: ['test', 'generate tests', 'write tests', 'add tests', 'spec'],
    allowed_tools: ['Read', 'Glob', 'Write'],
    execute: async (input: string, ctx: SkillContext): Promise<string> => {
      const parts = input.split(/\s+/)
      let file = ''
      let framework = 'vitest'

      for (const p of parts) {
        if (!p.startsWith('-')) {
          const { existsSync } = require('fs')
          if (existsSync(p)) {
            file = p
          }
        } else if (p === '--jest') framework = 'jest'
        else if (p === '--jest') framework = 'jest'
        else if (p.startsWith('--framework=')) framework = p.replace('--framework=', '')
      }

      if (!file) return 'Usage: /skill run test-gen <file> [--framework=vitest]'

      const { readFileSync } = require('fs')
      const content = readFileSync(file, 'utf-8').slice(0, 5000)

      const testFile = file.replace(/(\.[jt]s)x?$/, '.test.$1')

      const prompt = `Generate ${framework} tests for this code. Return only the test code in a code block.

## Source Code:
\`\`\`typescript
${content}
\`\`\`

      const result = await callLlm(prompt)
      const codeMatch = result.match(/```(?:typescript|javascript|ts|js)?\n([\s\S]*?)```/)?.[1] || result

      return `// Test file: ${testFile}\n// Framework: ${framework}\n\n${codeMatch}`
    },
  },
]