import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { ClipboardPlus, FileQuestion, History, PenLine, Sparkles, Zap } from 'lucide-react'
import { db } from '../db/db'
import { useSubjectMap, useTopics } from '../db/hooks'
import type { Challenge } from '../db/types'
import { ChallengeBuilderPage } from './ChallengeBuilder'
import { ResultView } from '../components/ChallengeRunner'
import { WritingTraining } from '../components/WritingTraining'
import { SubjectIcon } from '../components/SubjectIcon'
import { Capybara } from '../components/Capybara'
import { Card, PageHeader, Tabs } from '../components/ui'
import { RushPage } from './rush/RushPage'
import { ExtraQuestions } from './ExtraQuestions'

type Tab = 'rush' | 'gerar' | 'escrita' | 'registrar' | 'historico'
const TABS: Tab[] = ['rush', 'gerar', 'escrita', 'registrar', 'historico']

export function QuestionsPage() {
  const [params] = useSearchParams()
  const asked = params.get('aba') as Tab | null
  const [tab, setTab] = useState<Tab>(asked && TABS.includes(asked) ? asked : 'rush')
  return (
    <>
      <PageHeader icon={<FileQuestion size={24} />} title="Questões" subtitle="Rush de questões sem parar, listas sob medida, treino de escrita e registro das questões que você faz por fora." />
      <div className="mb-5">
        <Tabs<Tab>
          value={tab}
          onChange={setTab}
          items={[
            { id: 'rush', label: 'Rush', icon: <Zap size={15} /> },
            { id: 'gerar', label: 'Gerar lista', icon: <Sparkles size={15} /> },
            { id: 'escrita', label: 'Treino de escrita', icon: <PenLine size={15} /> },
            { id: 'registrar', label: 'Registrar extras', icon: <ClipboardPlus size={15} /> },
            { id: 'historico', label: 'Histórico', icon: <History size={15} /> },
          ]}
        />
      </div>
      <div key={tab} className="page-in">
        {tab === 'rush' && <RushPage />}
        {tab === 'gerar' && <ChallengeBuilderPage mode="questoes" />}
        {tab === 'registrar' && <ExtraQuestions />}
        {tab === 'escrita' && <WritingTraining />}
        {tab === 'historico' && <QuestionHistory />}
      </div>
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
