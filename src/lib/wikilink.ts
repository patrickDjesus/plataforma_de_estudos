import { Mark, markInputRule, mergeAttributes } from '@tiptap/core'

/**
 * Ligação entre notas: digitar [[Nome da nota]] vira um link.
 * Guardado como <span class="wikilink" data-target="Nome da nota">Nome da nota</span>.
 */
export const WikiLink = Mark.create({
  name: 'wikilink',
  inclusive: false,
  excludes: '_',

  addAttributes() {
    return {
      target: {
        default: null,
        parseHTML: (el) => el.getAttribute('data-target'),
        renderHTML: (attrs) => ({ 'data-target': attrs.target }),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'span.wikilink' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes, { class: 'wikilink' }), 0]
  },

  addInputRules() {
    return [
      markInputRule({
        find: /\[\[([^[\]]+)\]\]$/,
        type: this.type,
        getAttributes: (match) => ({ target: match[1].trim() }),
      }),
    ]
  },
})

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** Títulos citados numa nota (via [[...]]). */
export function linkedTitles(html: string): string[] {
  const out: string[] = []
  const re = /data-target="([^"]*)"/g
  let m: RegExpExecArray | null
  while ((m = re.exec(html))) out.push(m[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>'))
  return out
}

/** Atualiza ligações quando uma nota é renomeada. */
export function renameLinks(html: string, oldTitle: string, newTitle: string): string {
  const re = new RegExp(`(<span[^>]*data-target=")${escapeRe(escapeHtml(oldTitle))}("[^>]*>)${escapeRe(escapeHtml(oldTitle))}(</span>)`, 'gi')
  return html.replace(re, `$1${escapeHtml(newTitle)}$2${escapeHtml(newTitle)}$3`)
}
