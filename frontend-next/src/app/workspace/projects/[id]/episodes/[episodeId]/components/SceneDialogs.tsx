"use client";

import { GlassSurface, GlassChip, GlassButton, GlassField, GlassInput } from "@/components/ui/primitives";
import { Scene, SceneVersion, SceneReworkResponse, SwitchLockedVersionResponse, VersionDiffResponse, JobDetail } from "@/lib/api-client";
import { getStatusTone, getJobStatusText, formatDateTime } from "./utils";
import { VersionStatusBadge, TaskStatusMini } from "./badges";

// ─── Props ────────────────────────────────────────────────────────
interface SceneDialogsProps {
  // Edit
  editingScene: Scene | null;
  setEditingScene: (s: Scene | null) => void;
  editForm: { title: string; duration: string; status: string };
  setEditForm: (f: { title: string; duration: string; status: string }) => void;
  editSubmitting: boolean;
  editError: string | null;
  handleEditSubmit: () => void;
  // Delete
  deletingScene: Scene | null;
  setDeletingScene: (s: Scene | null) => void;
  deleteSubmitting: boolean;
  deleteError: string | null;
  handleDeleteConfirm: () => void;
  // Retry
  retryingScene: Scene | null;
  setRetryingScene: (s: Scene | null) => void;
  retrySubmitting: boolean;
  retryError: string | null;
  retrySuccess: { job_id: string; status: string; message: string } | null;
  setRetrySuccess: (v: { job_id: string; status: string; message: string } | null) => void;
  handleRetryConfirm: () => void;
  // Lock
  lockingScene: Scene | null;
  setLockingScene: (s: Scene | null) => void;
  lockSubmitting: boolean;
  lockError: string | null;
  lockSuccess: boolean;
  setLockSuccess: (v: boolean) => void;
  handleLockVersionConfirm: () => void;
  // Rework
  reworkingVersion: SceneVersion | null;
  setReworkingVersion: (v: SceneVersion | null) => void;
  reworkReason: string;
  setReworkReason: (r: string) => void;
  reworkSubmitting: boolean;
  reworkError: string | null;
  reworkSuccess: SceneReworkResponse | null;
  setReworkSuccess: (v: SceneReworkResponse | null) => void;
  handleReworkConfirm: () => void;
  previewingScene: Scene | null;
  // Switch Locked
  switchingLocked: Scene | null;
  setSwitchingLocked: (s: Scene | null) => void;
  switchSubmitting: boolean;
  switchError: string | null;
  switchSuccess: SwitchLockedVersionResponse | null;
  setSwitchSuccess: (v: SwitchLockedVersionResponse | null) => void;
  handleSwitchLockedConfirm: () => void;
  // Diff
  diffMode: boolean;
  diffVersionAId: string | null;
  setDiffVersionAId: (id: string | null) => void;
  diffVersionBId: string | null;
  setDiffVersionBId: (id: string | null) => void;
  versionDiff: VersionDiffResponse | null;
  loadingDiff: boolean;
  diffError: string | null;
  handleDiffRun: () => void;
  sceneVersions: SceneVersion[] | null;
  // Job Detail
  viewingJob: JobDetail | null;
  setViewingJob: (j: JobDetail | null) => void;
  loadingJob: boolean;
  jobError: string | null;
  handleRefreshJobDetail: () => void;
  handleViewJob: (id: string) => void;
  // Shared
  selectedVersion: SceneVersion | null;
}

// ─── Component ───────────────────────────────────────────────────
export function SceneDialogs({
  editingScene, setEditingScene, editForm, setEditForm, editSubmitting, editError, handleEditSubmit,
  deletingScene, setDeletingScene, deleteSubmitting, deleteError, handleDeleteConfirm,
  retryingScene, setRetryingScene, retrySubmitting, retryError, retrySuccess, setRetrySuccess, handleRetryConfirm,
  lockingScene, setLockingScene, lockSubmitting, lockError, lockSuccess, setLockSuccess, handleLockVersionConfirm,
  reworkingVersion, setReworkingVersion, reworkReason, setReworkReason, reworkSubmitting, reworkError, reworkSuccess, setReworkSuccess, handleReworkConfirm, previewingScene,
  switchingLocked, setSwitchingLocked, switchSubmitting, switchError, switchSuccess, setSwitchSuccess, handleSwitchLockedConfirm,
  diffMode, diffVersionAId, setDiffVersionAId, diffVersionBId, setDiffVersionBId, versionDiff, loadingDiff, diffError, handleDiffRun, sceneVersions,
  viewingJob, setViewingJob, loadingJob, jobError, handleRefreshJobDetail, handleViewJob,
  selectedVersion,
}: SceneDialogsProps) {

  // ── 任务进度（Job Detail 内联） ─────────────────────────────────
  const renderStepProgress = () => {
    if (!viewingJob || !viewingJob.steps || viewingJob.steps.length === 0) return null;
    const steps = viewingJob.steps;
    const completedSteps = steps.filter(s => s.status === 'SUCCESS' || s.status === 'completed').length;
    const runningStep = steps.find(s => s.status === 'RUNNING' || s.status === 'running');
    const failedStep = steps.find(s => s.status === 'FAILED' || s.status === 'failed');
    const progress = (completedSteps / steps.length) * 100;
    return (
      <GlassSurface variant="panel" className="p-4">
        <div className="text-xs text-zinc-500 mb-3 font-medium">任务进度</div>
        <div className="mb-3">
          <div className="flex items-center justify-between text-xs text-zinc-500 mb-1">
            <span>已完成 {completedSteps} / {steps.length} 步</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${failedStep ? 'bg-red-500' : runningStep ? 'bg-blue-500' : 'bg-green-500'}`}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
        <div className="space-y-2">
          {steps.map((step) => {
            const stepStatus = (step.status?.toUpperCase() || step.status) as string;
            const stepTone = getStatusTone(stepStatus) as 'neutral' | 'info' | 'success' | 'warning' | 'danger';
            const isCurrentStep = runningStep?.id === step.id;
            const isFailedStep = failedStep?.id === step.id;
            return (
              <div key={step.id} className={`flex items-center gap-3 p-2 rounded transition-colors ${isCurrentStep ? 'bg-blue-600/20 border border-blue-600/50' : isFailedStep ? 'bg-red-600/20 border border-red-600/50' : 'bg-zinc-800/50'}`}>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${stepStatus === 'SUCCESS' || stepStatus === 'completed' ? 'bg-green-600 text-white' : stepStatus === 'RUNNING' || stepStatus === 'running' ? 'bg-blue-600 text-white' : stepStatus === 'FAILED' || stepStatus === 'failed' ? 'bg-red-600 text-white' : 'bg-zinc-700 text-zinc-400'}`}>
                  {steps.indexOf(step) + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-zinc-300 truncate">{step.step_key ?? step.tool_name ?? step.id.slice(0, 8)}</span>
                    <GlassChip tone={stepTone} className="text-xs">{getJobStatusText(stepStatus)}</GlassChip>
                  </div>
                  {step.error_message && <div className="text-xs text-red-400 mt-1 truncate">{step.error_message}</div>}
                  {step.output_json ? <div className="text-xs text-zinc-500 mt-1 truncate">输出：{JSON.stringify(step.output_json)}</div> : null}
                </div>
              </div>
            );
          })}
        </div>
      </GlassSurface>
    );
  };

  return (
    <>
      {/* ── Edit Modal ─────────────────────────────────────────── */}
      {editingScene && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setEditingScene(null)}>
          <div className="w-full max-w-md" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
            <GlassSurface variant="modal" className="w-full">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-zinc-100">编辑场景</h3>
                  <p className="text-sm text-zinc-500">第 {editingScene.scene_no} 场</p>
                </div>
                <button onClick={() => setEditingScene(null)} disabled={editSubmitting} className="text-zinc-400 hover:text-zinc-200 transition-colors p-2 disabled:opacity-50">✕</button>
              </div>
              <div className="border-t border-zinc-700 pt-4 space-y-4">
                <GlassField label="标题">
                  <GlassInput value={editForm.title} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} placeholder="场景标题" disabled={editSubmitting} />
                </GlassField>
                <GlassField label="时长（秒）">
                  <GlassInput type="number" step="0.1" value={editForm.duration} onChange={(e) => setEditForm({ ...editForm, duration: e.target.value })} placeholder="例如：5.5" disabled={editSubmitting} />
                </GlassField>
                <GlassField label="状态">
                  <select value={editForm.status} onChange={(e) => setEditForm({ ...editForm, status: e.target.value })} disabled={editSubmitting} className="glass-input-base h-10 px-3 text-sm leading-5 bg-zinc-900 border-zinc-700 text-zinc-100">
                    <option value="DRAFT">草稿 (DRAFT)</option>
                    <option value="READY">就绪 (READY)</option>
                  </select>
                </GlassField>
                {editError && <div className="text-sm text-red-400">{editError}</div>}
                <div className="flex justify-end gap-3 pt-2">
                  <GlassButton variant="secondary" onClick={() => setEditingScene(null)} disabled={editSubmitting}>取消</GlassButton>
                  <GlassButton variant="primary" onClick={handleEditSubmit} loading={editSubmitting}>保存</GlassButton>
                </div>
              </div>
            </GlassSurface>
          </div>
        </div>
      )}

      {/* ── Delete Modal ───────────────────────────────────────── */}
      {deletingScene && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setDeletingScene(null)}>
          <div className="w-full max-w-md" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
            <GlassSurface variant="modal" className="w-full">
              <div className="mb-4">
                <h3 className="text-lg font-semibold text-zinc-100">确认删除</h3>
                <p className="text-sm text-zinc-500 mt-2">确定要删除以下场景吗？</p>
                <div className="mt-3 p-3 bg-zinc-800/50 rounded">
                  <p className="text-sm text-zinc-300">第 {deletingScene.scene_no} 场 - {deletingScene.title || `场景 ${deletingScene.scene_no}`}</p>
                  {deletingScene.latest_version && <p className="text-xs text-zinc-500 mt-1">包含版本 {deletingScene.latest_version.version_no}</p>}
                </div>
              </div>
              <div className="border-t border-zinc-700 pt-4 space-y-3">
                {deleteError && <div className="text-sm text-red-400">{deleteError}</div>}
                <div className="flex justify-end gap-3 pt-2">
                  <GlassButton variant="secondary" onClick={() => setDeletingScene(null)} disabled={deleteSubmitting}>取消</GlassButton>
                  <GlassButton variant="danger" onClick={handleDeleteConfirm} loading={deleteSubmitting}>确认删除</GlassButton>
                </div>
              </div>
            </GlassSurface>
          </div>
        </div>
      )}

      {/* ── Retry Modal ────────────────────────────────────────── */}
      {retryingScene && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setRetryingScene(null)}>
          <div className="w-full max-w-md" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
            <GlassSurface variant="modal" className="w-full">
              <div className="mb-4">
                <h3 className="text-lg font-semibold text-zinc-100">确认重跑</h3>
                <p className="text-sm text-zinc-500 mt-2">将为以下场景创建新的生成任务和版本：</p>
                <div className="mt-3 p-3 bg-zinc-800/50 rounded">
                  <p className="text-sm text-zinc-300">第 {retryingScene.scene_no} 场 - {retryingScene.title || `场景 ${retryingScene.scene_no}`}</p>
                  {retryingScene.latest_version && (
                    <p className="text-xs text-zinc-500 mt-1">当前版本 {retryingScene.latest_version.version_no} · 状态：<VersionStatusBadge status={retryingScene.latest_version.status} /></p>
                  )}
                </div>
              </div>
              <div className="border-t border-zinc-700 pt-4 space-y-3">
                {retryError && <div className="text-sm text-red-400">{retryError}</div>}
                <div className="flex justify-end gap-3 pt-2">
                  <GlassButton variant="secondary" onClick={() => setRetryingScene(null)} disabled={retrySubmitting}>取消</GlassButton>
                  <GlassButton variant="primary" onClick={handleRetryConfirm} loading={retrySubmitting}>确认重跑</GlassButton>
                </div>
              </div>
            </GlassSurface>
          </div>
        </div>
      )}

      {/* ── Lock Version Modal ─────────────────────────────────── */}
      {lockingScene && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setLockingScene(null)}>
          <div className="w-full max-w-md" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
            <GlassSurface variant="modal" className="w-full">
              <div className="mb-4">
                <h3 className="text-lg font-semibold text-zinc-100">确认锁定版本</h3>
                <p className="text-sm text-zinc-500 mt-2">将以下场景锁定到当前预览的版本：</p>
                <div className="mt-3 p-3 bg-zinc-800/50 rounded">
                  <p className="text-sm text-zinc-300">第 {lockingScene.scene_no} 场 - {lockingScene.title || `场景 ${lockingScene.scene_no}`}</p>
                  {selectedVersion && <p className="text-xs text-zinc-500 mt-1">锁定到版本 {selectedVersion.version_no} · 状态：<VersionStatusBadge status={selectedVersion.status} /></p>}
                </div>
                {lockingScene.locked_version_id && <p className="text-xs text-orange-400 mt-2">⚠️ 当前已锁定到版本，锁定后将替换为选中的版本</p>}
              </div>
              <div className="border-t border-zinc-700 pt-4 space-y-3">
                {lockError && <div className="text-sm text-red-400">{lockError}</div>}
                <div className="flex justify-end gap-3 pt-2">
                  <GlassButton variant="secondary" onClick={() => setLockingScene(null)} disabled={lockSubmitting}>取消</GlassButton>
                  <GlassButton variant="primary" onClick={handleLockVersionConfirm} loading={lockSubmitting}>确认锁定</GlassButton>
                </div>
              </div>
            </GlassSurface>
          </div>
        </div>
      )}

      {/* ── Lock Success Toast ─────────────────────────────────── */}
      {lockSuccess && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-4">
          <GlassSurface variant="elevated" className="p-4 flex items-center gap-3">
            <GlassChip tone="success">✓</GlassChip>
            <div className="flex flex-col">
              <span className="text-sm font-medium text-zinc-100">版本锁定成功</span>
              <span className="text-xs text-zinc-500">场景已更新，页面将刷新</span>
            </div>
          </GlassSurface>
        </div>
      )}

      {/* ── Retry Success Toast ────────────────────────────────── */}
      {retrySuccess && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-4">
          <GlassSurface variant="elevated" className="p-4 flex items-center gap-3">
            <GlassChip tone="success">✓</GlassChip>
            <div className="flex flex-col flex-1">
              <span className="text-sm font-medium text-zinc-100">{retrySuccess.message}</span>
              <span className="text-xs text-zinc-500">任务 ID：{retrySuccess.job_id} · 状态：{retrySuccess.status}</span>
            </div>
            <button onClick={() => handleViewJob(retrySuccess.job_id)} className="text-xs px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 text-white rounded transition-colors">查看任务</button>
          </GlassSurface>
        </div>
      )}

      {/* ── Diff Panel ─────────────────────────────────────────── */}
      {diffMode && selectedVersion && sceneVersions && sceneVersions.length >= 2 && (
        <GlassSurface variant="panel" className="p-4 mt-4">
          <div className="text-xs text-zinc-500 mb-3 font-medium">版本对比</div>
          <div className="flex flex-wrap items-center gap-3 mb-3">
            <select value={diffVersionAId || ''} onChange={(e) => setDiffVersionAId(e.target.value)} className="bg-zinc-800 border border-zinc-700 text-zinc-200 text-xs rounded px-2 py-1.5">
              {sceneVersions.map((v) => <option key={v.id} value={v.id}>v{v.version_no} ({v.status})</option>)}
            </select>
            <span className="text-xs text-zinc-500">vs</span>
            <select value={diffVersionBId || ''} onChange={(e) => setDiffVersionBId(e.target.value)} className="bg-zinc-800 border border-zinc-700 text-zinc-200 text-xs rounded px-2 py-1.5">
              {sceneVersions.map((v) => <option key={v.id} value={v.id}>v{v.version_no} ({v.status})</option>)}
            </select>
            <button onClick={handleDiffRun} disabled={!diffVersionAId || !diffVersionBId || diffVersionAId === diffVersionBId || loadingDiff} className="text-xs px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
              {loadingDiff ? '对比中...' : '运行对比'}
            </button>
          </div>
          {diffError && <div className="text-xs text-red-400 mb-2">{diffError}</div>}
          {versionDiff && (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              <div className="text-xs text-zinc-400 mb-1">变更字段 ({versionDiff.changed_fields.length})</div>
              {versionDiff.diffs.filter(d => d.changed).map((d) => (
                <div key={d.field} className="rounded bg-zinc-900/60 p-2 text-xs">
                  <div className="text-zinc-300 font-medium mb-1">{d.label}</div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <div className="text-zinc-500">v{versionDiff.version_a.version_no}</div>
                      <div className="text-zinc-400 break-all max-h-20 overflow-y-auto">{typeof d.value_a === 'object' ? JSON.stringify(d.value_a) : String(d.value_a ?? '—')}</div>
                    </div>
                    <div>
                      <div className="text-zinc-500">v{versionDiff.version_b.version_no}</div>
                      <div className="text-zinc-400 break-all max-h-20 overflow-y-auto">{typeof d.value_b === 'object' ? JSON.stringify(d.value_b) : String(d.value_b ?? '—')}</div>
                    </div>
                  </div>
                </div>
              ))}
              {versionDiff.changed_fields.length === 0 && <div className="text-xs text-zinc-500">两个版本无差异</div>}
            </div>
          )}
        </GlassSurface>
      )}

      {/* ── Rework Modal ───────────────────────────────────────── */}
      {reworkingVersion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setReworkingVersion(null)}>
          <div className="w-full max-w-md" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
            <GlassSurface variant="modal" className="w-full">
              <div className="mb-4">
                <h3 className="text-lg font-semibold text-zinc-100">局部返修</h3>
                <p className="text-sm text-zinc-500 mt-2">基于版本 v{reworkingVersion.version_no} 创建新版本：</p>
                <div className="mt-3 p-3 bg-zinc-800/50 rounded">
                  <p className="text-sm text-zinc-300">{previewingScene?.title || `场景 ${previewingScene?.scene_no}`} · 版本 {reworkingVersion.version_no}</p>
                  <p className="text-xs text-zinc-500 mt-1">状态：<VersionStatusBadge status={reworkingVersion.status} /></p>
                </div>
              </div>
              <div className="border-t border-zinc-700 pt-4 space-y-3">
                <GlassField label="返修原因">
                  <GlassInput value={reworkReason} onChange={(e) => setReworkReason(e.target.value)} placeholder="例如：角色面部不一致，需要修正" disabled={reworkSubmitting} />
                </GlassField>
                {reworkError && <div className="text-sm text-red-400">{reworkError}</div>}
                <div className="flex justify-end gap-3 pt-2">
                  <GlassButton variant="secondary" onClick={() => setReworkingVersion(null)} disabled={reworkSubmitting}>取消</GlassButton>
                  <GlassButton variant="primary" onClick={handleReworkConfirm} loading={reworkSubmitting} disabled={!reworkReason.trim()}>确认返修</GlassButton>
                </div>
              </div>
            </GlassSurface>
          </div>
        </div>
      )}

      {/* ── Switch Locked Modal ────────────────────────────────── */}
      {switchingLocked && selectedVersion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setSwitchingLocked(null)}>
          <div className="w-full max-w-md" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
            <GlassSurface variant="modal" className="w-full">
              <div className="mb-4">
                <h3 className="text-lg font-semibold text-zinc-100">切换锁定版本</h3>
                <p className="text-sm text-zinc-500 mt-2">将锁定版本从当前切换到版本 {selectedVersion.version_no}：</p>
                <div className="mt-3 p-3 bg-zinc-800/50 rounded">
                  <p className="text-sm text-zinc-300">{switchingLocked.title || `场景 ${switchingLocked.scene_no}`} · v{selectedVersion.version_no}</p>
                  <p className="text-xs text-orange-400 mt-1">⚠️ 此操作将强制替换当前锁定版本</p>
                </div>
              </div>
              <div className="border-t border-zinc-700 pt-4 space-y-3">
                {switchError && <div className="text-sm text-red-400">{switchError}</div>}
                <div className="flex justify-end gap-3 pt-2">
                  <GlassButton variant="secondary" onClick={() => setSwitchingLocked(null)} disabled={switchSubmitting}>取消</GlassButton>
                  <GlassButton variant="primary" onClick={handleSwitchLockedConfirm} loading={switchSubmitting}>确认切换</GlassButton>
                </div>
              </div>
            </GlassSurface>
          </div>
        </div>
      )}

      {/* ── Rework Success Toast ───────────────────────────────── */}
      {reworkSuccess && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-4">
          <GlassSurface variant="elevated" className="p-4 flex items-center gap-3">
            <GlassChip tone="success">✓</GlassChip>
            <div className="flex flex-col flex-1">
              <span className="text-sm font-medium text-zinc-100">{reworkSuccess.message}</span>
              <span className="text-xs text-zinc-500">新版本 ID：{reworkSuccess.scene_version_id?.slice(0, 8)} · 任务 ID：{reworkSuccess.job_id.slice(0, 8)}</span>
            </div>
            <button onClick={() => handleViewJob(reworkSuccess.job_id)} className="text-xs px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 text-white rounded transition-colors">查看任务</button>
          </GlassSurface>
        </div>
      )}

      {/* ── Switch Success Toast ───────────────────────────────── */}
      {switchSuccess && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-4">
          <GlassSurface variant="elevated" className="p-4 flex items-center gap-3">
            <GlassChip tone="success">✓</GlassChip>
            <div className="flex flex-col">
              <span className="text-sm font-medium text-zinc-100">锁定版本已切换</span>
              <span className="text-xs text-zinc-500">新锁定：{switchSuccess.locked_version_id.slice(0, 8)}</span>
            </div>
          </GlassSurface>
        </div>
      )}

      {/* ── Job Detail Modal ───────────────────────────────────── */}
      {viewingJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setViewingJob(null)}>
          <div className="w-full max-w-2xl max-h-[80vh]" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
            <GlassSurface variant="modal" className="w-full">
              <div className="flex items-center justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-zinc-100">任务详情</h3>
                  <p className="text-sm text-zinc-500">任务 ID：{viewingJob.id}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={handleRefreshJobDetail} disabled={loadingJob} className="text-xs px-2 py-1 bg-zinc-700 hover:bg-zinc-600 text-white rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed" title="刷新任务详情">
                    {loadingJob ? '刷新中...' : '↻ 刷新'}
                  </button>
                  <button onClick={() => setViewingJob(null)} className="text-zinc-400 hover:text-zinc-200 transition-colors p-2">✕</button>
                </div>
              </div>
              <div className="border-t border-zinc-700 pt-4 space-y-4 max-h-[60vh] overflow-y-auto">
                {renderStepProgress()}
                <GlassSurface variant="panel" className="p-4">
                  <div className="text-xs text-zinc-500 mb-3 font-medium">基本信息</div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="flex flex-col"><span className="text-zinc-500 text-xs">状态</span><TaskStatusMini status={viewingJob.status} latestProgress={viewingJob.latest_progress} /></div>
                    <div className="flex flex-col"><span className="text-zinc-500 text-xs">任务类型</span><span className="text-zinc-300">{viewingJob.job_type}</span></div>
                    <div className="flex flex-col"><span className="text-zinc-500 text-xs">目标类型</span><span className="text-zinc-300">{viewingJob.target_type}</span></div>
                    <div className="flex flex-col"><span className="text-zinc-500 text-xs">Worker</span><span className="text-zinc-300">{viewingJob.worker_type}</span></div>
                    <div className="flex flex-col"><span className="text-zinc-500 text-xs">重试次数</span><span className="text-zinc-300">{viewingJob.retry_count}</span></div>
                    <div className="flex flex-col"><span className="text-zinc-500 text-xs">实际成本</span><span className="text-zinc-300">{viewingJob.cost_actual != null ? `¥${viewingJob.cost_actual.toFixed(2)}` : '-'}</span></div>
                    <div className="flex flex-col col-span-2"><span className="text-zinc-500 text-xs">创建时间</span><span className="text-zinc-300">{formatDateTime(viewingJob.created_at)}</span></div>
                    <div className="flex flex-col col-span-2"><span className="text-zinc-500 text-xs">开始时间</span><span className="text-zinc-300">{formatDateTime(viewingJob.started_at)}</span></div>
                    <div className="flex flex-col col-span-2"><span className="text-zinc-500 text-xs">完成时间</span><span className="text-zinc-300">{formatDateTime(viewingJob.finished_at)}</span></div>
                    {viewingJob.error_message && (
                      <div className="flex flex-col col-span-2 mt-2">
                        <span className="text-red-400 text-xs">错误信息</span>
                        <span className="text-red-300 text-sm break-all">{viewingJob.error_message}</span>
                      </div>
                    )}
                  </div>
                </GlassSurface>
                {jobError && <div className="text-sm text-red-400 text-center">{jobError}</div>}
              </div>
            </GlassSurface>
          </div>
        </div>
      )}
    </>
  );
}
