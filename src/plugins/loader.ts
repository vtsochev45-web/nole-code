/**
 * Plugin Loader — load custom tools from ~/.nole-code/plugins/
 *
 * Each plugin is a .js file that exports:
 *   { name, description, inputSchema, execute }
 *
 * Example plugin (~/.nole-code/plugins/hello.js):
 *   module.exports = {
 *     name: 'Hello',
 *     description: 'Say hello',
 *     inputSchema: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] },
 *     execute: async (input) => `Hello, ${input.name}!`
 *   }
 */

import { existsSync, readdirSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'
import { registerTool } from '../tools/registry.js'

const PLUGINS_DIR = join(homedir(), '.nole-code', 'plugins')

export interface PluginDef {
  name: string
  description: string
  inputSchema: Record<string, unknown>
  execute: (input: Record<string, unknown>, ctx?: { cwd: string; sessionId: string }) => Promise<string>
}

export async function loadPlugins(): Promise<string[]> {
  if (!existsSync(PLUGINS_DIR)) return []

  const files = readdirSync(PLUGINS_DIR).filter(f => f.endsWith('.js'))
  const loaded: string[] = []

  for (const file of files) {
    try {
      const pluginPath = join(PLUGINS_DIR, file)
      const plugin = require(pluginPath) as PluginDef

      if (!plugin.name || !plugin.execute) {
        console.error(`Plugin ${file}: missing name or execute`)
        continue
      }

      registerTool({
        name: plugin.name,
        description: plugin.description || `Plugin: ${plugin.name}`,
        inputSchema: plugin.inputSchema || { type: 'object', properties: {}, required: [] },
        execute: async (input, ctx) => {
          try {
            return await plugin.execute(input, ctx)
          } catch (err) {
            return `Plugin error (${plugin.name}): ${err}`
          }
        },
      })

      loaded.push(plugin.name)
    } catch (err) {
      console.error(`Failed to load plugin ${file}: ${err}`)
    }
  }

  return loaded
}
