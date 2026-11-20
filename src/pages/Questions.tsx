import { useEffect, useState } from 'react'
import { useLocation, useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowLeft, FileQuestion } from 'lucide-react'
import { db } from '../db/db'
import { useSubjectMap, useTopics } from '../db/hooks'
import type { Challenge } from '../db/types'
import { ChallengeBuilderPage } from './ChallengeBuilder'
import { ResultView } from '../components/ChallengeRunner'
import { CodeLab } from '../components/CodeLab'
import { SubjectIcon } from '../components/SubjectIcon'
import { Capybara } from '../components/Capybara'
import { Card, PageHeader } from '../components/ui'
import { QuestionModes, modeInfo } from '../components/QuestionModes'
import { RushPage } from './rush/RushPage'
import { ExtraQuestions } from './ExtraQuestions'
import { Simulado } from './Simulado'

type Tab = 'rush' | 'simulado' | 'gerar' | 'codigo' | 'registrar' | 'historico'
const TABS: Tab[] = ['rush', 'simulado', 'gerar', 'codigo', 'registrar', 'historico']

export function QuestionsPage() {
  const [params] = useSearchParams()
  const location = useLocation()
  const aba = params.get('aba')
  const asked = (aba === 'escrita' ? 'codigo' : aba) as Tab | null
  const initial = asked && TABS.includes(asked) ? asked : null
  const [tab, setTab] = useState<Tab | null>(initial)
  // Clicar em "Questões" no menu de cima (mesmo já estando aqui) volta para a escolha de modo
  useEffect(() => setTab(initial), [location.key]) // eslint-disable-line react-hooks/exhaustive-deps

  const mode = tab ? modeInfo(tab) : undefined
  const label = mode?.title ?? (tab === 'registrar' ? 'Registrar extras' : 'Histórico')
  return (
    <>
      <PageHeader icon={<FileQuestion size={24} />} title="Questões" subtitle={tab ? undefined : 'Escolha um modo.'} />
      {!tab ? (
        <div key="menu" className="page-in">
          <QuestionModes onPick={setTab} onExtra={setTab} />
        </div>
      ) : (
        <>
          <div className="mb-5 flex items-center gap-3">
            <button onClick={() => setTab(null)} className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-white px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">
              <ArrowLeft size={16} /> Modos
            </button>
            <span className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold text-white" style={{ background: mode ? `linear-gradient(135deg, ${mode.from}, ${mode.to})` : '#121826' }}>
              {label}
            </span>
          </div>
          <div key={tab} className="page-in">
            {tab === 'rush' && <RushPage />}
            {tab === 'simulado' && <Simulado />}
            {tab === 'gerar' && <ChallengeBuilderPage mode="questoes" />}
            {tab === 'registrar' && <ExtraQuestions />}
            {tab === 'codigo' && <CodeLab />}
            {tab === 'historico' && <QuestionHistory />}
          </div>
        </>
      )}
    </>
  )
}

function QuestionHistory() {
  const list = useLiveQuery(() => db.challenges.where('createdAt').above(0).reverse().toArray(), [], [])
  const subjects = useSubjectMap()
  const topics = useTopics()
  const [open, setOpen] = useState<Challenge | null>(null)
  const sets = list.filter((c) => c.origin === 'questoes' || c.origin === 'demanda')

  if (open) {
    const color = subjects.get(open.subjectId)?.color ?? '#3e63f2'
    return (
      <Card className="mx-auto max-w-2xl p-6">
        <ResultView items={open.items} answers={open.answers} results={open.results} fromNotes={open.fromNotes} color={color} onSelfGrade={() => undefined} onContest={() => undefined} onFinish={() => setOpen(null)} />
      </Card>
    )
  }
  if (!sets.length)
    return (
      <Card className="flex flex-col items-center p-10 text-center">
        <Capybara pose="pensando" size={120} />
        <p className="mt-2 text-sm text-muted">Suas listas de questões e desafios livres aparecem aqui, com a nota e a correção.</p>
      </Card>
    )
  return (
    <Card className="p-2">
      <div className="divide-y divide-line">
        {sets.map((c) => {
          const s = subjects.get(c.subjectId)
          const t = topics.find((x) => x.id === c.topicId)
          const pct = Math.round(c.score * 100)
          return (
            <button key={c.id} onClick={() => setOpen(c)} className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left hover:bg-slate-50">
              <SubjectIcon subject={s} size={38} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-bold">
                  {s?.name}
                  {t ? ` · ${t.name}` : ''}
                </div>
                <div className="truncate text-xs text-muted">
                  {c.items.length} questões · {c.origin === 'questoes' ? 'lista de questões' : 'desafio livre'} · {new Date(c.createdAt).toLocaleDateString('pt-BR')}
                  {c.request ? ` · “${c.request}”` : ''}
                </div>
              </div>
              <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${pct >= 85 ? 'bg-emerald-50 text-emerald-700' : pct >= 50 ? 'bg-amber-50 text-amber-700' : 'bg-rose-50 text-rose-700'}`}>{pct}%</span>
            </button>
          )
        })}
      </div>
    </Card>
  )
}
