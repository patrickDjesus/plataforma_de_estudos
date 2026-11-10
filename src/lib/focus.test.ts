import { describe, expect, it } from 'vitest'
import { buildPhases } from './focus'

describe('buildPhases', () => {
  it('50 min com 25/5 vira foco, pausa, foco', () => {
    expect(buildPhases(50, 25, 5).map((p) => `${p.kind}${p.minutes}`)).toEqual(['foco25', 'pausa5', 'foco25'])
  })
  it('bloco curto tem ao menos um foco', () => {
    expect(buildPhases(20, 25, 5)).toEqual([{ kind: 'foco', minutes: 25 }])
  })
  it('90 min vira 3 focos', () => {
    expect(buildPhases(90, 25, 5).filter((p) => p.kind === 'foco')).toHaveLength(3)
  })
})
