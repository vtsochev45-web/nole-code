// Buddy Types

import { SpriteKey } from './sprites.js'

export type Mood = 'happy' | 'thinking' | 'sleeping' | 'excited' | 'sad'

export interface BuddyConfig {
  name: string
  sprite: SpriteKey
  mood: Mood
  messages: string[]
}