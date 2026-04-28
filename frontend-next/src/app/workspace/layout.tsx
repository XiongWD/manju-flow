'use client';

import { useState } from 'react';
import { Sidebar } from '@/components/workspace/Sidebar';

export default function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  return (
    <div className="flex min-h-screen bg-zinc-950">
      {/* Sidebar */}
      <Sidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed((v) => !v)} />

      {/* Main content */}
      <main className={`flex-1 flex flex-col transition-all duration-200 ${sidebarCollapsed ? 'ml-[84px]' : 'ml-[248px]'}`}>
        {/* Top bar */}
        <header className="h-14 border-b border-zinc-800 bg-zinc-950/50 flex items-center justify-between px-6">
          <h1 className="text-lg font-semibold text-zinc-100">创作工作区</h1>
          <div className="flex items-center gap-4">
            <div className="h-8 w-8 rounded-full bg-zinc-800 flex items-center justify-center">
              <span className="text-sm text-zinc-400">U</span>
            </div>
          </div>
        </header>

        {/* Page content */}
        <div className="flex-1 overflow-auto">{children}</div>
      </main>
    </div>
  );
}
