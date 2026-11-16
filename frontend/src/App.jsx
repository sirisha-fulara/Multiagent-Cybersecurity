import { Navigate, Route, Routes } from 'react-router-dom'
import DashboardLayout from './components/DashboardLayout'
import Home from './pages/Home'
import Dashboard from './pages/Dashboard'
import AnalyzeTraffic from './pages/AnalyzeTraffic'
import Alerts from './pages/Alerts'
import Investigation from './pages/Investigation'
import Reports from './pages/Reports'
import AnalysisDetails from './pages/AnalysisDetails'
import ThreatIntelligence from './pages/ThreatIntelligence'
import SystemStatus from './pages/SystemStatus'
import Documentation from './pages/Documentation'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/app" element={<DashboardLayout />}>
        <Route index element={<Dashboard />} />
        <Route path="analyze" element={<AnalyzeTraffic />} />
        <Route path="alerts" element={<Alerts />} />
        <Route path="investigate/:analysisId/:index" element={<Investigation />} />
        <Route path="reports" element={<Reports />} />
        <Route path="reports/:id" element={<AnalysisDetails />} />
        <Route path="threat-intelligence" element={<ThreatIntelligence />} />
        <Route path="system-status" element={<SystemStatus />} />
        <Route path="documentation" element={<Documentation />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
