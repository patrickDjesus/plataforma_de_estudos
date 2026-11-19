import { useEffect, useRef } from 'react'
import { ensureSeed, muteSubjectColors } from '../db/repo'
import { useSyncStatus } from '../lib/cloud'

/**
 * Cria os conteúdos padrão no primeiro uso. Espera a nuvem responder antes,
 * para não recriar algo que você já apagou em outro dispositivo.
 */
export function SeedRunner() {
  const sync = useSyncStatus()
  const done = useRef(false)
  useEffect(() => {
    if (sync === 'carregando' || done.current) return
    done.current = true
    ensureSeed()
      .then(() => muteSubjectColors())
      .catch(() => {
      done.current = false
    })
  }, [sync])
  return null
}
