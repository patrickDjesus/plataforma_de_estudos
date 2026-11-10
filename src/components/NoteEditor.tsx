import { useEffect, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { EditorContent, useEditor, useEditorState } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Highlight from '@tiptap/extension-highlight'
import { Placeholder } from '@tiptap/extensions'
import { Bold, Heading1, Heading2, Highlighter, Italic, List, ListOrdered, Quote, Strikethrough } from 'lucide-react'
import { createNote, findNoteByTitle, updateNote } from '../db/repo'
import { db } from '../db/db'
import type { Note, Subject } from '../db/types'
import { WikiLink } from '../lib/wikilink'
import { tint } from '../lib/colors'

const HIGHLIGHTS = ['#fde047', '#86efac', '#93c5fd', '#f9a8d4', '#fdba74', '#c4b5fd']

export function NoteEditor({ note, subject, allTitles, reloadToken = 0 }: { note: Note; subject?: Subject; allTitles: Set<string>; reloadToken?: number }) {
  const navigate = useNavigate()
  const saveTimer = useRef<number | undefined>(undefined)
  const wrapRef = useRef<HTMLDivElement>(null)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ link: false, code: false, codeBlock: false, horizontalRule: false }),
      Highlight.configure({ multicolor: true }),
      WikiLink,
      Placeholder.configure({ placeholder: 'Comece a escrever… use # para títulos e [[Nome]] para ligar outra nota.' }),
    ],
    content: note.content,
    editorProps: { attributes: { class: 'prose-note' } },
    onUpdate: ({ editor }) => {
      window.clearTimeout(saveTimer.current)
      const html = editor.getHTML()
      saveTimer.current = window.setTimeout(() => {
        saveTimer.current = undefined // salvo: nada pendente
        updateNote(note.id, { content: html })
      }, 400)
    },
  })

  // Salva o que estiver pendente ao trocar de nota
  useEffect(() => {
    return () => {
      if (saveTimer.current && editor) {
        window.clearTimeout(saveTimer.current)
        updateNote(note.id, { content: editor.getHTML() })
      }
    }
  }, [editor, note.id])

  // Conteúdo alterado por fora (ex.: explicação inserida): recarrega do banco
  useEffect(() => {
    if (!reloadToken || !editor) return
    window.clearTimeout(saveTimer.current)
    saveTimer.current = undefined
    db.notes.get(note.id).then((n) => n && editor.commands.setContent(n.content, { emitUpdate: false }))
  }, [reloadToken, editor, note.id])

  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      h1: e?.isActive('heading', { level: 1 }),
      h2: e?.isActive('heading', { level: 2 }),
      bold: e?.isActive('bold'),
      italic: e?.isActive('italic'),
      strike: e?.isActive('strike'),
      bullet: e?.isActive('bulletList'),
      ordered: e?.isActive('orderedList'),
      quote: e?.isActive('blockquote'),
    }),
  })

  // Marca ligações para notas que ainda não existem
  const titlesKey = useMemo(() => [...allTitles].join('\u0000'), [allTitles])
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const mark = () =>
      el.querySelectorAll<HTMLElement>('.wikilink').forEach((a) => {
        a.classList.toggle('missing', !allTitles.has((a.dataset.target ?? '').toLowerCase()))
        a.title = allTitles.has((a.dataset.target ?? '').toLowerCase()) ? 'Abrir nota' : 'Clique para criar esta nota'
      })
    mark()
    editor?.on('update', mark)
    return () => {
      editor?.off('update', mark)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, titlesKey])

  const onClick = async (e: React.MouseEvent) => {
    const link = (e.target as HTMLElement).closest<HTMLElement>('.wikilink')
    if (!link?.dataset.target) return
    e.preventDefault()
    const target = link.dataset.target
    const found = await findNoteByTitle(target)
    const id = found?.id ?? (await createNote(note.subjectId, note.topicId, target))
    navigate(`/caderno/${id}`)
  }

  if (!editor) return null
  const color = subject?.color ?? '#3e63f2'
  const btn = (active: boolean | undefined) =>
    `rounded-lg p-2 transition ${active ? 'text-white' : 'text-slate-600 hover:bg-slate-100'}`
  const activeStyle = (active: boolean | undefined) => (active ? { background: color } : undefined)

  return (
    <div ref={wrapRef}>
      <div className="sticky top-16 z-10 mb-4 flex flex-wrap items-center gap-1 rounded-2xl border border-line bg-white/95 p-1.5 backdrop-blur">
        <button className={btn(state?.h1)} style={activeStyle(state?.h1)} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} title="Título">
          <Heading1 size={17} />
        </button>
        <button className={btn(state?.h2)} style={activeStyle(state?.h2)} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} title="Subtítulo">
          <Heading2 size={17} />
        </button>
        <span className="mx-1 h-6 w-px bg-line" />
        <button className={btn(state?.bold)} style={activeStyle(state?.bold)} onClick={() => editor.chain().focus().toggleBold().run()} title="Negrito (Ctrl+B)">
          <Bold size={17} />
        </button>
        <button className={btn(state?.italic)} style={activeStyle(state?.italic)} onClick={() => editor.chain().focus().toggleItalic().run()} title="Itálico (Ctrl+I)">
          <Italic size={17} />
        </button>
        <button className={btn(state?.strike)} style={activeStyle(state?.strike)} onClick={() => editor.chain().focus().toggleStrike().run()} title="Riscado">
          <Strikethrough size={17} />
        </button>
        <span className="mx-1 h-6 w-px bg-line" />
        <button className={btn(state?.bullet)} style={activeStyle(state?.bullet)} onClick={() => editor.chain().focus().toggleBulletList().run()} title="Lista">
          <List size={17} />
        </button>
        <button className={btn(state?.ordered)} style={activeStyle(state?.ordered)} onClick={() => editor.chain().focus().toggleOrderedList().run()} title="Lista numerada">
          <ListOrdered size={17} />
        </button>
        <button className={btn(state?.quote)} style={activeStyle(state?.quote)} onClick={() => editor.chain().focus().toggleBlockquote().run()} title="Citação">
          <Quote size={17} />
        </button>
        <span className="mx-1 h-6 w-px bg-line" />
        <Highlighter size={16} className="mx-1 text-slate-400" />
        {[tint(color, 0.3), ...HIGHLIGHTS].map((c) => (
          <button
            key={c}
            onClick={() => editor.chain().focus().toggleHighlight({ color: c }).run()}
            className="h-6 w-6 rounded-full border-2 border-white shadow ring-1 ring-line transition hover:scale-110"
            style={{ background: c }}
            title="Destacar"
          />
        ))}
        <button onClick={() => editor.chain().focus().unsetHighlight().run()} className="ml-1 rounded-lg px-2 py-1 text-xs font-semibold text-muted hover:bg-slate-100">
          Limpar
        </button>
      </div>
      <div onClick={onClick}>
        <EditorContent editor={editor} />
      </div>
    </div>
  )
}
