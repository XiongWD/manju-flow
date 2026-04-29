import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Toaster } from 'sonner'
import { AppLayout } from '@/components/layout/AppLayout'
import Dashboard from '@/pages/Dashboard'
import Projects from '@/pages/Projects'
import ProjectDetail from '@/pages/ProjectDetail'
import StoryCharacters from '@/pages/StoryCharacters'
import ShotEditor from '@/pages/ShotEditor'
import RenderQueue from '@/pages/RenderQueue'
import QACenter from '@/pages/QACenter'
import AssetBrowser from '@/pages/AssetBrowser'
import EditDelivery from '@/pages/EditDelivery'
import Analytics from '@/pages/Analytics'
import Settings from '@/pages/Settings'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/projects" element={<Projects />} />
          <Route path="/projects/:id" element={<ProjectDetail />} />
          <Route path="/projects/:id/story" element={<StoryCharacters />} />
          <Route path="/projects/:id/shots" element={<ShotEditor />} />
          <Route path="/render" element={<RenderQueue />} />
          <Route path="/qa" element={<QACenter />} />
          <Route path="/assets" element={<AssetBrowser />} />
          <Route path="/delivery" element={<EditDelivery />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/settings" element={<Settings />} />
        </Route>
      </Routes>
      <Toaster position="bottom-right" richColors />
    </BrowserRouter>
  )
}
