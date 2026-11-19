import { useEffect, useRef } from 'react'
import { ensureSeed, restoreVividColors } from '../db/repo'
import { useSyncStatus, withLowStamps } from '../lib/cloud'

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
    withLowStamps(() => ensureSeed())
      .then(() => withLowStamps(() => restoreVividColors()))
      .catch(() => {
      done.current = false
    })
  }, [sync])
  return null
}
