import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Header } from './Header'

/** 全局布局：Sidebar + Header + Content */
export function AppLayout() {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex flex-1 flex-col pl-[248px]">
        <Header />
        <main className="flex-1 overflow-y-auto px-10 py-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
