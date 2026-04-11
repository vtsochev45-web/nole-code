// Companion Class - Buddy reactions and behavior

import { sprites, SpriteKey } from './sprites.js'
import { BuddyConfig, Mood } from './types.js'

const moodEmojis: Record<Mood, string> = {
  happy: '✨',
  thinking: '🤔',
  sleeping: '💤',
  excited: '🎉',
  sad: '😢',
}

const reactions: Record<string, { emoji: string; messages: string[] }> = {
  thinking: {
    emoji: '🤔',
    messages: [
      'Hmm, let me think about this...',
      'Working on it...',
      'Pondering the options...',
      'Computing...',
    ],
  },
  done: {
    emoji: '✅',
    messages: [
      'All done!',
      'Finished!',
      'Completed!',
      'There we go!',
    ],
  },
  error: {
    emoji: '❌',
    messages: [
      'Oops! Something went wrong.',
      'That didn\'t work...',
      'Let me try again!',
      'We\'ll get it next time.',
    ],
  },
  waiting: {
    emoji: '⏳',
    messages: [
      'Waiting...',
      'Patience...',
      'Almost there...',
      'Hold on...',
    ],
  },
}

const celebrateMessages = [
  '🎉 Woohoo! We did it!',
  '🌟 Amazing work!',
  '🚀 Mission accomplished!',
  '💯 Perfect!',
  '🏆 Champion!',
]

export class Companion {
  private config: BuddyConfig
  private currentMood: Mood

  constructor(config?: Partial<BuddyConfig>) {
    this.config = {
      name: config?.name || 'Buddy',
      sprite: config?.sprite || 'cat',
      mood: config?.mood || 'happy',
      messages: config?.messages || [],
    }
    this.currentMood = this.config.mood
  }

  get name(): string {
    return this.config.name
  }

  get sprite(): SpriteKey {
    return this.config.sprite
  }

  get mood(): Mood {
    return this.currentMood
  }

  get spriteArt(): string {
    return sprites[this.config.sprite]
  }

  get isEnabled(): boolean {
    return this.config.name !== '' && this.config.name.toLowerCase() !== 'off'
  }

  react(event: 'thinking' | 'done' | 'error' | 'waiting'): string {
    if (!this.isEnabled) return ''
    
    const reaction = reactions[event]
    const message = reaction.messages[Math.floor(Math.random() * reaction.messages.length)]
    return `${moodEmojis[this.currentMood]} ${this.config.name}: ${message}`
  }

  celebrate(): string {
    if (!this.isEnabled) return ''
    const message = celebrateMessages[Math.floor(Math.random() * celebrateMessages.length)]
    return `${message} ${this.spriteArt}`
  }

  introduce(): string {
    if (!this.isEnabled) return ''
    return `${moodEmojis[this.currentMood} ${this.config.name} here! ${this.spriteArt}`
  }

  setMood(mood: Mood): void {
    this.currentMood = mood
  }

  setName(name: string): void {
    this.config.name = name
  }

  setSprite(sprite: SpriteKey): void {
    this.config.sprite = sprite
  }

  getConfig(): BuddyConfig {
    return { ...this.config }
  }
}