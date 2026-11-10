import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, MemoryRouter, Route, Routes } from 'react-router-dom'
import { ConfirmHost } from './components/confirm'
import { SeedRunner } from './components/SeedRunner'
import { startCloudSync } from './lib/cloud'
import './index.css'
import { Layout } from './components/Layout'
import { HomePage } from './pages/Home'
import { CheckInPage } from './pages/CheckIn'
import { CalendarPage } from './pages/Calendar'
import { NotebookPage } from './pages/Notebook'
import { SubjectsPage } from './pages/Subjects'
import { SettingsPage } from './pages/Settings'
import { MindMapPage } from './pages/MindMap'
import { FocusPage } from './pages/Focus'
import { RecoveryPage } from './pages/Recovery'
import { ChallengeBuilderPage } from './pages/ChallengeBuilder'
import { QuestionsPage } from './pages/Questions'
import { ErrorsPage } from './pages/Errors'

startCloudSync()

// Na página publicada no claude.ai a URL não pode mudar: usa roteamento em memória
const Router = import.meta.env.VITE_ARTIFACT ? MemoryRouter : BrowserRouter

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Router>
      <Routes>
        {/* Check-in: tela cheia, separada do resto do site */}
        <Route path="checkin" element={<CheckInPage />} />
        {/* Sessão guiada: também em tela cheia */}
        <Route path="foco/:blockId" element={<FocusPage />} />
        <Route element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="calendario" element={<CalendarPage />} />
          <Route path="caderno" element={<NotebookPage />} />
          <Route path="caderno/:noteId" element={<NotebookPage />} />
          <Route path="mapa" element={<MindMapPage />} />
          <Route path="recuperacao" element={<RecoveryPage />} />
          <Route path="desafio" element={<ChallengeBuilderPage />} />
          <Route path="questoes" element={<QuestionsPage />} />
          <Route path="erros" element={<ErrorsPage />} />
          <Route path="materias" element={<SubjectsPage />} />
          <Route path="config" element={<SettingsPage />} />
        </Route>
      </Routes>
      <ConfirmHost />
      <SeedRunner />
    </Router>
  </StrictMode>,
)
