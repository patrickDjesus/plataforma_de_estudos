export type Phase = { kind: 'foco' | 'pausa'; minutes: number }

/** Divide o bloco em ciclos de foco e pausa (ex.: 50 min com 25/5 → 25 + 5 + 25). */
export function buildPhases(totalMin: number, focus: number, pause: number): Phase[] {
  const n = Math.max(1, Math.round(totalMin / (focus + pause)))
  const phases: Phase[] = []
  for (let i = 0; i < n; i++) {
    phases.push({ kind: 'foco', minutes: focus })
    if (i < n - 1) phases.push({ kind: 'pausa', minutes: pause })
  }
  return phases
}
