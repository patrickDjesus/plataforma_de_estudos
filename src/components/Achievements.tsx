import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Brain, CalendarCheck2, Flame, Footprints, GraduationCap, Languages, Link2, Lock, Moon, Mountain, PenLine, Sunrise, Timer, Trophy, type LucideIcon } from 'lucide-react'
import { db } from '../db/db'
import { AREAS } from '../db/hooks'
import { achievements, areaLevels, computeStats, type AchievementIcon } from '../lib/achievements'
import { AREA_COLOR, tint } from '../lib/colors'
import { levelInfo, xpFrom } from '../lib/xp'
import { fmtDuration } from '../lib/dates'

export const ACHIEVEMENT_ICONS: Record<AchievementIcon, LucideIcon> = {
  footprints: Footprints,
  timer: Timer,
  flame: Flame,
  calendar: CalendarCheck2,
  mountain: Mountain,
  graduation: GraduationCap,
  languages: Languages,
  brain: Brain,
  link: Link2,
  pen: PenLine,
  sunrise: Sunrise,
  moon: Moon,
  trophy: Trophy,
}

/** Lê tudo que a gamificação precisa. */
export function useStats() {
  return useLiveQuery(async () => {
    const [sessions, blocks, reviews, notes, subjects, unlocked] = await Promise.all([
      db.sessions.toArray(),
      db.blocks.toArray(),
      db.reviews.toArray(),
      db.notes.toArray(),
      db.subjects.toArray(),
      db.achievements.toArray(),
    ])
    return { stats: computeStats({ sessions, blocks, reviews, notes, subjects }), unlocked: new Map(unlocked.map((u) => [u.id, u.unlockedAt])) }
  }, [])
}

export function AchievementsSection() {
  const data = useStats()
  const list = useMemo(() => (data ? achievements(data.stats) : []), [data])
  if (!data) return null
  const { stats } = data
  const total = levelInfo(xpFrom(stats.totalSeconds, stats.doneBlocks, stats.reviewsDone))
  const levels = areaLevels(stats)
  const got = list.filter((a) => a.unlocked).length

  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-[1fr_1.6fr]">
        {/* Nível geral */}
        <div className="relative overflow-hidden rounded-[18px] bg-gradient-to-br from-[#3e63f2] to-[#6b4cff] p-6 text-white">
          <span className="absolute -top-10 -right-10 h-40 w-40 rounded-full bg-white/10" />
          <span className="absolute -bottom-14 -left-6 h-36 w-36 rounded-full bg-white/5" />
          <div className="relative">
            <div className="text-xs font-semibold tracking-wider text-white/70 uppercase">Nível geral</div>
            <div className="mt-2 flex items-end gap-3">
              <span className="grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-[#ffb648] to-[#ff7a2f] font-display text-3xl font-extrabold shadow-lg">{total.level}</span>
              <div className="pb-1">
                <div className="font-display text-2xl font-bold tabular-nums">{total.xp} XP</div>
                <div className="text-sm text-white/75">
                  faltam {total.needed - total.inLevel} XP para o nível {total.level + 1}
                </div>
              </div>
            </div>
            <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-white/20">
              <div className="h-full rounded-full bg-white" style={{ width: `${total.progress * 100}%` }} />
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
              <div className="rounded-xl bg-white/10 py-2">
                <div className="font-display text-lg font-bold">{fmtDuration(stats.totalSeconds)}</div>estudadas
              </div>
              <div className="rounded-xl bg-white/10 py-2">
                <div className="font-display text-lg font-bold">{stats.reviewsDone}</div>revisões
              </div>
              <div className="rounded-xl bg-white/10 py-2">
                <div className="font-display text-lg font-bold">{stats.longestStreak}</div>maior sequência
              </div>
            </div>
          </div>
        </div>

        {/* Nível por área */}
        <div className="rounded-[18px] border border-line p-5">
          <h3 className="mb-4 flex items-center gap-2 font-sans text-sm font-semibold">
            <GraduationCap size={18} /> Nível por área
          </h3>
          <div className="space-y-4">
            {levels.map((l) => {
              const area = AREAS.find((a) => a.id === l.id)!
              const c = AREA_COLOR[l.id]
              return (
                <div key={l.id} className="flex items-center gap-4">
                  <span className="subject-icon h-12 w-12 shrink-0 rounded-[14px] font-display text-lg font-extrabold" style={{ background: `linear-gradient(145deg, ${c}, color-mix(in srgb, ${c} 72%, #000))` }}>
                    <span className="relative z-10">{l.level}</span>
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="mb-1.5 flex justify-between text-sm">
                      <span className="font-semibold">{area.name}</span>
                      <span className="text-muted tabular-nums">
                        {l.inLevel} / {l.needed} XP
                      </span>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full" style={{ background: tint(c, 0.12) }}>
                      <div className="h-full rounded-full transition-all" style={{ width: `${l.progress * 100}%`, background: c }} />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Conquistas */}
      <div className="rounded-[18px] border border-line p-5">
        <h3 className="mb-4 flex items-center gap-2 font-sans text-sm font-semibold">
          <Trophy size={18} /> Conquistas
          <span className="rounded-full bg-brand-soft px-2 py-0.5 text-[11px] font-bold text-brand">
            {got}/{list.length}
          </span>
        </h3>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(190px,1fr))] gap-3">
          {list.map((a) => {
            const Icon = ACHIEVEMENT_ICONS[a.icon]
            const when = data.unlocked.get(a.id)
            return (
              <div key={a.id} className={`relative flex flex-col items-center rounded-2xl border p-4 text-center transition ${a.unlocked ? 'border-transparent' : 'border-line bg-[#fafbfc]'}`} style={a.unlocked ? { background: tint(a.color, 0.08), boxShadow: `inset 0 0 0 1.5px ${tint(a.color, 0.35)}` } : undefined}>
                <span
                  className={`subject-icon mb-2 h-14 w-14 rounded-[18px] ${a.unlocked ? '' : 'grayscale'}`}
                  style={{ background: a.unlocked ? `linear-gradient(145deg, ${a.color}, color-mix(in srgb, ${a.color} 70%, #000))` : 'linear-gradient(145deg,#cfd4de,#a9b0be)' }}
                >
                  {a.unlocked ? <Icon size={26} /> : <Lock size={22} />}
                </span>
                <div className="font-display text-sm font-bold">{a.title}</div>
                <div className="mt-0.5 text-xs text-muted">{a.description}</div>
                {a.unlocked ? (
                  <div className="mt-2 text-[11px] font-semibold" style={{ color: a.color }}>
                    Desbloqueada{when ? ` em ${new Date(when).toLocaleDateString('pt-BR')}` : ''}
                  </div>
                ) : (
                  <div className="mt-2 w-full">
                    <div className="h-1.5 overflow-hidden rounded-full bg-[#eceef3]">
                      <div className="h-full rounded-full" style={{ width: `${(a.value / a.target) * 100}%`, background: a.color }} />
                    </div>
                    <div className="mt-1 text-[11px] text-muted tabular-nums">
                      {a.value}/{a.target}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
