import { useEffect, useState } from 'react'
import { Btn, Modal } from './ui'

type Labels = { title?: string; yes?: string; no?: string }
type Pending = { message: string; danger: boolean; labels?: Labels; resolve: (ok: boolean) => void }
let push: ((p: Pending) => void) | null = null

/** Confirmação dentro da página (o confirm() do navegador nem sempre funciona). */
export function askConfirm(message: string, danger = true, labels?: Labels): Promise<boolean> {
  return new Promise((resolve) => {
    if (!push) return resolve(false)
    push({ message, danger, labels, resolve })
  })
}

export function ConfirmHost() {
  const [pending, setPending] = useState<Pending | null>(null)
  useEffect(() => {
    push = setPending
    return () => {
      push = null
    }
  }, [])
  const close = (ok: boolean) => {
    pending?.resolve(ok)
    setPending(null)
  }
  return (
    <Modal open={!!pending} onClose={() => close(false)} title={pending?.labels?.title ?? 'Tem certeza?'}>
      <p className="mb-6 text-sm text-slate-600">{pending?.message}</p>
      <div className="flex justify-end gap-2">
        <Btn onClick={() => close(false)}>{pending?.labels?.no ?? 'Cancelar'}</Btn>
        <Btn variant={pending?.danger ? 'danger' : 'primary'} onClick={() => close(true)}>
          {pending?.labels?.yes ?? 'Confirmar'}
        </Btn>
      </div>
    </Modal>
  )
}
