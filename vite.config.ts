import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss()],
  // A integração Supabase da Vercel cria as variáveis com o prefixo NEXT_PUBLIC_
  envPrefix: ['VITE_', 'NEXT_PUBLIC_'],
  resolve: {
    // O Artifact do claude.ai é um arquivo só e não usa o Supabase
    alias: mode === 'artifact' ? { '@supabase/supabase-js': fileURLToPath(new URL('./src/lib/stubs/supabase-empty.ts', import.meta.url)) } : {},
  },
  // ...e precisa sair num único app.js
  build: mode === 'artifact' ? { rolldownOptions: { output: { inlineDynamicImports: true } } } : {},
}))
