/**
 * Project Indexer — scans the codebase on first run and builds a
 * lightweight index of files, exports, and structure.
 * Injected into the system prompt so the LLM knows the project
 * without reading every file.
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'fs'
import { join, relative, extname } from 'path'

export interface ProjectIndex {
  root: string
  fileCount: number
  totalLines: number
  languages: Record<string, number>
  tree: string
  keyFiles: Array<{ path: string; exports: string[]; lines: number }>
  timestamp: string
}

const IGNORE_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', '.next', '.nuxt',
  '__pycache__', '.venv', 'venv', 'target', '.cache', 'coverage',
  '.turbo', '.output', '.vercel',
])

const CODE_EXTS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.py', '.rs', '.go', '.java',
  '.c', '.cpp', '.h', '.rb', '.php', '.swift', '.kt', '.cs',
  '.vue', '.svelte', '.astro',
])

const LANG_MAP: Record<string, string> = {
  '.ts': 'TypeScript', '.tsx': 'TypeScript', '.js': 'JavaScript', '.jsx': 'JavaScript',
  '.py': 'Python', '.rs': 'Rust', '.go': 'Go', '.java': 'Java',
  '.rb': 'Ruby', '.php': 'PHP', '.vue': 'Vue', '.svelte': 'Svelte',
  '.c': 'C', '.cpp': 'C++', '.cs': 'C#', '.swift': 'Swift', '.kt': 'Kotlin',
}

export function indexProject(root: string, maxFiles = 200): ProjectIndex {
  const languages: Record<string, number> = {}
  const keyFiles: ProjectIndex['keyFiles'] = []
  const treeParts: string[] = []
  let fileCount = 0
  let totalLines = 0

  function walk(dir: string, depth: number) {
    if (depth > 5 || fileCount > maxFiles) return

    let entries: string[]
    try {
      entries = readdirSync(dir).sort()
    } catch { return }

    for (const entry of entries) {
      if (entry.startsWith('.') || IGNORE_DIRS.has(entry)) continue
      const fullPath = join(dir, entry)

      try {
        const stat = statSync(fullPath)
        const rel = relative(root, fullPath)

        if (stat.isDirectory()) {
          treeParts.push(`${'  '.repeat(depth)}${entry}/`)
          walk(fullPath, depth + 1)
        } else if (stat.isFile()) {
          const ext = extname(entry).toLowerCase()
          if (!CODE_EXTS.has(ext)) continue

          fileCount++
          const lang = LANG_MAP[ext] || ext
          languages[lang] = (languages[lang] || 0) + 1

          try {
            const content = readFileSync(fullPath, 'utf-8')
            const lines = content.split('\n').length
            totalLines += lines

            const exports: string[] = []
            const exportRe = /^export\s+(?:default\s+)?(?:async\s+)?(?:function|class|const|let|var|interface|type|enum)\s+(\w+)/gm
            let match
            while ((match = exportRe.exec(content)) !== null) {
              exports.push(match[1])
            }

            if (exports.length > 0 || lines > 50) {
              keyFiles.push({ path: rel, exports: exports.slice(0, 10), lines })
            }
          } catch {}

          treeParts.push(`${'  '.repeat(depth)}${entry}`)
        }
      } catch {}
    }
  }

  walk(root, 0)

  keyFiles.sort((a, b) => (b.exports.length * b.lines) - (a.exports.length * a.lines))

  return {
    root,
    fileCount,
    totalLines,
    languages,
    tree: treeParts.slice(0, 60).join('\n'),
    keyFiles: keyFiles.slice(0, 30),
    timestamp: new Date().toISOString(),
  }
}

export function formatIndexForPrompt(index: ProjectIndex): string {
  const langs = Object.entries(index.languages)
    .sort((a, b) => b[1] - a[1])
    .map(([lang, count]) => `${lang}(${count})`)
    .join(', ')

  const files = index.keyFiles.slice(0, 15).map(f => {
    const exps = f.exports.length > 0 ? `: ${f.exports.join(', ')}` : ''
    return `  ${f.path} (${f.lines}L)${exps}`
  }).join('\n')

  return `# Project Index (${index.fileCount} files, ${index.totalLines} lines)
Languages: ${langs}
Key files:\n${files}`
}
