// Nole Code - Plugin System
// Extensible plugin architecture
// Adapted from Nole Code's plugin system

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { homedir } from 'os'

export interface NolePlugin {
  name: string
  version: string
  description?: string
  author?: string
  tools?: PluginTool[]
  commands?: PluginCommand[]
  hooks?: PluginHooks
  onLoad?: () => Promise<void> | void
  onUnload?: () => Promise<void> | void
}

export interface PluginTool {
  name: string
  description: string
  inputSchema: Record<string, unknown>
  execute: (input: Record<string, unknown>, ctx: PluginContext) => Promise<string>
}

export interface PluginCommand {
  name: string
  description: string
  execute: (args: string[], ctx: PluginContext) => Promise<string>
}

export interface PluginHooks {
  beforeTool?: (tool: string, input: Record<string, unknown>) => void | Promise<void>
  afterTool?: (tool: string, input: Record<string, unknown>, result: string) => void | Promise<void>
  beforeMessage?: (message: string) => void | Promise<void>
  afterMessage?: (message: string) => void | Promise<void>
  onSessionStart?: (sessionId: string) => void | Promise<void>
  onSessionEnd?: (sessionId: string) => void | Promise<void>
}

export interface PluginContext {
  cwd: string
  sessionId: string
  config: Record<string, unknown>
}

class PluginManager {
  private plugins = new Map<string, NolePlugin>()
  private tools = new Map<string, PluginTool>()
  private commands = new Map<string, PluginCommand>()

  async loadPlugin(plugin: NolePlugin): Promise<void> {
    if (this.plugins.has(plugin.name)) {
      console.log(`Plugin "${plugin.name}" already loaded`)
      return
    }

    // Run onLoad hook
    if (plugin.onLoad) {
      await plugin.onLoad()
    }

    // Register tools
    for (const tool of plugin.tools || []) {
      this.tools.set(tool.name, tool)
    }

    // Register commands
    for (const cmd of plugin.commands || []) {
      this.commands.set(cmd.name, cmd)
    }

    this.plugins.set(plugin.name, plugin)
    console.log(`Loaded plugin: ${plugin.name} v${plugin.version}`)
  }

  async unloadPlugin(name: string): Promise<void> {
    const plugin = this.plugins.get(name)
    if (!plugin) return

    // Run onUnload hook
    if (plugin.onUnload) {
      await plugin.onUnload()
    }

    // Remove tools
    for (const tool of plugin.tools || []) {
      this.tools.delete(tool.name)
    }

    // Remove commands
    for (const cmd of plugin.commands || []) {
      this.commands.delete(cmd.name)
    }

    this.plugins.delete(name)
    console.log(`Unloaded plugin: ${name}`)
  }

  getPlugin(name: string): NolePlugin | undefined {
    return this.plugins.get(name)
  }

  getAllPlugins(): NolePlugin[] {
    return Array.from(this.plugins.values())
  }

  getTool(name: string): PluginTool | undefined {
    return this.tools.get(name)
  }

  getAllTools(): PluginTool[] {
    return Array.from(this.tools.values())
  }

  getCommand(name: string): PluginCommand | undefined {
    return this.commands.get(name)
  }

  getAllCommands(): PluginCommand[] {
    return Array.from(this.commands.values())
  }

  async executeTool(name: string, input: Record<string, unknown>, ctx: PluginContext): Promise<string> {
    const tool = this.tools.get(name)
    if (!tool) throw new Error(`Plugin tool not found: ${name}`)

    const plugin = this.plugins.get(this.findToolPlugin(name) || '')
    if (plugin?.hooks?.beforeTool) {
      await plugin.hooks.beforeTool(name, input)
    }

    const result = await tool.execute(input, ctx)

    if (plugin?.hooks?.afterTool) {
      await plugin.hooks.afterTool(name, input, result)
    }

    return result
  }

  private findToolPlugin(toolName: string): string | undefined {
    for (const [name, plugin] of this.plugins) {
      if (plugin.tools?.some(t => t.name === toolName)) {
        return name
      }
    }
  }
}

export const plugins = new PluginManager()

// Load plugins from config
export async function loadPluginsFromConfig(): Promise<void> {
  const configFile = join(homedir(), '.nole-code', 'plugins.json')

  if (!existsSync(configFile)) return

  try {
    const config = JSON.parse(readFileSync(configFile, 'utf-8'))
    const pluginList: Array<{ name: string; enabled: boolean }> = config.plugins || []

    for (const entry of pluginList) {
      if (!entry.enabled) continue

      // Try to load as npm package
      try {
        const plugin = await import(entry.name)
        if (plugin.default) {
          await plugins.loadPlugin(plugin.default)
        } else if (plugin.nolePlugin) {
          await plugins.loadPlugin(plugin.nolePlugin)
        }
      } catch {
        console.log(`Failed to load plugin: ${entry.name}`)
      }
    }
  } catch (err) {
    console.error('Plugin config error:', err)
  }
}

// Built-in example plugins
export const EXAMPLE_PLUGINS = {
  // Docker plugin - manage containers
  docker: (): NolePlugin => ({
    name: 'docker',
    version: '1.0.0',
    description: 'Docker container management',
    tools: [
      {
        name: 'docker_ps',
        description: 'List running Docker containers',
        inputSchema: { type: 'object', properties: {} },
        async execute() {
          const { execSync } = require('child_process')
          return execSync('docker ps --format "table {{.ID}}\t{{.Image}}\t{{.Status}}"', { encoding: 'utf-8' })
        },
      },
      {
        name: 'docker_logs',
        description: 'Get Docker container logs',
        inputSchema: {
          type: 'object',
          properties: { container: { type: 'string' }, lines: { type: 'number' } },
          required: ['container'],
        },
        async execute(input) {
          const { execSync } = require('child_process')
          const lines = input.lines || 50
          return execSync(`docker logs --tail ${lines} ${input.container}`, { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 })
        },
      },
      {
        name: 'docker_exec',
        description: 'Execute command in Docker container',
        inputSchema: {
          type: 'object',
          properties: { container: { type: 'string' }, command: { type: 'string' } },
          required: ['container', 'command'],
        },
        async execute(input) {
          const { execSync } = require('child_process')
          return execSync(`docker exec ${input.container} ${input.command}`, { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 })
        },
      },
    ],
  }),

  // GitHub plugin
  github: (): NolePlugin => ({
    name: 'github',
    version: '1.0.0',
    description: 'GitHub API integration',
    tools: [
      {
        name: 'github_pr',
        description: 'Get GitHub pull request info',
        inputSchema: {
          type: 'object',
          properties: { owner: { type: 'string' }, repo: { type: 'string' }, pr: { type: 'number' } },
          required: ['owner', 'repo', 'pr'],
        },
        async execute(input, ctx) {
          const { config } = ctx
          const token = config.GITHUB_TOKEN as string
          const url = `https://api.github.com/repos/${input.owner}/${input.repo}/pulls/${input.pr}`

          const res = await fetch(url, {
            headers: {
              'Authorization': `token ${token}`,
              'Accept': 'application/vnd.github.v3+json',
            },
          })
          return JSON.stringify(await res.json(), null, 2)
        },
      },
    ],
  }),
}

// Install a plugin
export async function installPlugin(name: string, registry = 'npm'): Promise<void> {
  if (registry === 'npm') {
    const { execSync } = require('child_process')
    console.log(`Installing plugin: ${name}`)
    execSync(`npm install ${name}`, { stdio: 'inherit' })
  }
}

// Uninstall a plugin
export async function uninstallPlugin(name: string): Promise<void> {
  const { execSync } = require('child_process')
  console.log(`Uninstalling plugin: ${name}`)
  execSync(`npm uninstall ${name}`, { stdio: 'inherit' })
}
