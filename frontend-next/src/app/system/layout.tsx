'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient, UserRead } from '@/lib/api-client';

export default function SystemLayout({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserRead | null>(null);
  const [checking, setChecking] = useState(true);
  const router = useRouter();

  useEffect(() => {
    apiClient.getMe()
      .then((u) => {
        if (u.role !== 'superadmin') {
          router.replace('/workspace');
          return;
        }
        setUser(u);
        setChecking(false);
      })
      .catch(() => router.replace('/login'));
  }, [router]);

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950">
        <span className="text-sm text-zinc-500">加载中…</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* 顶部导航栏 */}
      <header className="h-14 border-b border-zinc-800 bg-zinc-950/80 flex items-center justify-between px-6">
        <div className="flex items-center gap-4">
          <span className="font-semibold text-lg">ArcLine · 系统管理</span>
          <nav className="flex items-center gap-1">
            <a href="/system" className="px-3 py-1.5 rounded-lg text-sm text-zinc-400 hover:text-white hover:bg-white/[0.05] transition-colors">
              管理员概览
            </a>
          </nav>
        </div>
        <div className="flex items-center gap-4">
          {user && (
            <span className="text-sm text-zinc-500">{user.display_name ?? user.email}</span>
          )}
          <button
            onClick={() => { apiClient.logout(); router.replace('/login'); }}
            className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            退出
          </button>
        </div>
      </header>
      <main className="p-6">{children}</main>
    </div>
  );
}
