import { describe, expect, it } from 'vitest'
import { noteText } from './ai'

describe('noteText', () => {
  it('converte o HTML do editor em texto com quebras de linha', () => {
    expect(noteText('<h1>Leis de Newton</h1><p>1ª lei: <strong>inércia</strong></p><ul><li>A</li><li>B</li></ul>')).toBe('Leis de Newton\n1ª lei: inércia\nA\nB')
  })
  it('limita o tamanho', () => {
    expect(noteText('<p>' + 'a'.repeat(50) + '</p>', 10)).toBe('aaaaaaaaaa\n[…]')
  })
  it('decodifica entidades', () => {
    expect(noteText('<p>a &amp; b &lt; c</p>')).toBe('a & b < c')
  })
})
