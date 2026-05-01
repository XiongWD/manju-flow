'use client';

import { useEffect, useState, useCallback } from 'react';
import { apiClient, type MemberRead } from '@/lib/api-client';

const ALL_PAGES = [
  { path: '/workspace', label: '仪表盘' },
  { path: '/workspace/projects', label: '项目' },
  { path: '/workspace/shots', label: '分镜编辑器' },
  { path: '/workspace/render', label: '渲染队列' },
  { path: '/workspace/qa', label: 'QA 中心' },
  { path: '/workspace/story', label: '故事与角色' },
  { path: '/workspace/assets', label: '资产浏览' },
  { path: '/workspace/delivery', label: '剪辑与交付' },
  { path: '/workspace/analytics', label: '数据分析' },
  { path: '/workspace/settings', label: '设置' },
];

export default function TeamPage() {
  const [members, setMembers] = useState<MemberRead[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteForm, setInviteForm] = useState({ email: '', password: '', display_name: '', page_permissions: [] as string[] });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [editingMember, setEditingMember] = useState<string | null>(null);
  const [editPerms, setEditPerms] = useState<string[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiClient.workspaceGetMembers();
      setMembers(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const inviteMember = async () => {
    if (!inviteForm.email || !inviteForm.password) { setError('邮箱和密码不能为空'); return; }
    setSubmitting(true);
    setError('');
    try {
      await apiClient.workspaceInviteMember(inviteForm);
      setShowInvite(false);
      setInviteForm({ email: '', password: '', display_name: '', page_permissions: [] });
      load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '邀请失败');
    } finally {
      setSubmitting(false);
    }
  };

  const removeMember = async (uid: string) => {
    if (!confirm('确认移除该成员？')) return;
    await apiClient.workspaceRemoveMember(uid);
    load();
  };

  const savePermissions = async (uid: string) => {
    await apiClient.workspaceUpdateMemberPermissions(uid, editPerms);
    setEditingMember(null);
    load();
  };

  const togglePerm = (path: string, perms: string[], setPerms: (p: string[]) => void) => {
    setPerms(perms.includes(path) ? perms.filter((p) => p !== path) : [...perms, path]);
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">团队成员</h1>
          <p className="text-sm text-zinc-500 mt-1">管理工作区成员及页面访问权限</p>
        </div>
        <button
          onClick={() => setShowInvite(true)}
          className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition-colors"
        >
          + 邀请成员
        </button>
      </div>

      {/* 邀请表单 */}
      {showInvite && (
        <div className="mb-6 p-5 rounded-xl border border-zinc-700 bg-zinc-900">
          <h2 className="text-base font-semibold mb-4">邀请新成员</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 mb-3">
            <input
              placeholder="邮箱 *"
              value={inviteForm.email}
              onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
              className="rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-violet-500"
            />
            <input
              placeholder="初始密码 *"
              type="password"
              value={inviteForm.password}
              onChange={(e) => setInviteForm({ ...inviteForm, password: e.target.value })}
              className="rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-violet-500"
            />
            <input
              placeholder="显示名称（可选）"
              value={inviteForm.display_name}
              onChange={(e) => setInviteForm({ ...inviteForm, display_name: e.target.value })}
              className="rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-violet-500"
            />
          </div>
          <div className="mb-3">
            <p className="text-xs text-zinc-400 mb-2">页面权限</p>
            <div className="flex flex-wrap gap-2">
              {ALL_PAGES.map((page) => (
                <button
                  key={page.path}
                  onClick={() => togglePerm(page.path, inviteForm.page_permissions, (p) => setInviteForm({ ...inviteForm, page_permissions: p }))}
                  className={`px-2.5 py-1 rounded-md text-xs transition-colors ${inviteForm.page_permissions.includes(page.path) ? 'bg-violet-600/40 border border-violet-500/60 text-violet-300' : 'bg-zinc-800 border border-zinc-700 text-zinc-400 hover:text-zinc-200'}`}
                >
                  {page.label}
                </button>
              ))}
            </div>
          </div>
          {error && <p className="mb-2 text-sm text-red-400">{error}</p>}
          <div className="flex gap-2">
            <button
              onClick={inviteMember}
              disabled={submitting}
              className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm font-medium transition-colors"
            >
              {submitting ? '邀请中…' : '邀请'}
            </button>
            <button
              onClick={() => { setShowInvite(false); setError(''); }}
              className="px-4 py-2 rounded-lg border border-zinc-700 text-zinc-400 hover:text-zinc-200 text-sm transition-colors"
            >
              取消
            </button>
          </div>
        </div>
      )}

      {/* 成员列表 */}
      {loading ? (
        <div className="text-center py-12 text-zinc-500 text-sm">加载中…</div>
      ) : members.length === 0 ? (
        <div className="text-center py-12 text-zinc-500 text-sm">暂无成员，邀请您的第一位成员吧</div>
      ) : (
        <div className="space-y-3">
          {members.map((m) => (
            <div key={m.id} className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-zinc-200">{m.display_name ?? m.email ?? m.user_id}</span>
                    {m.email && m.display_name && (
                      <span className="text-xs text-zinc-500">{m.email}</span>
                    )}
                  </div>
                  {editingMember === m.user_id ? (
                    <div className="mt-3">
                      <p className="text-xs text-zinc-400 mb-2">编辑页面权限</p>
                      <div className="flex flex-wrap gap-2 mb-3">
                        {ALL_PAGES.map((page) => (
                          <button
                            key={page.path}
                            onClick={() => togglePerm(page.path, editPerms, setEditPerms)}
                            className={`px-2.5 py-1 rounded-md text-xs transition-colors ${editPerms.includes(page.path) ? 'bg-violet-600/40 border border-violet-500/60 text-violet-300' : 'bg-zinc-800 border border-zinc-700 text-zinc-400 hover:text-zinc-200'}`}
                          >
                            {page.label}
                          </button>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => savePermissions(m.user_id)}
                          className="px-3 py-1 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs transition-colors"
                        >
                          保存
                        </button>
                        <button
                          onClick={() => setEditingMember(null)}
                          className="px-3 py-1 rounded-lg border border-zinc-700 text-zinc-400 hover:text-zinc-200 text-xs transition-colors"
                        >
                          取消
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {(m.page_permissions ?? []).length === 0 ? (
                        <span className="text-xs text-zinc-600">无页面权限</span>
                      ) : (
                        m.page_permissions.map((p) => {
                          const label = ALL_PAGES.find((pg) => pg.path === p)?.label ?? p;
                          return (
                            <span key={p} className="px-2 py-0.5 rounded-md bg-zinc-800 border border-zinc-700 text-xs text-zinc-400">
                              {label}
                            </span>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
                {editingMember !== m.user_id && (
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => { setEditingMember(m.user_id); setEditPerms(m.page_permissions ?? []); }}
                      className="text-xs px-3 py-1 rounded-lg border border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:border-zinc-600 transition-colors"
                    >
                      编辑权限
                    </button>
                    <button
                      onClick={() => removeMember(m.user_id)}
                      className="text-xs px-3 py-1 rounded-lg border border-zinc-700 text-zinc-400 hover:text-red-400 hover:border-red-500/50 transition-colors"
                    >
                      移除
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
