import type { AreaId, MapLink, Note, Subject, Topic } from '../db/types'
import { linkedTitles } from './wikilink'

export type GraphNodeKind = 'subject' | 'topic' | 'note'

export interface GNode {
  id: string // "s:<id>" | "t:<id>" | "n:<id>"
  kind: GraphNodeKind
  refId: string
  label: string
  color: string
  subjectId: string
  x: number
  y: number
  done?: boolean
  /** Domínio 0–100 (tópicos com dados). */
  mastery?: number
  /** Pintar o tópico pela cor do domínio. */
  byMastery?: boolean
  focus?: boolean
}

export type GEdgeKind = 'hierarquia' | 'citacao' | 'manual'

export interface GEdge {
  id: string
  source: string
  target: string
  kind: GEdgeKind
  color: string
  linkId?: string // ligações manuais
}

export interface GraphInput {
  subjects: Subject[]
  topics: Topic[]
  notes: Note[]
  links: MapLink[]
  positions: Map<string, { x: number; y: number }>
  areas?: AreaId[] // filtro (vazio = todas)
  subjectIds?: string[] // filtro (vazio = todas)
  focusNoteId?: string // visão local
  mastery?: Map<string, number>
  colorByMastery?: boolean
  /** Esconde notas ainda vazias e sem ligações (padrão: sim). */
  hideEmptyNotes?: boolean
}

export const sid = (id: string) => `s:${id}`
export const tid = (id: string) => `t:${id}`
export const nid = (id: string) => `n:${id}`

/** Anéis ovais (mais largos que altos, pois os nomes são compridos), com mais vagas nos de fora. */
const RING_R = (k: number) => 210 + k * 115
const RING_CAP = (k: number) => Math.floor((2 * Math.PI * RING_R(k)) / 92)
const OVAL = 1.9
function ringSlots(n: number) {
  const slots: { ring: number; idx: number; size: number }[] = []
  let k = 0
  while (slots.length < n) {
    const size = Math.min(RING_CAP(k), n - slots.length)
    for (let i = 0; i < size; i++) slots.push({ ring: k, idx: i, size })
    k++
  }
  return { slots, rings: Math.max(1, k) }
}

/** Posição radial padrão: matérias num círculo; tópicos e notas soltas em anéis ao redor; notas perto do tópico. */
function radialLayout(subjects: Subject[], topics: Topic[], notes: Note[]) {
  const pos = new Map<string, { x: number; y: number }>()
  const ringsOf = subjects.map((s) => ringSlots(topics.filter((t) => t.subjectId === s.id).length + notes.filter((x) => x.subjectId === s.id && !x.topicId).length).rings)
  const outer = RING_R(Math.max(1, ...ringsOf) - 1) * OVAL + 160
  const R = subjects.length <= 1 ? 0 : Math.max(320, (2 * outer + 120) / (2 * Math.sin(Math.PI / subjects.length)))
  subjects.forEach((s, i) => {
    const a = (2 * Math.PI * i) / Math.max(1, subjects.length) - Math.PI / 2
    const sx = Math.cos(a) * R
    const sy = Math.sin(a) * R
    pos.set(sid(s.id), { x: sx, y: sy })
    const ts = topics.filter((t) => t.subjectId === s.id).sort((x, y) => x.order - y.order)
    const loose = notes.filter((n) => n.subjectId === s.id && !n.topicId)
    const ring = [...ts.map((t) => tid(t.id)), ...loose.map((n) => nid(n.id))]
    const { slots } = ringSlots(ring.length)
    ring.forEach((id, k) => {
      const { ring: r, idx, size } = slots[k]
      const b = -Math.PI / 2 + (2 * Math.PI * idx) / size + (r % 2) * (Math.PI / size)
      const rad = RING_R(r)
      pos.set(id, { x: sx + Math.cos(b) * rad * OVAL, y: sy + Math.sin(b) * rad })
    })
    ts.forEach((t) => {
      const tp = pos.get(tid(t.id))!
      const tn = notes.filter((n) => n.topicId === t.id)
      const base = Math.atan2(tp.y - sy, tp.x - sx)
      tn.forEach((n, k) => {
        const b = base + (tn.length === 1 ? 0 : -0.7 + (1.4 * k) / (tn.length - 1))
        pos.set(nid(n.id), { x: tp.x + Math.cos(b) * 120, y: tp.y + Math.sin(b) * 120 })
      })
    })
  })
  return pos
}

export function buildGraph(input: GraphInput): { nodes: GNode[]; edges: GEdge[] } {
  const areaOk = (s: Subject) => !input.areas?.length || input.areas.includes(s.areaId)
  const subjOk = (s: Subject) => !input.subjectIds?.length || input.subjectIds.includes(s.id)
  let subjects = input.subjects.filter((s) => areaOk(s) && subjOk(s))
  let allowed = new Set(subjects.map((s) => s.id))
  let topics = input.topics.filter((t) => allowed.has(t.subjectId))
  let notes = input.notes.filter((n) => allowed.has(n.subjectId))

  const byTitle = new Map(input.notes.map((n) => [n.title.trim().toLowerCase(), n]))
  const citations: [string, string][] = []
  for (const n of input.notes)
    for (const title of linkedTitles(n.content)) {
      const target = byTitle.get(title.trim().toLowerCase())
      if (target && target.id !== n.id) citations.push([nid(n.id), nid(target.id)])
    }

  // Notas vazias e sem ligações só poluem o mapa (ex.: documentos prontos ainda não escritos)
  if (input.hideEmptyNotes !== false) {
    const linked = new Set<string>([...citations.flat(), ...input.links.flatMap((l) => [l.source, l.target])])
    const hasText = (n: Note) => n.content.replace(/<[^>]+>/g, '').trim().length > 0
    notes = notes.filter((n) => hasText(n) || linked.has(nid(n.id)) || n.id === input.focusNoteId)
  }

  // Visão local: a nota em foco, quem ela cita, quem a cita e ligações manuais
  if (input.focusNoteId) {
    const f = nid(input.focusNoteId)
    const keep = new Set<string>([f])
    for (const [a, b] of citations) {
      if (a === f) keep.add(b)
      if (b === f) keep.add(a)
    }
    for (const l of input.links) {
      if (l.source === f) keep.add(l.target)
      if (l.target === f) keep.add(l.source)
    }
    notes = input.notes.filter((n) => keep.has(nid(n.id)))
    const topicIds = new Set([...notes.map((n) => n.topicId).filter(Boolean), ...[...keep].filter((k) => k.startsWith('t:')).map((k) => k.slice(2))])
    topics = input.topics.filter((t) => topicIds.has(t.id))
    allowed = new Set([...notes.map((n) => n.subjectId), ...topics.map((t) => t.subjectId), ...[...keep].filter((k) => k.startsWith('s:')).map((k) => k.slice(2))])
    subjects = input.subjects.filter((s) => allowed.has(s.id))
  }

  const layout = radialLayout(subjects, topics, notes)
  const at = (id: string) => input.positions.get(id) ?? layout.get(id) ?? { x: 0, y: 0 }
  const color = new Map(input.subjects.map((s) => [s.id, s.color]))

  const nodes: GNode[] = [
    ...subjects.map((s) => ({ id: sid(s.id), kind: 'subject' as const, refId: s.id, label: s.name, color: s.color, subjectId: s.id, ...at(sid(s.id)) })),
    ...topics.map((t) => ({ id: tid(t.id), kind: 'topic' as const, refId: t.id, label: t.name, color: color.get(t.subjectId) ?? '#3e63f2', subjectId: t.subjectId, done: t.done, mastery: input.mastery?.get(t.id), byMastery: input.colorByMastery, ...at(tid(t.id)) })),
    ...notes.map((n) => ({
      id: nid(n.id),
      kind: 'note' as const,
      refId: n.id,
      label: n.title,
      color: color.get(n.subjectId) ?? '#3e63f2',
      subjectId: n.subjectId,
      focus: n.id === input.focusNoteId,
      ...at(nid(n.id)),
    })),
  ]
  const present = new Set(nodes.map((n) => n.id))
  const edges: GEdge[] = []
  for (const t of topics) if (present.has(sid(t.subjectId))) edges.push({ id: `h:${t.id}`, source: sid(t.subjectId), target: tid(t.id), kind: 'hierarquia', color: color.get(t.subjectId)! })
  for (const n of notes) {
    const parent = n.topicId && present.has(tid(n.topicId)) ? tid(n.topicId) : sid(n.subjectId)
    if (present.has(parent)) edges.push({ id: `h:${n.id}`, source: parent, target: nid(n.id), kind: 'hierarquia', color: color.get(n.subjectId)! })
  }
  const seen = new Set<string>()
  for (const [a, b] of citations) {
    const key = [a, b].sort().join('|')
    if (!present.has(a) || !present.has(b) || seen.has(key)) continue
    seen.add(key)
    edges.push({ id: `c:${key}`, source: a, target: b, kind: 'citacao', color: '#3e63f2' })
  }
  for (const l of input.links) if (present.has(l.source) && present.has(l.target)) edges.push({ id: `m:${l.id}`, source: l.source, target: l.target, kind: 'manual', color: '#f59e0b', linkId: l.id })
  return { nodes, edges }
}
