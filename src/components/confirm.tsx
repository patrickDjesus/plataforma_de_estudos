import { useEffect, useState } from 'react'
import { Btn, Modal } from './ui'

type Pending = { message: string; danger: boolean; resolve: (ok: boolean) => void }
let push: ((p: Pending) => void) | null = null

/** Confirmação dentro da página (o confirm() do navegador nem sempre funciona). */
export function askConfirm(message: string, danger = true): Promise<boolean> {
  return new Promise((resolve) => {
    if (!push) return resolve(false)
    push({ message, danger, resolve })
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
    <Modal open={!!pending} onClose={() => close(false)} title="Tem certeza?">
      <p className="mb-6 text-sm text-slate-600">{pending?.message}</p>
      <div className="flex justify-end gap-2">
        <Btn onClick={() => close(false)}>Cancelar</Btn>
        <Btn variant={pending?.danger ? 'danger' : 'primary'} onClick={() => close(true)}>
          Confirmar
        </Btn>
      </div>
    </Modal>
  )
}
