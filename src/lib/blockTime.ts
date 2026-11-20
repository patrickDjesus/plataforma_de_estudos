import type { Block } from '../db/types'
import { fmtDuration, fmtTime } from './dates'

/** Como mostrar o "quando" de um bloco: duração (sem hora marcada) ou faixa de horário. */
export const blockWhen = (b: Pick<Block, 'start' | 'end' | 'flex'>) => (b.flex ? fmtDuration((b.end - b.start) * 60) : `${fmtTime(b.start)}–${fmtTime(b.end)}`)
