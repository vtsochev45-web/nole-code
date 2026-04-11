// Buddy Sprites - ASCII art companions

export const sprites = {
  cat: `  /\\___/\\
 (  o o  )
 (  =^=  )
  (--m-m--)`,
  owl: `  ___0___
 /       \\
|  @   @  |
 \\  ---  /
  ~~~~~~~`,
  ghost: `  .-.
 (o o)
 | O |
 |   |
  ===
 ~~~~~`,
  frog: `  (\_/)
 ( o.o )
  > ^ <`,
  crab: `  ~~/~~\\
 (\_/)
 /|  |\\
  |  |`,
  astronaut: `  .--.
 (    )
 |    |
  \\__/
 /____\\`,
}

export type SpriteKey = keyof typeof sprites