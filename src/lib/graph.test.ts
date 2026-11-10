import { describe, expect, it } from 'vitest'
import type { Note, Subject, Topic } from '../db/types'
import { buildGraph } from './graph'

const s = (id: string, areaId: Subject['areaId'] = 'faculdade'): Subject => ({ id, areaId, name: id, color: '#123456', weight: 3, mandatory: false, createdAt: 0 })
const t = (id: string, subjectId: string): Topic => ({ id, subjectId, name: id, order: 0, done: false, studiedSeconds: 0 })
const n = (id: string, subjectId: string, content = '', topicId?: string): Note => ({ id, subjectId, topicId, title: id.toUpperCase(), content, updatedAt: 0 })
const link = (title: string) => `<p><span class="wikilink" data-target="${title}">${title}</span></p>`

const base = {
  subjects: [s('calc'), s('fis'), s('ing', 'idiomas')],
  topics: [t('lim', 'calc')],
  notes: [n('a', 'calc', link('B'), 'lim'), n('b', 'fis'), n('c', 'ing')],
  links: [],
  positions: new Map(),
}

describe('buildGraph', () => {
  it('cria nós de matéria, tópico e nota com hierarquia', () => {
    const g = buildGraph(base)
    expect(g.nodes.map((x) => x.id).sort()).toEqual(['n:a', 'n:b', 'n:c', 's:calc', 's:fis', 's:ing', 't:lim'].sort())
    expect(g.edges.some((e) => e.source === 't:lim' && e.target === 'n:a')).toBe(true)
  })

  it('liga notas citadas com [[…]] entre matérias diferentes', () => {
    const g = buildGraph(base)
    expect(g.edges.find((e) => e.kind === 'citacao')).toMatchObject({ source: 'n:a', target: 'n:b' })
  })

  it('filtra por área', () => {
    const g = buildGraph({ ...base, areas: ['idiomas'] })
    expect(g.nodes.map((x) => x.id).sort()).toEqual(['n:c', 's:ing'])
  })

  it('visão local mostra só a vizinhança da nota', () => {
    const g = buildGraph({ ...base, focusNoteId: 'b' })
    const ids = g.nodes.map((x) => x.id)
    expect(ids).toContain('n:a')
    expect(ids).not.toContain('n:c')
    expect(g.nodes.find((x) => x.id === 'n:b')?.focus).toBe(true)
  })

  it('usa posição salva quando existe', () => {
    const g = buildGraph({ ...base, positions: new Map([['s:calc', { x: 7, y: 9 }]]) })
    expect(g.nodes.find((x) => x.id === 's:calc')).toMatchObject({ x: 7, y: 9 })
  })
})
