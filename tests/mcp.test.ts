// Tests for MCP client
import { describe, test, expect } from 'bun:test'
import { MCPRegistry } from '../src/mcp/client.js'

describe('MCP Tool Name Parsing', () => {
  const registry = new MCPRegistry()

  test('parses simple server and tool name', () => {
    const result = registry.parseMCPToolName('mcp__github__list_repos')
    expect(result).not.toBeNull()
    expect(result!.server).toBe('github')
    expect(result!.tool).toBe('list_repos')
  })

  test('parses underscored server name', () => {
    const result = registry.parseMCPToolName('mcp__brave_search__web_search')
    expect(result).not.toBeNull()
    expect(result!.server).toBe('brave_search')
    expect(result!.tool).toBe('web_search')
  })

  test('parses deeply underscored names', () => {
    const result = registry.parseMCPToolName('mcp__my_mcp_server__my_cool_tool')
    expect(result).not.toBeNull()
    expect(result!.server).toBe('my_mcp_server')
    expect(result!.tool).toBe('my_cool_tool')
  })

  test('returns null for non-MCP names', () => {
    expect(registry.parseMCPToolName('Bash')).toBeNull()
    expect(registry.parseMCPToolName('Read')).toBeNull()
    expect(registry.parseMCPToolName('mcp_single')).toBeNull()
  })

  test('returns null for empty or malformed', () => {
    expect(registry.parseMCPToolName('')).toBeNull()
    expect(registry.parseMCPToolName('mcp__')).toBeNull()
    expect(registry.parseMCPToolName('mcp__server')).toBeNull()
  })
})
