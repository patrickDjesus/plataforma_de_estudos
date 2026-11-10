import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import './index.css'
import { Layout } from './components/Layout'
import { HomePage } from './pages/Home'
import { CheckInPage } from './pages/CheckIn'
import { CalendarPage } from './pages/Calendar'
import { NotebookPage } from './pages/Notebook'
import { SubjectsPage } from './pages/Subjects'
import { SettingsPage } from './pages/Settings'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="checkin" element={<CheckInPage />} />
          <Route path="calendario" element={<CalendarPage />} />
          <Route path="caderno" element={<NotebookPage />} />
          <Route path="caderno/:noteId" element={<NotebookPage />} />
          <Route path="materias" element={<SubjectsPage />} />
          <Route path="config" element={<SettingsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
