import { describe, expect, it } from 'vitest'
import { markdownToHtml } from './markdown'

describe('markdownToHtml', () => {
  it('converte títulos, listas e ênfases', () => {
    expect(markdownToHtml('# Título\nTexto **forte** e *leve*.\n- a\n- b\n1. um')).toBe(
      '<h1>Título</h1><p>Texto <strong>forte</strong> e <em>leve</em>.</p><ul><li><p>a</p></li><li><p>b</p></li></ul><ol><li><p>um</p></li></ol>',
    )
  })
  it('escapa HTML', () => {
    expect(markdownToHtml('<script>x</script>')).toBe('<p>&lt;script&gt;x&lt;/script&gt;</p>')
  })
})
