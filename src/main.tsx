import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, MemoryRouter, Route, Routes } from 'react-router-dom'
import { ConfirmHost } from './components/confirm'
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

startCloudSync()

// Na página publicada no claude.ai a URL não pode mudar: usa roteamento em memória
const Router = import.meta.env.VITE_ARTIFACT ? MemoryRouter : BrowserRouter

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Router>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="checkin" element={<CheckInPage />} />
          <Route path="calendario" element={<CalendarPage />} />
          <Route path="caderno" element={<NotebookPage />} />
          <Route path="caderno/:noteId" element={<NotebookPage />} />
          <Route path="mapa" element={<MindMapPage />} />
          <Route path="materias" element={<SubjectsPage />} />
          <Route path="config" element={<SettingsPage />} />
        </Route>
      </Routes>
      <ConfirmHost />
    </Router>
  </StrictMode>,
)
