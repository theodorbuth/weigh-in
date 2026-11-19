/** The 8 category colours offered when creating/editing a category (Figma "New category"). */
export const CATEGORY_COLOURS = [
  { name: 'Research', hex: '#5FB3A8' },
  { name: 'Slides', hex: '#E8B65A' },
  { name: 'Editing', hex: '#D9695A' },
  { name: 'Coding', hex: '#7FA3D8' },
  { name: 'Presentation', hex: '#9C8BC9' },
  { name: 'Green', hex: '#5E9C7E' },
  { name: 'Sand', hex: '#C9A27E' },
  { name: 'Slate', hex: '#8A8E95' },
] as const

/** Categories a new project starts with (Figma "New project"). */
export const DEFAULT_CATEGORIES = [
  { name: 'Research', colour: '#5FB3A8' },
  { name: 'Slides', colour: '#E8B65A' },
  { name: 'Editing', colour: '#D9695A' },
  { name: 'Coding', colour: '#7FA3D8' },
]

/** First palette colour not used yet (falls back to cycling). */
export function nextFreeColour(used: string[]): string {
  const taken = new Set(used.map((c) => c.toUpperCase()))
  return (CATEGORY_COLOURS.find((c) => !taken.has(c.hex)) ?? CATEGORY_COLOURS[used.length % 8]).hex
}
