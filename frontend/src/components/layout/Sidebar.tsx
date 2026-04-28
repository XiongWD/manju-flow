import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  FolderKanban,
  BookOpen,
  Clapperboard,
  Cpu,
  ShieldCheck,
  Image,
  Package,
  BarChart3,
  Settings,
} from 'lucide-react'
import { cn } from '@/lib/utils'

/** 导航项定义（中文显示名） */
const navGroups = [
  {
    label: '生产',
    items: [
      { to: '/', icon: LayoutDashboard, name: '仪表盘' },
      { to: '/projects', icon: FolderKanban, name: '项目' },
      { to: '#', icon: Clapperboard, name: '分镜编辑器', disabled: true },
      { to: '/render', icon: Cpu, name: '渲染队列' },
      { to: '/qa', icon: ShieldCheck, name: 'QA 中心' },
    ],
  },
  {
    label: '管理',
    items: [
      { to: '#', icon: BookOpen, name: '故事与角色', disabled: true },
      { to: '/assets', icon: Image, name: '资产浏览' },
      { to: '/delivery', icon: Package, name: '剪辑与交付' },
      { to: '/analytics', icon: BarChart3, name: '数据分析' },
    ],
  },
  {
    label: '系统',
    items: [{ to: '/settings', icon: Settings, name: '设置' }],
  },
]

export function Sidebar() {
  return (
    <aside className="relative fixed left-0 top-0 z-30 flex h-screen w-[248px] flex-col">
      {/* 右边渐变分割线 — 不用 border-r */}
      <div className="pointer-events-none absolute right-0 top-0 h-full w-px bg-gradient-to-b from-white/[0.06] via-white/[0.03] to-transparent" />

      {/* ── Logo 区 — 产品级标题感 ── */}
      <div className="flex flex-col gap-1 px-6 pt-7 pb-2">
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center">
            <span
              className="block h-2.5 w-2.5 rounded-full bg-primary"
              style={{
                boxShadow: '0 0 6px 1px rgba(124, 58, 237, 0.5)',
              }}
            />
          </div>
          <span className="font-display text-[20px] font-semibold tracking-[-0.02em] text-white">
            漫剧 OS
          </span>
        </div>
        <span className="pl-[34px] text-[11px] font-medium uppercase tracking-[0.14em] text-white/30">
          Production System
        </span>
      </div>

      {/* ── 分割线 ── */}
      <div className="mx-4 my-3 h-px bg-white/[0.06]" />

      {/* ── 导航列表 ── */}
      <nav className="flex-1 overflow-y-auto px-3 py-2">
        {navGroups.map((group) => (
          <div key={group.label} className="mb-5">
            {/* 分组标题 — 信息分段锚点 */}
            <div className="mb-3 px-3 section-kicker">
              {group.label}
            </div>
            {group.items.map((item) => {
              const Icon = item.icon
              /* 禁用项 — 未开放感，不是坏掉感 */
              if (item.disabled) {
                return (
                  <div
                    key={item.name}
                    className="flex items-center gap-3.5 rounded-lg px-3 py-2.5 text-[14px] text-white/25 cursor-not-allowed"
                  >
                    <Icon className="h-[18px] w-[18px] opacity-60" />
                    <span>{item.name}</span>
                    <span className="ml-auto text-[10px] font-medium uppercase tracking-wider text-white/15">
                      即将
                    </span>
                  </div>
                )
              }
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/' || item.to === '/projects'}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-3.5 rounded-lg px-3 py-2.5 text-[14px] transition-all duration-200 ease-out relative',
                      isActive
                        ? 'text-white font-medium bg-white/[0.06]'
                        : 'text-white/50 hover:bg-white/[0.03] hover:text-white/80',
                    )
                  }
                >
                  {/* 激活态左边线 */}
                  {({ isActive }) => (
                    <>
                      {isActive && (
                        <span className="absolute left-0 top-1/2 -translate-y-1/2 h-4 w-[3px] rounded-r-full bg-primary" />
                      )}
                      <Icon className="h-[18px] w-[18px]" />
                      <span>{item.name}</span>
                    </>
                  )}
                </NavLink>
              )
            })}
          </div>
        ))}
      </nav>

      {/* ── 底部版本区 ── */}
      <div className="mx-4 mt-auto border-t border-white/[0.06] px-4 py-3">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[11px] text-[#767D88]">
            v0.4.0
          </span>
          <span className="text-[11px] text-white/15">
            ArcLine
          </span>
        </div>
      </div>
    </aside>
  )
}
