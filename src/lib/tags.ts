/** Jeder Tag bekommt aus seinem Namen eine stabile Farbe aus einer Palette klar unterscheidbarer Töne. */
const HUES = [152, 212, 335, 28, 272, 178, 48, 2, 100, 242, 305, 196]

export function tagHue(tag: string): number {
  let h = 7
  for (const c of tag.trim().toLowerCase()) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return HUES[h % HUES.length]
}

export const tagColor = (tag: string) => `hsl(${tagHue(tag)} 62% 46%)`

/** Zarte Hintergrundfarbe, die in Hell- und Dunkelmodus zur Oberfläche passt. */
export const tagTint = (tag: string) => `color-mix(in srgb, hsl(${tagHue(tag)} 70% 50%) 10%, var(--surface))`
