"use client";

import { useState } from "react";
import GlassSurface from "@/components/ui/primitives/GlassSurface";
import GlassButton from "@/components/ui/primitives/GlassButton";
import GlassChip from "@/components/ui/primitives/GlassChip";
import GlassInput from "@/components/ui/primitives/GlassInput";
import GlassField from "@/components/ui/primitives/GlassField";
import { type PublishJob } from "@/lib/api-client";
import { statusTone, statusLabel, shortId } from "./helpers";

interface PublishJobsPanelProps {
  selectedProjectId: string;
  jobs: PublishJob[];
  loading: boolean;
  onCreateJob: (platform: string) => void;
}

export default function PublishJobsPanel({
  selectedProjectId,
  jobs,
  loading,
  onCreateJob,
}: PublishJobsPanelProps) {
  const [showNewJobForm, setShowNewJobForm] = useState(false);
  const [newJobPlatform, setNewJobPlatform] = useState("");

  const handleCreate = () => {
    if (!newJobPlatform) return;
    onCreateJob(newJobPlatform);
    setNewJobPlatform("");
    setShowNewJobForm(false);
  };

  return (
    <GlassSurface variant="panel">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-zinc-100">发布任务</h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            基于已生成的交付包，创建向各平台的发布任务。当前为任务记录与管理入口，实际平台上传对接依赖后端集成（B站、YouTube、抖音等
            API）。
          </p>
        </div>
        {selectedProjectId && (
          <GlassButton variant="secondary" size="sm" onClick={() => setShowNewJobForm((v) => !v)}>
            {showNewJobForm ? "取消" : "新建发布"}
          </GlassButton>
        )}
      </div>

      {showNewJobForm && (
        <div className="flex items-end gap-3 mb-4 p-3 rounded-lg bg-white/5">
          <GlassField label="目标平台" className="flex-1">
            <GlassInput
              placeholder="例如：bilibili、YouTube、抖音…"
              value={newJobPlatform}
              onChange={(e) => setNewJobPlatform(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            />
          </GlassField>
          <GlassButton variant="primary" size="sm" onClick={handleCreate} disabled={!newJobPlatform}>
            创建
          </GlassButton>
        </div>
      )}

      {!selectedProjectId ? (
        <p className="text-zinc-500 text-sm py-4 text-center">请先选择项目</p>
      ) : loading ? (
        <p className="text-zinc-500 text-sm py-4 text-center">加载中…</p>
      ) : jobs.length === 0 ? (
        <p className="text-zinc-500 text-sm py-4 text-center">暂无发布任务</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-left text-zinc-400">
                <th className="pb-2 pr-4 font-medium">平台</th>
                <th className="pb-2 pr-4 font-medium">状态</th>
                <th className="pb-2 pr-4 font-medium">关联交付包</th>
                <th className="pb-2 pr-4 font-medium">外部链接</th>
                <th className="pb-2 pr-4 font-medium">创建时间</th>
                <th className="pb-2 font-medium">ID</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {jobs.map((job) => (
                <tr key={job.id} className="hover:bg-white/[0.02]">
                  <td className="py-2.5 pr-4 text-zinc-200">{job.platform}</td>
                  <td className="py-2.5 pr-4">
                    <GlassChip tone={statusTone(job.status)}>{statusLabel(job.status)}</GlassChip>
                  </td>
                  <td className="py-2.5 pr-4 text-zinc-400 text-xs font-mono">
                    {job.delivery_package_id ? shortId(job.delivery_package_id) : "—"}
                  </td>
                  <td className="py-2.5 pr-4">
                    {job.external_url ? (
                      <a
                        href={job.external_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:text-blue-300 text-xs truncate max-w-[200px] block"
                      >
                        {job.external_url}
                      </a>
                    ) : (
                      <span className="text-zinc-500">—</span>
                    )}
                  </td>
                  <td className="py-2.5 pr-4 text-zinc-400">
                    {new Date(job.created_at).toLocaleString("zh-CN", {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                  <td className="py-2.5 text-zinc-500 text-xs font-mono">{shortId(job.id)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </GlassSurface>
  );
}
