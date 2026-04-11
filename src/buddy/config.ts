// Buddy Configuration - Load from environment

import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { SpriteKey } from './sprites.js'
import { Mood } from './types.js'
import { Companion } from './companion.js'

interface EnvConfig {
  BUDDY?: string
  BUDDY_SPRITE?: string
}

function loadEnv(): EnvConfig {
  const envPath = join(process.cwd(), '.env')
  
  if (!existsSync(envPath)) {
    return {}
  }
  
  try {
    const content = readFileSync(envPath, 'utf-8')
    const config: EnvConfig = {}
    
    content.split('\n').forEach(line => {
      const match = line.match(/^(BUDDY|BUDDY_SPRITE)=(.*)$/)
      if (match) {
        const [, key, value] = match
        if (key === 'BUDDY') {
          config.BUDDY = value.trim()
        } else if (key === 'BUDDY_SPRITE') {
          config.BUDDY_SPRITE = value.trim()
        }
      }
    })
    
    return config
  } catch {
    return {}
  }
}

function getSpriteFromEnv(sprite?: string): SpriteKey {
  const validSprites: SpriteKey[] = ['cat', 'owl', 'ghost', 'frog', 'crab', 'astronaut']
  if (sprite && validSprites.includes(sprite as SpriteKey)) {
    return sprite as SpriteKey
  }
  return 'cat'
}

function getMoodFromEnv(mood?: string): Mood {
  const validMoods: Mood[] = ['happy', 'thinking', 'sleeping', 'excited', 'sad']
  if (mood && validMoods.includes(mood as Mood)) {
    return mood as Mood
  }
  return 'happy'
}

// Singleton companion instance
let companionInstance: Companion | null = null

export function getCompanion(): Companion {
  if (!companionInstance) {
    const env = loadEnv()
    
    if (env.BUDDY && env.BUDDY.trim() !== '' && env.BUDDY.toLowerCase() !== 'off') {
      companionInstance = new Companion({
        name: env.BUDDY.trim(),
        sprite: getSpriteFromEnv(env.BUDDY_SPRITE),
        mood: getMoodFromEnv(),
      })
    } else {
      // Return a disabled companion (name empty/off)
      companionInstance = new Companion({ name: '' })
    }
  }
  
  return companionInstance
}

export function reloadCompanion(): Companion {
  companionInstance = null
  return getCompanion()
}

export const validSprites: SpriteKey[] = ['cat', 'owl', 'ghost', 'frog', 'crab', 'astronaut']
export const validMoods: Mood[] = ['happy', 'thinking', 'sleeping', 'excited', 'sad']