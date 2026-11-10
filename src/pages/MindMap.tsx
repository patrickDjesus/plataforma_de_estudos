import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  Background,
  BackgroundVariant,
  ConnectionMode,
  Controls,
  Handle,
  MiniMap,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Connection,
  type Edge,
  type Node,
  type NodeProps,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { Check, FileText, LocateFixed, Network, RotateCcw, Search, Waypoints } from 'lucide-react'
import { db, uid } from '../db/db'
import { AREAS, useNotes, useSubjects, useTopics } from '../db/hooks'
import type { AreaId } from '../db/types'
import { AREA_COLOR, tint } from '../lib/colors'
import { buildGraph, type GNode } from '../lib/graph'
import { askConfirm } from '../components/confirm'
import { Capybara } from '../components/Capybara'
import { SubjectIcon } from '../components/SubjectIcon'
import { Btn, Card, PageHeader, Tabs, inputCls } from '../components/ui'

type NodeData = GNode & Record<string, unknown>

const handleCls = '!h-3 !w-3 !border-2 !border-white !bg-brand opacity-0 transition group-hover:opacity-100'
const centerStyle = { left: '50%', top: '50%', opacity: 0, pointerEvents: 'none' as const, transform: 'translate(-50%,-50%)' }

/** Linhas saem do centro do nó; a bolinha à direita serve para criar ligações à mão. */
function Handles() {
  return (
    <>
      <Handle id="c-t" type="target" position={Position.Top} style={centerStyle} isConnectable={false} />
      <Handle id="c-s" type="source" position={Position.Top} style={centerStyle} isConnectable={false} />
      <Handle id="link" type="source" position={Position.Right} className={handleCls} title="Arraste até outro nó para ligar" />
    </>
  )
}

function SubjectNode({ data }: NodeProps<Node<NodeData>>) {
  const subjects = useSubjects()
  const s = subjects.find((x) => x.id === data.refId)
  return (
    <div
      className="group flex items-center gap-2.5 rounded-[20px] border-2 bg-white py-2 pr-4 pl-2 shadow-[0_10px_30px_-12px_rgba(16,24,40,0.35)]"
      style={{ borderColor: data.color, boxShadow: `0 0 0 6px ${tint(data.color, 0.12)}, 0 12px 28px -12px ${data.color}` }}
    >
      <Handles />
      <SubjectIcon subject={s} size={40} />
      <span className="font-display text-[15px] font-bold whitespace-nowrap">{data.label}</span>
    </div>
  )
}

function TopicNode({ data }: NodeProps<Node<NodeData>>) {
  return (
    <div
      className="group flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-semibold whitespace-nowrap"
      style={{ background: tint(data.color, 0.12), borderColor: tint(data.color, 0.4), color: `color-mix(in srgb, ${data.color} 80%, #000)` }}
    >
      <Handles />
      {data.done && <Check size={13} />}
      {data.label}
    </div>
  )
}

function NoteNode({ data }: NodeProps<Node<NodeData>>) {
  return (
    <div
      className={`group flex max-w-[200px] items-center gap-1.5 rounded-xl border bg-white px-2.5 py-1.5 text-xs font-semibold shadow-sm ${data.focus ? 'ring-4' : ''}`}
      style={{ borderColor: tint(data.color, 0.45), ['--tw-ring-color' as string]: tint(data.color, 0.35) }}
      title="Duplo clique para abrir a nota"
    >
      <Handles />
      <FileText size={13} style={{ color: data.color }} className="shrink-0" />
      <span className="truncate">{data.label}</span>
    </div>
  )
}

const nodeTypes = { subject: SubjectNode, topic: TopicNode, note: NoteNode }

export function MindMapPage() {
  return (
    <ReactFlowProvider>
      <MindMap />
    </ReactFlowProvider>
  )
}

function MindMap() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const subjects = useSubjects()
  const topics = useTopics()
  const notes = useNotes()
  const links = useLiveQuery(() => db.mapLinks.toArray(), [], [])
  const positions = useLiveQuery(async () => new Map((await db.mapPositions.toArray()).map((p) => [p.id, { x: p.x, y: p.y }])), [], undefined)
  const [areas, setAreas] = useState<AreaId[]>([])
  const [subjectFilter, setSubjectFilter] = useState<string[]>([])
  const focus = params.get('nota') ?? undefined
  const view: 'global' | 'local' = focus ? 'local' : 'global'
  const [query, setQuery] = useState('')
  const { fitView } = useReactFlow()

  const graph = useMemo(
    () => (positions ? buildGraph({ subjects, topics, notes, links, positions, areas, subjectIds: subjectFilter, focusNoteId: focus }) : { nodes: [], edges: [] }),
    [subjects, topics, notes, links, positions, areas, subjectFilter, focus],
  )

  const [nodes, setNodes, onNodesChange] = useNodesState<Node<NodeData>>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])

  useEffect(() => {
    setNodes(graph.nodes.map((n) => ({ id: n.id, type: n.kind, position: { x: n.x, y: n.y }, data: n as NodeData, origin: [0.5, 0.5] as [number, number] })))
    setEdges(
      graph.edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        sourceHandle: 'c-s',
        targetHandle: 'c-t',
        type: 'straight',
        animated: e.kind === 'citacao',
        data: { kind: e.kind, linkId: e.linkId },
        style:
          e.kind === 'hierarquia'
            ? { stroke: e.color, strokeOpacity: 0.45, strokeWidth: 2 }
            : e.kind === 'citacao'
              ? { stroke: e.color, strokeWidth: 2.2, strokeDasharray: '6 5' }
              : { stroke: e.color, strokeWidth: 2.6 },
      })),
    )
  }, [graph, setNodes, setEdges])

  // Enquadra ao trocar de visão ou filtro
  const fitKey = `${focus}|${areas.join()}|${subjectFilter.join()}|${graph.nodes.length > 0}`
  useEffect(() => {
    const t = window.setTimeout(() => fitView({ padding: 0.08, duration: 400, maxZoom: 1.1, minZoom: 0.04 }), 60)
    return () => window.clearTimeout(t)
  }, [fitKey, fitView])

  const onConnect = useCallback(
    async (c: Connection) => {
      if (!c.source || !c.target || c.source === c.target) return
      const dup = links.some((l) => (l.source === c.source && l.target === c.target) || (l.source === c.target && l.target === c.source))
      if (!dup) await db.mapLinks.add({ id: uid(), source: c.source, target: c.target, createdAt: Date.now() })
    },
    [links],
  )

  const resetLayout = async () => {
    if (await askConfirm('Voltar todos os nós para a organização automática? As ligações continuam.', false)) await db.mapPositions.clear()
  }

  const matches = query.trim() ? notes.filter((n) => n.title.toLowerCase().includes(query.toLowerCase())).slice(0, 6) : []

  return (
    <>
      <PageHeader
        icon={<Waypoints size={24} />}
        title="Mapa mental"
        subtitle="Suas matérias, tópicos e notas conectados. As ligações [[…]] do caderno aparecem sozinhas."
        actions={
          <>
            <Btn onClick={() => fitView({ padding: 0.2, duration: 400 })}>
              <LocateFixed size={16} /> Enquadrar
            </Btn>
            <Btn onClick={resetLayout}>
              <RotateCcw size={16} /> Reorganizar
            </Btn>
          </>
        }
      />
      <Card className="overflow-hidden p-0">
        <div className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-4">
          <Tabs
            value={view}
            onChange={(v) => {
              if (v === 'global') setParams({})
              else if (notes[0]) setParams({ nota: focus ?? notes[0].id })
            }}
            items={[
              { id: 'global', label: 'Global', icon: <Network size={15} /> },
              { id: 'local', label: 'Local', icon: <FileText size={15} /> },
            ]}
          />
          {view === 'local' && (
            <div className="relative w-64">
              <Search size={15} className="absolute top-3 left-3 text-muted" />
              <input id="map-search" className={`${inputCls} pl-9`} placeholder={`Foco: ${notes.find((n) => n.id === focus)?.title ?? 'escolha uma nota'}`} value={query} onChange={(e) => setQuery(e.target.value)} />
              {matches.length > 0 && (
                <div className="absolute inset-x-0 top-full z-20 mt-1 overflow-hidden rounded-xl border border-line bg-white shadow-lg">
                  {matches.map((n) => (
                    <button
                      key={n.id}
                      onClick={() => {
                        setParams({ nota: n.id })
                        setQuery('')
                      }}
                      className="block w-full truncate px-3 py-2 text-left text-sm hover:bg-slate-50"
                    >
                      {n.title}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          <span className="mx-1 hidden h-6 w-px bg-line md:block" />
          <div className="flex flex-wrap gap-1.5">
            {AREAS.map((a) => {
              const on = areas.includes(a.id)
              return (
                <button
                  key={a.id}
                  onClick={() => setAreas(on ? areas.filter((x) => x !== a.id) : [...areas, a.id])}
                  className="rounded-full border px-3 py-1 text-xs font-semibold transition"
                  style={on ? { background: AREA_COLOR[a.id], borderColor: AREA_COLOR[a.id], color: '#fff' } : { borderColor: tint(AREA_COLOR[a.id], 0.4), color: AREA_COLOR[a.id] }}
                >
                  {a.name}
                </button>
              )
            })}
            {subjects
              .filter((s) => !areas.length || areas.includes(s.areaId))
              .map((s) => {
                const on = subjectFilter.includes(s.id)
                return (
                  <button
                    key={s.id}
                    onClick={() => setSubjectFilter(on ? subjectFilter.filter((x) => x !== s.id) : [...subjectFilter, s.id])}
                    className="rounded-full border px-2.5 py-1 text-xs font-semibold transition"
                    style={on ? { background: s.color, borderColor: s.color, color: '#fff' } : { borderColor: tint(s.color, 0.35), color: s.color, background: tint(s.color, 0.06) }}
                  >
                    {s.name}
                  </button>
                )
              })}
          </div>
        </div>

        <div className="relative h-[calc(100vh-290px)] min-h-[460px] bg-[#fafbfc]">
          {subjects.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <Capybara pose="pensando" size={140} />
              <p className="mt-2 max-w-sm text-sm text-muted">Cadastre matérias e tópicos, escreva notas e use [[Nome da nota]] para ver suas ideias se conectando aqui.</p>
            </div>
          ) : (
            <ReactFlow
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              connectionMode={ConnectionMode.Loose}
              onNodeDragStop={(_, node) => db.mapPositions.put({ id: node.id, x: node.position.x, y: node.position.y })}
              onNodeDoubleClick={(_, node) => {
                const d = node.data as NodeData
                if (d.kind === 'note') navigate(`/caderno/${d.refId}`)
              }}
              onNodeClick={(_, node) => {
                const d = node.data as NodeData
                if (view === 'local' && d.kind === 'note') setParams({ nota: d.refId })
              }}
              onEdgeClick={async (_, edge) => {
                const linkId = (edge.data as { linkId?: string } | undefined)?.linkId
                if (linkId && (await askConfirm('Remover esta ligação manual?'))) await db.mapLinks.delete(linkId)
              }}
              deleteKeyCode={null}
              minZoom={0.04}
              maxZoom={2}
              proOptions={{ hideAttribution: true }}
            >
              <Background variant={BackgroundVariant.Dots} gap={22} size={1.4} color="#d5d9e3" />
              <Controls showInteractive={false} className="!rounded-xl !border !border-line !shadow-sm" />
              <MiniMap pannable zoomable className="!rounded-xl !border !border-line" nodeColor={(n) => (n.data as NodeData).color} maskColor="rgba(243,244,247,0.7)" />
            </ReactFlow>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-line px-5 py-3 text-xs text-muted">
          <span className="flex items-center gap-2">
            <span className="h-0.5 w-6 rounded bg-slate-400/60" /> Matéria → tópico → nota
          </span>
          <span className="flex items-center gap-2">
            <span className="w-6 border-t-2 border-dashed border-brand" /> Citação [[…]]
          </span>
          <span className="flex items-center gap-2">
            <span className="h-[3px] w-6 rounded bg-amber-500" /> Ligação manual
          </span>
          <span className="ml-auto">Arraste para organizar · puxe da bolinha lateral de um nó até outro para ligar · duplo clique abre a nota</span>
        </div>
      </Card>
    </>
  )
}
