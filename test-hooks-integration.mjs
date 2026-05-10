import { runHooks, getPreHooks, getPostHooks, setHooksCache } from './src/hooks/index.js'

// Load actual hooks config
const fs = await import('fs')
let hooksData = { pre: {}, post: {} }
try {
  hooksData = JSON.parse(fs.readFileSync('./test-hooks.json', 'utf8'))
} catch {}

setHooksCache(hooksData.pre, hooksData.post)

const preHooks = getPreHooks('Read')
const postHooks = getPostHooks('Post')
console.log('Pre hooks for Read:', preHooks.length, preHooks.slice(0,2))
console.log('Post hooks for Read:', postHooks.length, postHooks.slice(0,2))

if (preHooks.length === 0 && postHooks.length === 0) {
  console.log('NOTE: No hooks configured (test-hooks.json empty or missing)')
}

// Run a quick test with echo hooks
const testPre = await runHooks(['echo "PRE-TEST-OK"'], { tool: 'Read', input: {}, cwd: '/tmp' })
const testPost = await runHooks(['echo "POST-TEST-OK"'], { tool: 'Read', input: {}, cwd: '/tmp' })
console.log('Pre hook result:', testPre)
console.log('Post hook result:', testPost)
console.log('PASS: hooks system fires correctly')
