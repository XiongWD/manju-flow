'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  FolderKanban,
  Clapperboard,
  Cpu,
  ShieldCheck,
  BookOpen,
  Image,
  Package,
  BarChart3,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface NavItem {
  to: string
  icon: React.ElementType
  name: string
  disabled?: boolean
}

/** 导航项定义（中文显示名） */
const navGroups: { label: string; items: NavItem[] }[] = [
  {
    label: '生产',
    items: [
      { to: '/workspace', icon: LayoutDashboard, name: '仪表盘' },
      { to: '/workspace/projects', icon: FolderKanban, name: '项目' },
      { to: '/workspace/shots', icon: Clapperboard, name: '分镜编辑器' },
      { to: '/workspace/render', icon: Cpu, name: '渲染队列' },
      { to: '/workspace/qa', icon: ShieldCheck, name: 'QA 中心' },
    ],
  },
  {
    label: '管理',
    items: [
      { to: '/workspace/story', icon: BookOpen, name: '故事与角色' },
      { to: '/workspace/assets', icon: Image, name: '资产浏览' },
      { to: '/workspace/delivery', icon: Package, name: '剪辑与交付' },
      { to: '/workspace/analytics', icon: BarChart3, name: '数据分析' },
    ],
  },
  {
    label: '系统',
    items: [{ to: '/workspace/settings', icon: Settings, name: '设置' }],
  },
]

export function Sidebar({ collapsed = false, onToggle, mobile = false }: { collapsed?: boolean; onToggle?: () => void; mobile?: boolean }) {
  const pathname = usePathname()

  return (
    <aside className={`relative fixed left-0 top-0 flex h-screen flex-col transition-all duration-200 ${mobile ? 'z-50 w-[280px]' : collapsed ? 'z-30 w-[84px]' : 'z-30 w-[248px]'}`}>
      {/* 右边渐变分割线 — 不用 border-r */}
      <div className="pointer-events-none absolute right-0 top-0 h-full w-px bg-gradient-to-b from-white/[0.06] via-white/[0.03] to-transparent" />

      {/* ── Logo 区 — 产品级标题感 ── */}
      <div className={`flex flex-col gap-1 pt-7 pb-2 ${collapsed ? 'px-3' : 'px-6'}`}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center">
            <span
              className="block h-2.5 w-2.5 rounded-full bg-primary"
              style={{
                boxShadow: '0 0 6px 1px rgba(124, 58, 237, 0.5)',
              }}
            />
          </div>
          {!collapsed && (
            <span className="font-display text-[18px] font-semibold tracking-[-0.02em] text-white">
              ArcLine 工作台
            </span>
          )}
          </div>
          <button onClick={onToggle} className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.04] text-white/50 shadow-[0_6px_20px_rgba(0,0,0,0.18)] hover:bg-white/[0.08] hover:text-white/85">
            {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </button>
        </div>
        {!collapsed && (
          <span className="pl-[34px] text-[11px] font-medium uppercase tracking-[0.14em] text-white/30">
            创作工作台
          </span>
        )}
      </div>

      {/* ── 分割线 ── */}
      <div className="mx-4 my-3 h-px bg-white/[0.06]" />

      {/* ── 导航列表 ── */}
      <nav className="flex-1 overflow-y-auto px-3 py-2">
        {navGroups.map((group) => (
          <div key={group.label} className="mb-5">
            {!collapsed && (
              <div className="mb-3 px-3 text-[11px] font-medium tracking-[0.16em] text-white/18">
                {group.label}
              </div>
            )}
            {group.items.map((item) => {
              const Icon = item.icon
              const isActive = item.to === '/workspace'
                ? pathname === '/workspace'
                : pathname.startsWith(item.to)

              /* 禁用项 — 未开放感，不是坏掉感 */
              if (item.disabled) {
                return (
                  <div
                    key={item.name}
                    className={`flex items-center rounded-lg px-3 py-2.5 text-[14px] text-white/25 cursor-not-allowed ${collapsed ? 'justify-center' : 'gap-3.5'}`}
                    title={item.name}
                  >
                    <Icon className="h-[18px] w-[18px] opacity-60" />
                    {!collapsed && <span>{item.name}</span>}
                    {!collapsed && <span className="ml-auto text-[10px] font-medium uppercase tracking-wider text-white/15">
                      即将
                    </span>}
                  </div>
                )
              }
              return (
                <Link
                  key={`${group.label}-${item.name}-${item.to}`}
                  href={item.to}
                  className={cn(
                    `flex items-center rounded-lg px-3 py-2.5 text-[14px] transition-all duration-200 ease-out relative ${collapsed ? 'justify-center' : 'gap-3.5'}`,
                    isActive
                      ? 'text-white font-medium bg-white/[0.06]'
                      : 'text-white/50 hover:bg-white/[0.03] hover:text-white/80',
                  )}
                  title={item.name}
                >
                  {/* 激活态左边线 */}
                  {isActive && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 h-4 w-[3px] rounded-r-full bg-primary" />
                  )}
                  <Icon className="h-[18px] w-[18px]" />
                  {!collapsed && <span>{item.name}</span>}
                </Link>
              )
            })}
          </div>
        ))}
      </nav>

      {/* ── 底部版本区 ── */}
      {!collapsed && (
        <div className="mx-4 mt-auto border-t border-white/[0.06] px-4 py-3">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[11px] text-[#767D88]">
              v0.1.0
            </span>
            <span className="text-[11px] text-white/15">
              工作台
            </span>
          </div>
        </div>
      )}
    </aside>
  )
}
