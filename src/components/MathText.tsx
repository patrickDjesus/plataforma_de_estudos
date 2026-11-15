import { useEffect, useRef } from 'react'

/*
 * Texto com fórmulas em LaTeX ($...$). O MathJax só é baixado quando aparece
 * a primeira fórmula; sem internet, o texto aparece como está.
 */
type MJ = { typesetPromise?: (els: Element[]) => Promise<void>; typesetClear?: (els: Element[]) => void; startup?: { promise: Promise<void> } }
let loading: Promise<MJ | null> | null = null

function loadMathJax(): Promise<MJ | null> {
  if (loading) return loading
  loading = new Promise((resolve) => {
    const w = window as unknown as { MathJax?: MJ | Record<string, unknown> }
    w.MathJax = {
      tex: { inlineMath: [['$', '$'], ['\\(', '\\)']], displayMath: [['$$', '$$'], ['\\[', '\\]']], processEscapes: true },
      svg: { fontCache: 'global' },
      options: { skipHtmlTags: ['script', 'noscript', 'style', 'textarea', 'pre', 'code', 'input'] },
      startup: { typeset: false },
    }
    const s = document.createElement('script')
    s.src = 'https://cdn.jsdelivr.net/npm/mathjax@3.2.2/es5/tex-svg.js'
    s.async = true
    s.onload = () => {
      const mj = (window as unknown as { MathJax: MJ }).MathJax
      ;(mj.startup?.promise ?? Promise.resolve()).then(() => resolve(mj), () => resolve(null))
    }
    s.onerror = () => resolve(null)
    document.head.appendChild(s)
  })
  return loading
}

const hasMath = (t: string) => /\$[^$]+\$|\\\(|\\\[/.test(t)

export function MathText({ text, className, as: Tag = 'div' }: { text: string; className?: string; as?: 'div' | 'span' | 'p' }) {
  const ref = useRef<HTMLElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.textContent = text
    if (!hasMath(text)) return
    let alive = true
    loadMathJax().then((mj) => {
      if (!alive || !mj?.typesetPromise || !el.isConnected) return
      try {
        mj.typesetClear?.([el])
      } catch {
        /* ok */
      }
      mj.typesetPromise([el]).catch(() => undefined)
    })
    return () => {
      alive = false
    }
  }, [text])
  return <Tag ref={ref as never} className={`[&_mjx-container]:max-w-full [&_mjx-container]:overflow-x-auto ${className ?? ''}`} />
}
