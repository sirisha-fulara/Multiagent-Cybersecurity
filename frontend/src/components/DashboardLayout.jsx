import { useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'
import Topbar from './Topbar'
import { AppDataProvider } from '../context/AppDataContext'

export default function DashboardLayout() {
  const [menuOpen, setMenuOpen] = useState(false)
  const { pathname } = useLocation()

  // jump back to the top when switching tabs
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  return (
    <AppDataProvider>
      <div className="min-h-screen">
        <Sidebar open={menuOpen} onClose={() => setMenuOpen(false)} />
        <div className="lg:pl-64">
          <Topbar onMenu={() => setMenuOpen(true)} />
          <main className="mx-auto max-w-[1500px] p-4 lg:p-6">
            <Outlet />
          </main>
        </div>
      </div>
    </AppDataProvider>
  )
}
