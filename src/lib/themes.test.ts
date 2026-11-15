import { describe, expect, it } from 'vitest'
import type { Subject } from '../db/types'
import { suggestThemes, themedSubjects } from './themes'

const sub = (id: string, areaId: Subject['areaId'], extra: Partial<Subject> = {}): Subject => ({ id, areaId, name: id, color: '#000', weight: 3, mandatory: false, createdAt: 0, ...extra })
const subjects = [sub('fis', 'ensino'), sub('qui', 'ensino'), sub('bio', 'ensino'), sub('ing', 'idiomas'), sub('calc', 'faculdade')]
const NOW = new Date(2026, 10, 16)

describe('semana temática', () => {
  it('uma sugestão por área', () => {
    const s = suggestThemes(subjects, [], {}, '2026-11-16', NOW)
    expect(Object.keys(s).sort()).toEqual(['ensino', 'faculdade', 'idiomas'])
    expect(s.idiomas?.id).toBe('ing')
  })
  it('não repete a da semana passada e prefere a que está há mais tempo sem tema', () => {
    const hist = [
      { weekId: '2026-11-09', themes: { ensino: 'fis' } },
      { weekId: '2026-11-02', themes: { ensino: 'qui' } },
    ]
    expect(suggestThemes(subjects, hist, {}, '2026-11-16', NOW).ensino?.id).toBe('bio')
  })
  it('domínio baixo pesa', () => {
    const hist = [{ weekId: '2026-10-26', themes: { ensino: 'bio' } }, { weekId: '2026-10-19', themes: { ensino: 'qui' } }, { weekId: '2026-10-12', themes: { ensino: 'fis' } }]
    expect(suggestThemes(subjects, hist, { fis: 20, qui: 80, bio: 90 }, '2026-11-16', NOW).ensino).toEqual({ id: 'fis', reason: 'domínio baixo (20%)' })
  })
  it('prova chegando vence tudo, até repetir', () => {
    const subs = [sub('fis', 'ensino', { deadline: '2026-11-20' }), sub('qui', 'ensino')]
    const s = suggestThemes(subs, [{ weekId: '2026-11-09', themes: { ensino: 'fis' } }], {}, '2026-11-16', NOW)
    expect(s.ensino).toEqual({ id: 'fis', reason: 'prova em 4 dias' })
  })
  it('filtro: só o tema da área; área sem tema continua variada', () => {
    const out = themedSubjects(subjects, { ensino: 'fis' }).map((s) => s.id)
    expect(out).toEqual(['fis', 'ing', 'calc'])
    expect(themedSubjects(subjects, { ensino: 'apagada' }).length).toBe(5)
    expect(themedSubjects(subjects, null).length).toBe(5)
  })
})
