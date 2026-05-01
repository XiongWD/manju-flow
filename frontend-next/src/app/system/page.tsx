'use client';

import { useEffect, useState, useCallback } from 'react';
import { apiClient, type ManagerRead } from '@/lib/api-client';

export default function SystemPage() {
  const [managers, setManagers] = useState<ManagerRead[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ email: '', password: '', display_name: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiClient.systemGetManagers();
      setManagers(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const createManager = async () => {
    if (!form.email || !form.password) { setError('邮箱和密码不能为空'); return; }
    setSubmitting(true);
    setError('');
    try {
      await apiClient.systemCreateManager(form);
      setShowCreate(false);
      setForm({ email: '', password: '', display_name: '' });
      load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '创建失败');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleStatus = async (id: string, active: boolean) => {
    await apiClient.systemUpdateManagerStatus(id, !active);
    load();
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">经理账号管理</h1>
          <p className="text-sm text-zinc-500 mt-1">管理所有工作区经理账号</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition-colors"
        >
          + 新建经理
        </button>
      </div>

      {/* 创建表单 */}
      {showCreate && (
        <div className="mb-6 p-5 rounded-xl border border-zinc-700 bg-zinc-900">
          <h2 className="text-base font-semibold mb-4">新建经理账号</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <input
              placeholder="邮箱 *"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-violet-500"
            />
            <input
              placeholder="密码 *"
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-violet-500"
            />
            <input
              placeholder="显示名称（可选）"
              value={form.display_name}
              onChange={(e) => setForm({ ...form, display_name: e.target.value })}
              className="rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-violet-500"
            />
          </div>
          {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
          <div className="flex gap-2 mt-3">
            <button
              onClick={createManager}
              disabled={submitting}
              className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm font-medium transition-colors"
            >
              {submitting ? '创建中…' : '创建'}
            </button>
            <button
              onClick={() => { setShowCreate(false); setError(''); }}
              className="px-4 py-2 rounded-lg border border-zinc-700 text-zinc-400 hover:text-zinc-200 text-sm transition-colors"
            >
              取消
            </button>
          </div>
        </div>
      )}

      {/* 列表 */}
      {loading ? (
        <div className="text-center py-12 text-zinc-500 text-sm">加载中…</div>
      ) : managers.length === 0 ? (
        <div className="text-center py-12 text-zinc-500 text-sm">暂无经理账号</div>
      ) : (
        <div className="rounded-xl border border-zinc-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-zinc-900 text-zinc-400 border-b border-zinc-800">
              <tr>
                <th className="text-left px-5 py-3 font-medium">账号</th>
                <th className="text-left px-5 py-3 font-medium">显示名称</th>
                <th className="text-left px-5 py-3 font-medium">工作区</th>
                <th className="text-left px-5 py-3 font-medium">状态</th>
                <th className="text-left px-5 py-3 font-medium">创建时间</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800 bg-zinc-950">
              {managers.map((m) => (
                <tr key={m.id} className="hover:bg-zinc-900/50 transition-colors">
                  <td className="px-5 py-3 text-zinc-200">{m.email}</td>
                  <td className="px-5 py-3 text-zinc-400">{m.display_name ?? '—'}</td>
                  <td className="px-5 py-3 text-zinc-500 font-mono text-xs">{m.workspace_id ?? '—'}</td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${m.is_active ? 'bg-emerald-500/10 text-emerald-400' : 'bg-zinc-700/50 text-zinc-500'}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${m.is_active ? 'bg-emerald-400' : 'bg-zinc-500'}`} />
                      {m.is_active ? '启用' : '禁用'}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-zinc-500 text-xs">{new Date(m.created_at).toLocaleDateString('zh-CN')}</td>
                  <td className="px-5 py-3 text-right">
                    <button
                      onClick={() => toggleStatus(m.id, m.is_active)}
                      className={`text-xs px-3 py-1 rounded-lg border transition-colors ${m.is_active ? 'border-zinc-700 text-zinc-400 hover:text-red-400 hover:border-red-500/50' : 'border-zinc-700 text-zinc-400 hover:text-emerald-400 hover:border-emerald-500/50'}`}
                    >
                      {m.is_active ? '禁用' : '启用'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
