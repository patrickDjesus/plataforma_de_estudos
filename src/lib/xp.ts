/** Gamificação simples: 1 XP por minuto estudado + 20 XP por bloco concluído. */
export const XP_PER_BLOCK = 20

/** XP total necessário para alcançar o nível `level` (nível 1 começa em 0). */
export const xpForLevel = (level: number) => 50 * (level - 1) * level

export function levelInfo(xp: number) {
  let level = 1
  while (xpForLevel(level + 1) <= xp) level++
  const base = xpForLevel(level)
  const next = xpForLevel(level + 1)
  return { level, xp, inLevel: xp - base, needed: next - base, progress: (xp - base) / (next - base) }
}

export function xpFrom(sessionsSeconds: number, doneBlocks: number) {
  return Math.floor(sessionsSeconds / 60) + doneBlocks * XP_PER_BLOCK
}
