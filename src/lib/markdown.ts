/** Markdown simples (títulos, listas, negrito/itálico, parágrafos) → HTML seguro. */
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const inline = (s: string) =>
  esc(s)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*(?!\s)(.+?)\*(?!\*)/g, '$1<em>$2</em>')

export function markdownToHtml(md: string): string {
  const out: string[] = []
  let list: 'ul' | 'ol' | null = null
  const closeList = () => {
    if (list) out.push(`</${list}>`)
    list = null
  }
  for (const raw of md.replace(/\r/g, '').split('\n')) {
    const line = raw.trim()
    const h = line.match(/^(#{1,3})\s+(.*)$/)
    const ul = line.match(/^[-*•]\s+(.*)$/)
    const ol = line.match(/^\d+[.)]\s+(.*)$/)
    if (h) {
      closeList()
      const level = Math.min(3, h[1].length)
      out.push(`<h${level}>${inline(h[2])}</h${level}>`)
    } else if (ul || ol) {
      const kind = ul ? 'ul' : 'ol'
      if (list !== kind) {
        closeList()
        out.push(`<${kind}>`)
        list = kind
      }
      out.push(`<li><p>${inline((ul ?? ol)![1])}</p></li>`)
    } else if (!line) {
      closeList()
    } else {
      closeList()
      out.push(`<p>${inline(line)}</p>`)
    }
  }
  closeList()
  return out.join('')
}
