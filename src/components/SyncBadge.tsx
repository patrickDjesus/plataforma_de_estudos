import { useState } from 'react'
import { Cloud, CloudOff, HardDrive, LogIn, Mail } from 'lucide-react'
import { Spinner } from './Voice'
import { Btn, Modal, inputCls } from './ui'
import { syncError, useSyncStatus } from '../lib/cloud'
import { sendLoginLink, signOut, supabaseConfigured, useAuthEmail } from '../lib/supabase'

const LABEL = {
  carregando: 'Conectando…',
  sincronizado: 'Salvo na nuvem',
  enviando: 'Salvando…',
  local: 'Só neste navegador',
  erro: 'Nuvem com problema',
  entrar: 'Entrar',
}

/** Indicador discreto de sincronização ao lado do cronômetro. No site próprio, também é o botão de login. */
export function SyncBadge() {
  const s = useSyncStatus()
  const [open, setOpen] = useState(false)
  const icon =
    s === 'sincronizado' ? <Cloud size={16} /> : s === 'local' ? <HardDrive size={16} /> : s === 'erro' ? <CloudOff size={16} /> : s === 'entrar' ? <LogIn size={16} /> : <Spinner size={16} />
  const color =
    s === 'sincronizado'
      ? 'text-emerald-600 bg-emerald-50'
      : s === 'erro'
        ? 'text-rose-600 bg-rose-50'
        : s === 'local'
          ? 'text-slate-500 bg-[#f1f2f5]'
          : s === 'entrar'
            ? 'text-white bg-brand'
            : 'text-brand bg-brand-soft'
  const title =
    s === 'local'
      ? 'Os dados ficam salvos só neste navegador. Abra pelo claude.ai, logado, para sincronizar entre dispositivos.'
      : s === 'entrar'
        ? 'Entre com seu e-mail para salvar na nuvem e usar a IA.'
        : s === 'erro'
          ? syncError()
          : LABEL[s]
  const cls = `items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-semibold ${color} ${s === 'entrar' ? 'flex' : 'hidden md:flex'}`

  if (!supabaseConfigured)
    return (
      <span className={cls} title={title}>
        {icon}
        <span className="hidden xl:inline">{LABEL[s]}</span>
      </span>
    )
  return (
    <>
      <button onClick={() => setOpen(true)} className={`${cls} transition hover:brightness-95`} title={title}>
        {icon}
        <span className={s === 'entrar' ? '' : 'hidden xl:inline'}>{LABEL[s]}</span>
      </button>
      <LoginModal open={open} onClose={() => setOpen(false)} />
    </>
  )
}

function LoginModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const email = useAuthEmail()
  return (
    <Modal open={open} onClose={onClose} title={email ? 'Sua conta' : 'Entrar'}>
      {email ? (
        <div className="space-y-4">
          <p className="text-sm text-muted">
            Conectado como <b className="text-ink">{email}</b>. Seus dados ficam salvos na nuvem e sincronizam entre os seus aparelhos.
          </p>
          <Btn
            variant="danger"
            onClick={async () => {
              await signOut()
              onClose()
            }}
          >
            Sair desta conta
          </Btn>
        </div>
      ) : (
        <LoginForm />
      )}
    </Modal>
  )
}

/** Formulário de entrada por link no e-mail. */
export function LoginForm() {
  const [address, setAddress] = useState('')
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle')
  const [error, setError] = useState('')

  const send = async () => {
    if (!address.includes('@')) return setError('Digite um e-mail válido.')
    setState('sending')
    setError('')
    const err = await sendLoginLink(address).catch((e: Error) => e.message)
    if (err) {
      setError(/rate|seconds/i.test(err) ? 'Muitos pedidos seguidos. Espere um minuto e tente de novo.' : 'Não consegui mandar o link. Tente de novo.')
      setState('idle')
    } else setState('sent')
  }

  if (state === 'sent')
    return (
      <div className="space-y-3 text-center">
        <Mail size={36} className="mx-auto text-brand" />
        <p className="text-sm">
          Mandei um link para <b>{address}</b>. Abra o e-mail neste aparelho e toque no link para entrar.
        </p>
        <button onClick={() => setState('idle')} className="text-xs font-semibold text-brand">
          Usar outro e-mail
        </button>
      </div>
    )
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault()
        void send()
      }}
    >
      <p className="text-sm text-muted">Entre para salvar na nuvem, sincronizar com o celular e usar as funções de IA. Sem senha: você recebe um link no e-mail.</p>
      <input type="email" autoFocus className={inputCls} placeholder="seu@email.com" value={address} onChange={(e) => setAddress(e.target.value)} />
      {error && <p className="text-xs font-semibold text-rose-600">{error}</p>}
      <Btn variant="primary" type="submit" disabled={state === 'sending'} className="w-full">
        {state === 'sending' ? 'Mandando…' : 'Mandar link de entrada'}
      </Btn>
    </form>
  )
}
