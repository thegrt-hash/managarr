import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Library from './pages/Library'
import FolderDetail from './pages/FolderDetail'
import Duplicates from './pages/Duplicates'
import ISOFiles from './pages/ISOFiles'
import Baselines from './pages/Baselines'
import Integrations from './pages/Integrations'
import Settings from './pages/Settings'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="library" element={<Library />} />
        <Route path="library/:id" element={<FolderDetail />} />
        <Route path="duplicates" element={<Duplicates />} />
        <Route path="iso-files" element={<ISOFiles />} />
        <Route path="baselines" element={<Baselines />} />
        <Route path="integrations" element={<Integrations />} />
        <Route path="settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
