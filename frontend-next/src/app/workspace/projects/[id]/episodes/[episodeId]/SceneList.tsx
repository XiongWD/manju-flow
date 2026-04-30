"use client";

import { useState } from "react";
import { GlassSurface, GlassChip, GlassButton, GlassField, GlassInput } from "@/components/ui/primitives";
import { apiClient, Scene, Asset, SceneVersion, QARun, QARunDetail, SceneVersionTreeResponse, FallbackHistoryResponse, VersionDiffResponse } from "@/lib/api-client";
import type { SceneReworkResponse, SwitchLockedVersionResponse, SubtitleCue, AudioMixEditResponse } from "@/lib/api-client";

interface SceneListProps {
  scenes: Scene[];
  projectId: string;
  episodeId: string;
  episodeEffectiveTier?: string;
  episodeTierSource?: string;
}

interface PreviewAsset {
  asset: Asset;
  type: "video" | "image" | "audio" | "other";
}

// 状态到 UI tone 的映射
function getStatusTone(status: string | null | undefined): 'neutral' | 'info' | 'success' | 'warning' | 'danger' {
  if (!status) return 'neutral';

  switch (status) {
    // Scene 状态
    case 'DRAFT':
    case 'draft':
      return 'neutral';
    case 'READY':
    case 'ready':
    case 'completed':
      return 'success';

    // SceneVersion 状态
    case 'GENERATING':
    case 'generating':
      return 'warning';
    case 'QA_PASSED':
    case 'qa_passed':
      return 'success';
    case 'LOCKED':
    case 'locked':
      return 'info';
    case 'FAILED':
    case 'failed':
      return 'danger';

    // 默认
    default:
      return 'neutral';
  }
}

// Scene 状态徽章组件
function SceneStatusBadge({ status }: { status: string | null | undefined }) {
  const tone = getStatusTone(status);
  const displayStatus = status || '未知';
  return (
    <GlassChip tone={tone} className="text-xs">
      {displayStatus}
    </GlassChip>
  );
}

// SceneVersion 状态徽章组件
function VersionStatusBadge({ status }: { status: string | null | undefined }) {
  const tone = getStatusTone(status);
  const displayStatus = status || '未知';
  return (
    <GlassChip tone={tone} className="text-xs">
      {displayStatus}
    </GlassChip>
  );
}

// Job 状态到显示文本的映射（中文）
function getJobStatusText(status: string | null | undefined): string {
  if (!status) return '未知';

  const statusMap: Record<string, string> = {
    'PENDING': '等待中',
    'RUNNING': '执行中',
    'SUCCESS': '成功',
    'FAILED': '失败',
    'CANCELLED': '已取消',
    'TIMED_OUT': '超时',
  };

  return statusMap[status] || status;
}

// 任务状态最小展示组件
function TaskStatusMini({ status, latestProgress }: {
  status: string | null | undefined;
  latestProgress?: {
    step: string;
    status: string;
    message: string;
    timestamp: string;
  } | null;
}) {
  const tone = getStatusTone(status);
  const displayStatus = getJobStatusText(status);
  
  // 判断是否正在执行
  const isRunning = status === 'RUNNING';
  
  return (
    <div className="flex items-center gap-2">
      <GlassChip tone={tone} className="text-xs">
        {displayStatus}
      </GlassChip>
      {isRunning && latestProgress && (
        <span className="text-xs text-zinc-500 max-w-[200px] truncate" title={latestProgress.message}>
          {latestProgress.step}: {latestProgress.message}
        </span>
      )}
    </div>
  );
}

// 锁定状态徽章组件
function LockStatusBadge({ 
  isLocked, 
  isCurrentVersionLocked,
  lockedVersionNo 
}: { 
  isLocked: boolean;
  isCurrentVersionLocked: boolean;
  lockedVersionNo?: number;
}) {
  if (!isLocked) return null;
  
  return (
    <GlassChip tone={isCurrentVersionLocked ? 'info' : 'warning'} className="text-xs">
      {isCurrentVersionLocked && lockedVersionNo ? (
        `🔒 锁定 v${lockedVersionNo}`
      ) : (
        '🔒 已锁定其他版本'
      )}
    </GlassChip>
  );
}

export function SceneList({ scenes, projectId, episodeId, episodeEffectiveTier, episodeTierSource }: SceneListProps) {
  const [previewingScene, setPreviewingScene] = useState<Scene | null>(null);
  const [previewAssets, setPreviewAssets] = useState<PreviewAsset[] | null>(null);
  const [loadingAssets, setLoadingAssets] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [sceneVersions, setSceneVersions] = useState<SceneVersion[] | null>(null);
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const [selectedVersion, setSelectedVersion] = useState<SceneVersion | null>(null);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [versionTree, setVersionTree] = useState<SceneVersionTreeResponse | null>(null);
  const [fallbackHistory, setFallbackHistory] = useState<FallbackHistoryResponse | null>(null);
  const [loadingFallbackHistory, setLoadingFallbackHistory] = useState(false);

  // 编辑状态
  const [editingScene, setEditingScene] = useState<Scene | null>(null);
  const [editForm, setEditForm] = useState({
    title: '',
    duration: '',
    status: 'DRAFT'
  });
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // 删除状态
  const [deletingScene, setDeletingScene] = useState<Scene | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // 重跑状态
  const [retryingScene, setRetryingScene] = useState<Scene | null>(null);
  const [retrySubmitting, setRetrySubmitting] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);
  const [retrySuccess, setRetrySuccess] = useState<{ job_id: string; status: string; message: string } | null>(null);

  // 查看 Job 状态
  const [viewingJob, setViewingJob] = useState<{
    id: string;
    project_id: string;
    job_type: string;
    target_type: string;
    target_id: string;
    worker_type: string;
    status: string;
    retry_count: number;
    cost_actual: number | null;
    error_message: string | null;
    created_at: string | null;
    started_at: string | null;
    finished_at: string | null;
    steps?: Array<{
      id: string;
      job_id: string;
      step_order: number;
      step_name: string;
      status: string;
      started_at: string | null;
      finished_at: string | null;
      output_data: unknown | null;
      error_message: string | null;
    }>;
    latest_progress?: {
      step: string;
      status: string;
      message: string;
      timestamp: string;
    };
  } | null>(null);
  const [loadingJob, setLoadingJob] = useState(false);
  const [jobError, setJobError] = useState<string | null>(null);

  // 最近任务状态
  const [recentJobs, setRecentJobs] = useState<{
    id: string;
    status: string;
    created_at: string | null;
    latest_progress?: {
      step: string;
      status: string;
      message: string;
      timestamp: string;
    } | null;
  }[] | null>(null);
  const [loadingRecentJobs, setLoadingRecentJobs] = useState(false);
  const [recentJobsError, setRecentJobsError] = useState<string | null>(null);
  const [refreshingRecentJobs, setRefreshingRecentJobs] = useState(false);

  // 锁定版本状态
  const [lockingScene, setLockingScene] = useState<Scene | null>(null);
  const [lockSubmitting, setLockSubmitting] = useState(false);
  const [lockError, setLockError] = useState<string | null>(null);
  const [lockSuccess, setLockSuccess] = useState(false);

  // 042a: 返修状态
  const [reworkingVersion, setReworkingVersion] = useState<SceneVersion | null>(null);
  const [reworkReason, setReworkReason] = useState('');
  const [reworkSubmitting, setReworkSubmitting] = useState(false);
  const [reworkError, setReworkError] = useState<string | null>(null);
  const [reworkSuccess, setReworkSuccess] = useState<SceneReworkResponse | null>(null);

  // 042a: 版本对比状态
  const [diffMode, setDiffMode] = useState(false);
  const [diffVersionAId, setDiffVersionAId] = useState<string | null>(null);
  const [diffVersionBId, setDiffVersionBId] = useState<string | null>(null);
  const [versionDiff, setVersionDiff] = useState<VersionDiffResponse | null>(null);
  const [loadingDiff, setLoadingDiff] = useState(false);
  const [diffError, setDiffError] = useState<string | null>(null);

  // 042b: 字幕编辑状态
  const [subtitleCues, setSubtitleCues] = useState<SubtitleCue[]>([]);
  const [editingSubtitle, setEditingSubtitle] = useState(false);
  const [subtitleSaving, setSubtitleSaving] = useState(false);
  const [subtitleError, setSubtitleError] = useState<string | null>(null);
  const [loadingSubtitle, setLoadingSubtitle] = useState(false);

  // 042b: 音频混音编辑状态
  const [audioMixData, setAudioMixData] = useState<AudioMixEditResponse | null>(null);
  const [editingAudioMix, setEditingAudioMix] = useState(false);
  const [audioMixForm, setAudioMixForm] = useState({
    voice_volume: 1.0,
    bgm_volume: 0.3,
    bgm_fade_in: 1.0,
    bgm_fade_out: 2.0,
  });
  const [audioMixSaving, setAudioMixSaving] = useState(false);
  const [audioMixError, setAudioMixError] = useState<string | null>(null);
  const [loadingAudioMix, setLoadingAudioMix] = useState(false);

  // 042a: 切换锁定版本状态
  const [switchingLocked, setSwitchingLocked] = useState<Scene | null>(null);
  const [switchSubmitting, setSwitchSubmitting] = useState(false);
  const [switchError, setSwitchError] = useState<string | null>(null);
  const [switchSuccess, setSwitchSuccess] = useState<SwitchLockedVersionResponse | null>(null);

  // QA 状态
  const [versionQARun, setVersionQARun] = useState<QARunDetail | null>(null);
  const [versionQARuns, setVersionQARuns] = useState<QARun[] | null>(null);
  const [loadingQA, setLoadingQA] = useState(false);
  const [refreshingQA, setRefreshingQA] = useState(false);
  const [qaError, setQaError] = useState<string | null>(null);

  const handlePreviewClick = async (scene: Scene) => {
    if (!scene.latest_version) return;

    setPreviewingScene(scene);
    setSceneVersions(null);
    setSelectedVersionId(scene.latest_version.id);
    setSelectedVersion(null);
    setLoadingVersions(true);
    setLoadingAssets(true);
    setLoadingFallbackHistory(true);
    setPreviewError(null);
    setPreviewAssets(null);
    setVersionTree(null);
    setFallbackHistory(null);
    setLoadingRecentJobs(true);
    setRecentJobsError(null);
    setRecentJobs(null);

    try {
      // Fetch version tree for this scene (includes fallback records)
      const tree = await apiClient.getSceneVersionTree(scene.id);
      setVersionTree(tree);

      // Convert tree nodes to version list
      const versions = tree.versions.map(v => ({
        id: v.id,
        scene_id: scene.id,
        parent_version_id: v.parent_version_id,
        version_no: v.version_no,
        status: v.status,
        prompt_bundle: v.prompt_bundle,
        model_bundle: v.model_bundle,
        params: v.params,
        change_reason: v.change_reason,
        score_snapshot: v.score_snapshot,
        cost_actual: v.cost_actual,
        created_at: v.created_at,
        updated_at: v.updated_at,
      }));
      setSceneVersions(versions);

      // Find selected version from list
      const selected = versions.find(v => v.id === scene.latest_version!.id) || versions[0];
      setSelectedVersion(selected);
      setSelectedVersionId(selected.id);

      // Fetch assets for the selected version
      const assets = await apiClient.listAssets({
        owner_type: "scene_version",
        owner_id: selected.id,
      });

      // Convert assets to previewable format
      const previewAssetList: PreviewAsset[] = assets.items.map((asset) => ({
        asset,
        type: determineAssetType(asset),
      }));

      setPreviewAssets(previewAssetList);

      if (previewAssetList.length === 0) {
        setPreviewError("暂无关联资产");
      } else if (!previewAssetList.some((pa) => pa.asset.uri)) {
        setPreviewError("关联资产无可用链接");
      }

      // Fetch fallback history for this scene
      const fallbackHistoryResponse = await apiClient.getSceneFallbackHistory(scene.id);
      setFallbackHistory(fallbackHistoryResponse);

      // Fetch recent jobs for this scene
      const jobsResponse = await apiClient.listJobs({
        target_id: scene.id,
        limit: 3,
      });
      setRecentJobs(jobsResponse.items);

      // Fetch QA run for the selected version
      if (selected.id) {
        setLoadingQA(true);
        setQaError(null);
        try {
          const qaRunsResponse = await apiClient.listQARuns({
            subject_type: 'scene',
            subject_id: selected.id,
            limit: 3,
          });
          setVersionQARuns(qaRunsResponse.items);
          if (qaRunsResponse.items.length > 0) {
            const runId = qaRunsResponse.items[0].id;
            const qaRunDetail = await apiClient.getQARun(runId);
            setVersionQARun(qaRunDetail);
          } else {
            setVersionQARun(null);
          }
        } catch (error) {
          console.error('Failed to load QA data:', error);
          setQaError('加载 QA 数据失败');
        } finally {
          setLoadingQA(false);
        }
      }

      // 042b: 加载字幕 + 音频混音数据
      handleLoadSubtitle();
      handleLoadAudioMix();
    } catch (error) {
      console.error("Failed to load assets:", error);
      setPreviewError("加载资产失败");
    } finally {
      setLoadingVersions(false);
      setLoadingAssets(false);
      setLoadingFallbackHistory(false);
      setLoadingRecentJobs(false);
    }
  };

  const handleVersionChange = async (versionId: string) => {
    if (!sceneVersions || !previewingScene) return;

    const version = sceneVersions.find(v => v.id === versionId);
    if (!version) return;

    setSelectedVersionId(versionId);
    setSelectedVersion(version);
    setLoadingAssets(true);
    setPreviewError(null);
    setPreviewAssets(null);
    setLoadingQA(true);
    setQaError(null);

    try {
      // Fetch assets for the new version
      const assets = await apiClient.listAssets({
        owner_type: "scene_version",
        owner_id: version.id,
      });

      const previewAssetList: PreviewAsset[] = assets.items.map((asset) => ({
        asset,
        type: determineAssetType(asset),
      }));

      setPreviewAssets(previewAssetList);

      if (previewAssetList.length === 0) {
        setPreviewError("暂无关联资产");
      } else if (!previewAssetList.some((pa) => pa.asset.uri)) {
        setPreviewError("关联资产无可用链接");
      }

      // Fetch QA run for the new version
      const qaRunsResponse = await apiClient.listQARuns({
        subject_type: 'scene',
        subject_id: version.id,
        limit: 3,
      });
      setVersionQARuns(qaRunsResponse.items);
      if (qaRunsResponse.items.length > 0) {
        const runId = qaRunsResponse.items[0].id;
        const qaRunDetail = await apiClient.getQARun(runId);
        setVersionQARun(qaRunDetail);
      } else {
        setVersionQARun(null);
      }

      // 042b: 切换版本时重新加载字幕 + 音频混音
      handleLoadSubtitle();
      handleLoadAudioMix();
    } catch (error) {
      console.error("Failed to load assets or QA data:", error);
      setPreviewError("加载资产失败");
      setQaError('加载 QA 数据失败');
    } finally {
      setLoadingAssets(false);
      setLoadingQA(false);
    }
  };

  const handleEditClick = (scene: Scene) => {
    setEditingScene(scene);
    setEditForm({
      title: scene.title || '',
      duration: scene.duration ? scene.duration.toString() : '',
      status: scene.status
    });
    setEditError(null);
  };

  const handleEditSubmit = async () => {
    if (!editingScene) return;

    setEditSubmitting(true);
    setEditError(null);

    try {
      const updateData: {
        title?: string;
        duration?: number;
        status?: string;
      } = {};
      if (editForm.title !== editingScene.title) {
        updateData.title = editForm.title || undefined;
      }
      if (editForm.duration !== (editingScene.duration || '').toString()) {
        updateData.duration = editForm.duration ? parseFloat(editForm.duration) : undefined;
      }
      if (editForm.status !== editingScene.status) {
        updateData.status = editForm.status;
      }

      // 至少有一个字段被修改才提交
      if (Object.keys(updateData).length === 0) {
        setEditingScene(null);
        return;
      }

      await apiClient.updateScene(editingScene.id, updateData);
      setEditingScene(null);
      // 重新加载页面以刷新数据（父组件处理）
      window.location.reload();
    } catch (error: unknown) {
      console.error('Failed to update scene:', error);
      const errorMessage = error instanceof Error ? error.message : '更新失败';
      setEditError(errorMessage);
    } finally {
      setEditSubmitting(false);
    }
  };

  const handleDeleteClick = (scene: Scene) => {
    setDeletingScene(scene);
    setDeleteError(null);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingScene) return;

    setDeleteSubmitting(true);
    setDeleteError(null);

    try {
      await apiClient.deleteScene(deletingScene.id);
      setDeletingScene(null);
      // 重新加载页面以刷新数据
      window.location.reload();
    } catch (error: unknown) {
      console.error('Failed to delete scene:', error);
      const errorMessage = error instanceof Error ? error.message : '删除失败';
      setDeleteError(errorMessage);
    } finally {
      setDeleteSubmitting(false);
    }
  };

  const handleRetryClick = (scene: Scene) => {
    setRetryingScene(scene);
    setRetryError(null);
  };

  const handleRetryConfirm = async () => {
    if (!retryingScene) return;

    setRetrySubmitting(true);
    setRetryError(null);

    try {
      const response = await apiClient.retryScene(retryingScene.id, projectId, episodeId);
      setRetryingScene(null);
      setRetrySuccess(response);
      // 延迟 2 秒后刷新，让用户看到成功提示
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (error: unknown) {
      console.error('Failed to retry scene:', error);
      const errorMessage = error instanceof Error ? error.message : '重跑失败';
      setRetryError(errorMessage);
    } finally {
      setRetrySubmitting(false);
    }
  };

  const handleLockVersionClick = () => {
    if (!previewingScene || !selectedVersion) return;
    setLockingScene(previewingScene);
    setLockError(null);
  };

  const handleLockVersionConfirm = async () => {
    if (!lockingScene || !selectedVersion) return;

    setLockSubmitting(true);
    setLockError(null);

    try {
      await apiClient.lockSceneVersion({
        scene_id: lockingScene.id,
        scene_version_id: selectedVersion.id,
        force: false, // 需要用户确认
      });
      setLockingScene(null);
      setLockSuccess(true);
      // 延迟 2 秒后刷新，让用户看到成功提示
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (error: unknown) {
      console.error('Failed to lock version:', error);
      const errorMessage = error instanceof Error ? error.message : '锁定失败';
      setLockError(errorMessage);
    } finally {
      setLockSubmitting(false);
    }
  };

  const determineAssetType = (asset: Asset): PreviewAsset["type"] => {
    const mime = asset.mime_type?.toLowerCase() || "";
    const type = asset.type?.toLowerCase() || "";

    if (type === "video" || mime.startsWith("video/")) return "video";
    if (type === "image" || mime.startsWith("image/")) return "image";
    if (type === "audio" || mime.startsWith("audio/")) return "audio";
    return "other";
  };

  const renderVersionSelector = () => {
    if (loadingVersions) {
      return (
        <div className="flex items-center justify-center py-4">
          <div className="text-sm text-zinc-500">加载版本列表...</div>
        </div>
      );
    }

    if (!sceneVersions || sceneVersions.length === 0) {
      return (
        <div className="text-sm text-zinc-500 mb-4">
          暂无版本
        </div>
      );
    }

    return (
      <div className="mb-4">
        <div className="text-xs text-zinc-500 mb-2">
          选择版本 ({sceneVersions.length})
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {sceneVersions.map((version) => {
            const isLockedVersion = previewingScene?.locked_version_id === version.id;
            return (
              <div key={version.id} className="flex items-center gap-2">
                <button
                  onClick={() => handleVersionChange(version.id)}
                  disabled={loadingAssets}
                  className={`px-3 py-1.5 rounded text-sm transition-colors ${
                    selectedVersionId === version.id
                      ? isLockedVersion
                        ? "bg-indigo-600 text-white"
                        : "bg-blue-600 text-white"
                      : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                  } ${loadingAssets ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                  {isLockedVersion ? `🔒 v${version.version_no}` : `v${version.version_no}`}
                </button>
                {version.status && (
                  <VersionStatusBadge status={version.status} />
                )}
              </div>
            );
          })}
        </div>
        {selectedVersion && (
          <>
            <div className="mt-2 flex items-center justify-between">
              <div className="text-xs text-zinc-500 flex items-center gap-1">
                当前预览：版本 {selectedVersion.version_no} · 状态：
                <VersionStatusBadge status={selectedVersion.status} />
                {previewingScene?.locked_version_id && (
                  <LockStatusBadge
                    isLocked={!!previewingScene.locked_version_id}
                    isCurrentVersionLocked={previewingScene.locked_version_id === selectedVersion.id}
                    lockedVersionNo={sceneVersions.find(v => v.id === previewingScene.locked_version_id)?.version_no}
                  />
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={handleLockVersionClick}
                  className="text-xs px-2 py-1 bg-zinc-700 hover:bg-zinc-600 text-white rounded transition-colors"
                >
                  🔒 锁定此版本
                </button>
                {previewingScene?.locked_version_id && previewingScene.locked_version_id !== selectedVersion.id && (
                  <button
                    onClick={handleSwitchLockedClick}
                    className="text-xs px-2 py-1 bg-indigo-700 hover:bg-indigo-600 text-white rounded transition-colors"
                  >
                    🔄 切换锁定
                  </button>
                )}
                <button
                  onClick={() => handleReworkClick(selectedVersion)}
                  className="text-xs px-2 py-1 bg-orange-700 hover:bg-orange-600 text-white rounded transition-colors"
                >
                  🔧 返修
                </button>
                {sceneVersions && sceneVersions.length >= 2 && (
                  <button
                    onClick={handleDiffToggle}
                    className={`text-xs px-2 py-1 rounded transition-colors ${diffMode ? 'bg-blue-600 text-white' : 'bg-zinc-700 hover:bg-zinc-600 text-white'}`}
                  >
                    {diffMode ? '📊 对比中' : '📊 对比'}
                  </button>
                )}
              </div>
            </div>

            <GlassSurface variant="panel" className="p-4 mt-4">
              <div className="text-xs text-zinc-500 mb-3 font-medium">版本链总览</div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left text-zinc-300">
                  <thead className="text-zinc-500 border-b border-zinc-800">
                    <tr>
                      <th className="py-2 pr-3">版本</th>
                      <th className="py-2 pr-3">状态</th>
                      <th className="py-2 pr-3">创建时间</th>
                      <th className="py-2 pr-3">变更原因</th>
                      <th className="py-2 pr-3">Tier</th>
                      <th className="py-2 pr-3">Provider Path</th>
                      <th className="py-2 pr-3">成本</th>
                      <th className="py-2 pr-3">锁定</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sceneVersions.map((version) => {
                      const isLockedVersion = previewingScene?.locked_version_id === version.id;
                      const rowProviderPath = [
                        typeof version.model_bundle?.primary_provider === 'string' ? version.model_bundle.primary_provider : null,
                        typeof version.model_bundle?.provider === 'string' ? version.model_bundle.provider : null,
                        typeof version.model_bundle?.fallback_provider === 'string' ? version.model_bundle.fallback_provider : null,
                      ].filter(Boolean).join(' → ');
                      const rowTier = typeof version.model_bundle?.tier === 'string' ? version.model_bundle.tier : '—';

                      return (
                        <tr key={version.id} className={`border-b border-zinc-900/80 ${selectedVersionId === version.id ? 'bg-zinc-900/60' : ''}`}>
                          <td className="py-2 pr-3 font-medium">v{version.version_no}</td>
                          <td className="py-2 pr-3"><VersionStatusBadge status={version.status} /></td>
                          <td className="py-2 pr-3">{formatDateTime(version.created_at ?? null)}</td>
                          <td className="py-2 pr-3 max-w-[220px] break-words">{version.change_reason || '—'}</td>
                          <td className="py-2 pr-3">{rowTier}</td>
                          <td className="py-2 pr-3 max-w-[220px] break-words">{rowProviderPath || '—'}</td>
                          <td className="py-2 pr-3">{version.cost_actual != null ? `¥${version.cost_actual.toFixed(2)}` : '—'}</td>
                          <td className="py-2 pr-3">{isLockedVersion ? '🔒 当前锁定' : '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </GlassSurface>

            <GlassSurface variant="panel" className="p-4 mt-4">
              <div className="text-xs text-zinc-500 mb-3 font-medium">Tier 来源</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <div className="rounded-lg bg-zinc-900/60 p-3">
                  <div className="text-xs text-zinc-500 mb-1">当前生效 Tier</div>
                  <div className="text-zinc-200 font-medium">{episodeEffectiveTier || '—'}</div>
                </div>
                <div className="rounded-lg bg-zinc-900/60 p-3">
                  <div className="text-xs text-zinc-500 mb-1">来源</div>
                  <div className="text-zinc-200 font-medium">{episodeTierSource || '—'}</div>
                </div>
              </div>
            </GlassSurface>

            <GlassSurface variant="panel" className="p-4 mt-4">
              <div className="text-xs text-zinc-500 mb-3 font-medium">Fallback 历史</div>
              {loadingFallbackHistory ? (
                <div className="text-sm text-zinc-500">加载中...</div>
              ) : !fallbackHistory || fallbackHistory.fallback_records.length === 0 ? (
                <div className="text-sm text-zinc-500">暂无 fallback 历史</div>
              ) : (
                <div className="space-y-2 max-h-56 overflow-y-auto">
                  {fallbackHistory.fallback_records.map((record, index) => (
                    <div key={`${record.scene_version_id}-${record.timestamp}-${index}`} className="rounded-lg bg-zinc-900/60 p-3 text-xs text-zinc-300">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <GlassChip tone="warning" className="text-xs">{record.from_tier} → {record.to_tier}</GlassChip>
                        <span className="text-zinc-500">{record.from_provider} → {record.to_provider}</span>
                      </div>
                      <div className="text-zinc-400">原因：{record.reason || '—'}</div>
                      <div className="text-zinc-500 mt-1">触发 Gate：{record.trigger_gate || '—'} · 重试 {record.retry_count ?? 0} 次 · {formatDateTime(record.timestamp)}</div>
                    </div>
                  ))}
                </div>
              )}
            </GlassSurface>
            {renderVersionDetails()}
          </>
        )}
      </div>
    );
  };

  const renderPreviewContent = () => {
    if (loadingAssets) {
      return (
        <div className="flex items-center justify-center py-12">
          <div className="text-zinc-400">加载中...</div>
        </div>
      );
    }

    if (previewError) {
      return (
        <div className="text-center py-8">
          <p className="text-zinc-400">{previewError}</p>
        </div>
      );
    }

    if (!previewAssets || previewAssets.length === 0) {
      return (
        <div className="text-center py-8">
          <p className="text-zinc-400">暂无关联资产</p>
        </div>
      );
    }

    return (
      <div className="space-y-4 max-h-[70vh] overflow-y-auto">
        {previewAssets.map((pa, index) => {
          if (!pa.asset.uri) {
            return (
              <div key={index} className="p-3 bg-zinc-800/50 rounded">
                <p className="text-sm text-zinc-400">
                  {pa.asset.type || "未知类型"} - 无可用链接
                </p>
              </div>
            );
          }

          switch (pa.type) {
            case "video":
              return (
                <div key={index}>
                  <div className="text-xs text-zinc-500 mb-2">
                    视频资产
                  </div>
                  <video
                    src={pa.asset.uri}
                    controls
                    className="w-full rounded bg-black"
                    style={{ maxHeight: "60vh" }}
                  >
                    您的浏览器不支持视频播放
                  </video>
                  <div className="mt-2 text-xs text-zinc-500">
                    {pa.asset.mime_type} | {pa.asset.file_size ? formatBytes(pa.asset.file_size) : "未知大小"}
                  </div>
                </div>
              );
            case "image":
              return (
                <div key={index}>
                  <div className="text-xs text-zinc-500 mb-2">
                    图片资产
                  </div>
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={pa.asset.uri}
                      alt={pa.asset.type || "图片"}
                      className="w-full rounded"
                    />
                  </>
                  <div className="mt-2 text-xs text-zinc-500">
                    {pa.asset.mime_type} | {pa.asset.width && pa.asset.height ? `${pa.asset.width}x${pa.asset.height}` : "未知尺寸"}
                  </div>
                </div>
              );
            case "audio":
              return (
                <div key={index}>
                  <div className="text-xs text-zinc-500 mb-2">
                    音频资产
                  </div>
                  <audio
                    src={pa.asset.uri}
                    controls
                    className="w-full"
                  />
                  <div className="mt-2 text-xs text-zinc-500">
                    {pa.asset.mime_type} | {pa.asset.duration ? `${Math.round(pa.asset.duration)}s` : "未知时长"}
                  </div>
                </div>
              );
            default:
              return (
                <div key={index} className="p-3 bg-zinc-800/50 rounded">
                  <div className="text-xs text-zinc-500 mb-1">
                    其他资产 ({pa.asset.type || "未知"})
                  </div>
                  <a
                    href={pa.asset.uri}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-400 hover:text-blue-300 break-all"
                  >
                    {pa.asset.uri}
                  </a>
                  <div className="mt-1 text-xs text-zinc-500">
                    {pa.asset.mime_type || "未知类型"}
                  </div>
                </div>
              );
          }
        })}
      </div>
    );
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  };

  const formatDateTime = (isoString: string | null): string => {
    if (!isoString) return '-';
    try {
      const date = new Date(isoString);
      return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoString;
    }
  };

  const handleViewJob = async (jobId: string) => {
    setLoadingJob(true);
    setJobError(null);
    setViewingJob(null);

    try {
      const response = await apiClient.getJob(jobId);
      setViewingJob(response);
    } catch (error: unknown) {
      console.error('Failed to load job:', error);
      const errorMessage = error instanceof Error ? error.message : '加载任务详情失败';
      setJobError(errorMessage);
    } finally {
      setLoadingJob(false);
    }
  };

  const handleRefreshRecentJobs = async () => {
    if (!previewingScene) return;

    setRefreshingRecentJobs(true);
    setRecentJobsError(null);

    try {
      const jobsResponse = await apiClient.listJobs({
        target_id: previewingScene.id,
        limit: 3,
      });
      setRecentJobs(jobsResponse.items);
    } catch (error: unknown) {
      console.error('Failed to refresh recent jobs:', error);
      const errorMessage = error instanceof Error ? error.message : '刷新任务列表失败';
      setRecentJobsError(errorMessage);
    } finally {
      setRefreshingRecentJobs(false);
    }
  };

  const handleRefreshQA = async () => {
    if (!selectedVersion) return;

    setRefreshingQA(true);
    setQaError(null);

    try {
      const qaRunsResponse = await apiClient.listQARuns({
        subject_type: 'scene',
        subject_id: selectedVersion.id,
        limit: 3,
      });
      setVersionQARuns(qaRunsResponse.items);
      if (qaRunsResponse.items.length > 0) {
        const runId = qaRunsResponse.items[0].id;
        const qaRunDetail = await apiClient.getQARun(runId);
        setVersionQARun(qaRunDetail);
      } else {
        setVersionQARun(null);
      }
    } catch (error: unknown) {
      console.error('Failed to refresh QA data:', error);
      const errorMessage = error instanceof Error ? error.message : '刷新 QA 数据失败';
      setQaError(errorMessage);
    } finally {
      setRefreshingQA(false);
    }
  };

  const handleSelectQARun = async (runId: string) => {
    if (!selectedVersion) return;

    setLoadingQA(true);
    setQaError(null);

    try {
      const qaRunDetail = await apiClient.getQARun(runId);
      setVersionQARun(qaRunDetail);
    } catch (error: unknown) {
      console.error('Failed to load QA run detail:', error);
      const errorMessage = error instanceof Error ? error.message : '加载 QA 详情失败';
      setQaError(errorMessage);
    } finally {
      setLoadingQA(false);
    }
  };

  const handleRefreshJobDetail = async () => {
    if (!viewingJob) return;

    setLoadingJob(true);
    setJobError(null);

    try {
      const response = await apiClient.getJob(viewingJob.id);
      setViewingJob(response);
    } catch (error: unknown) {
      console.error('Failed to refresh job detail:', error);
      const errorMessage = error instanceof Error ? error.message : '刷新任务详情失败';
      setJobError(errorMessage);
    } finally {
      setLoadingJob(false);
    }
  };

  // ─── 042a handlers ─────────────────────────────────────────────

  const handleReworkClick = (version: SceneVersion) => {
    setReworkingVersion(version);
    setReworkReason('');
    setReworkError(null);
  };

  const handleReworkConfirm = async () => {
    if (!reworkingVersion || !previewingScene || !reworkReason.trim()) return;

    setReworkSubmitting(true);
    setReworkError(null);

    try {
      const response = await apiClient.reworkSceneVersion(previewingScene.id, {
        scene_version_id: reworkingVersion.id,
        change_reason: reworkReason.trim(),
        project_id: projectId,
        episode_id: episodeId,
      });
      setReworkingVersion(null);
      setReworkSuccess(response);
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (error: unknown) {
      console.error('Failed to rework version:', error);
      const errorMessage = error instanceof Error ? error.message : '返修失败';
      setReworkError(errorMessage);
    } finally {
      setReworkSubmitting(false);
    }
  };

  const handleDiffToggle = () => {
    if (diffMode) {
      setDiffMode(false);
      setVersionDiff(null);
      setDiffVersionAId(null);
      setDiffVersionBId(null);
    } else {
      setDiffMode(true);
      // 默认选 locked 和最新版，或前两个版本
      if (sceneVersions && sceneVersions.length >= 2) {
        const lockedV = sceneVersions.find(v => v.id === previewingScene?.locked_version_id);
        setDiffVersionAId(lockedV?.id || sceneVersions[0].id);
        setDiffVersionBId(sceneVersions[sceneVersions.length - 1].id);
      } else if (sceneVersions && sceneVersions.length === 1) {
        setDiffVersionAId(sceneVersions[0].id);
        setDiffVersionBId(null);
      }
    }
  };

  const handleDiffRun = async () => {
    if (!previewingScene || !diffVersionAId || !diffVersionBId) return;

    setLoadingDiff(true);
    setDiffError(null);
    setVersionDiff(null);

    try {
      const result = await apiClient.getSceneVersionDiff(
        previewingScene.id,
        diffVersionAId,
        diffVersionBId,
      );
      setVersionDiff(result);
    } catch (error: unknown) {
      console.error('Failed to load version diff:', error);
      const errorMessage = error instanceof Error ? error.message : '版本对比失败';
      setDiffError(errorMessage);
    } finally {
      setLoadingDiff(false);
    }
  };

  const handleSwitchLockedClick = () => {
    if (!previewingScene || !selectedVersion) return;
    setSwitchingLocked(previewingScene);
    setSwitchError(null);
  };

  const handleSwitchLockedConfirm = async () => {
    if (!switchingLocked || !selectedVersion) return;

    setSwitchSubmitting(true);
    setSwitchError(null);

    try {
      const response = await apiClient.switchLockedVersion(switchingLocked.id, {
        scene_version_id: selectedVersion.id,
        force: true,
      });
      setSwitchingLocked(null);
      setSwitchSuccess(response);
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (error: unknown) {
      console.error('Failed to switch locked version:', error);
      const errorMessage = error instanceof Error ? error.message : '切换失败';
      setSwitchError(errorMessage);
    } finally {
      setSwitchSubmitting(false);
    }
  };

  // ─── 042b handlers: subtitle + audio mix ─────────────────

  const handleLoadSubtitle = async () => {
    if (!previewingScene || !selectedVersion) return;
    setLoadingSubtitle(true);
    setSubtitleError(null);
    try {
      const data = await apiClient.getSceneSubtitle(previewingScene.id, selectedVersion.id);
      setSubtitleCues(data.cues);
    } catch (error: unknown) {
      console.error('Failed to load subtitle:', error);
      setSubtitleError(error instanceof Error ? error.message : '加载字幕失败');
    } finally {
      setLoadingSubtitle(false);
    }
  };

  const handleSubtitleCueChange = (index: number, field: keyof SubtitleCue, value: string | number) => {
    setSubtitleCues(prev => prev.map((c, i) => i === index ? { ...c, [field]: value } : c));
  };

  const handleAddSubtitleCue = () => {
    const lastCue = subtitleCues[subtitleCues.length - 1];
    const startTime = lastCue ? lastCue.end_time : 0;
    setSubtitleCues(prev => [...prev, {
      index: prev.length,
      start_time: startTime,
      end_time: startTime + 3,
      text: '',
    }]);
  };

  const handleRemoveSubtitleCue = (index: number) => {
    setSubtitleCues(prev => prev.filter((_, i) => i !== index).map((c, i) => ({ ...c, index: i })));
  };

  const handleSaveSubtitle = async () => {
    if (!previewingScene || !selectedVersion) return;
    setSubtitleSaving(true);
    setSubtitleError(null);
    try {
      await apiClient.updateSceneSubtitle(previewingScene.id, selectedVersion.id, {
        cues: subtitleCues,
      });
      setEditingSubtitle(false);
    } catch (error: unknown) {
      console.error('Failed to save subtitle:', error);
      setSubtitleError(error instanceof Error ? error.message : '保存字幕失败');
    } finally {
      setSubtitleSaving(false);
    }
  };

  const handleLoadAudioMix = async () => {
    if (!previewingScene || !selectedVersion) return;
    setLoadingAudioMix(true);
    setAudioMixError(null);
    try {
      const data = await apiClient.getSceneAudioMix(previewingScene.id, selectedVersion.id);
      setAudioMixData(data);
      setAudioMixForm({
        voice_volume: data.voice_volume,
        bgm_volume: data.bgm_volume,
        bgm_fade_in: data.bgm_fade_in,
        bgm_fade_out: data.bgm_fade_out,
      });
    } catch (error: unknown) {
      console.error('Failed to load audio mix:', error);
      setAudioMixError(error instanceof Error ? error.message : '加载混音参数失败');
    } finally {
      setLoadingAudioMix(false);
    }
  };

  const handleSaveAudioMix = async () => {
    if (!previewingScene || !selectedVersion) return;
    setAudioMixSaving(true);
    setAudioMixError(null);
    try {
      const data = await apiClient.updateSceneAudioMix(previewingScene.id, selectedVersion.id, audioMixForm);
      setAudioMixData(data);
      setEditingAudioMix(false);
    } catch (error: unknown) {
      console.error('Failed to save audio mix:', error);
      setAudioMixError(error instanceof Error ? error.message : '保存混音参数失败');
    } finally {
      setAudioMixSaving(false);
    }
  };

  const renderSubtitlePanel = () => {
    if (!selectedVersion) return null;
    return (
      <GlassSurface variant="panel" className="p-4 mt-4">
        <div className="flex items-center justify-between mb-3">
          <div className="text-xs text-zinc-500 font-medium">📝 字幕编辑</div>
          <div className="flex items-center gap-2">
            {editingSubtitle ? (
              <>
                <button
                  onClick={() => { setEditingSubtitle(false); handleLoadSubtitle(); }}
                  className="text-xs px-2 py-1 bg-zinc-700 hover:bg-zinc-600 text-white rounded transition-colors"
                  disabled={subtitleSaving}
                >
                  取消
                </button>
                <button
                  onClick={handleSaveSubtitle}
                  className="text-xs px-2 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors"
                  disabled={subtitleSaving}
                >
                  {subtitleSaving ? '保存中...' : '保存'}
                </button>
              </>
            ) : (
              <button
                onClick={() => { setEditingSubtitle(true); }}
                className="text-xs px-2 py-1 bg-zinc-700 hover:bg-zinc-600 text-white rounded transition-colors"
              >
                编辑
              </button>
            )}
          </div>
        </div>
        {loadingSubtitle ? (
          <div className="text-sm text-zinc-500">加载中...</div>
        ) : subtitleError ? (
          <div className="text-sm text-red-400">{subtitleError}</div>
        ) : subtitleCues.length === 0 ? (
          <div className="text-sm text-zinc-500">
            暂无字幕
            {editingSubtitle && (
              <button onClick={handleAddSubtitleCue} className="ml-2 text-blue-400 hover:text-blue-300">
                + 添加
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {subtitleCues.map((cue, idx) => (
              <div key={idx} className="flex items-start gap-2 rounded bg-zinc-900/60 p-2 text-xs">
                <div className="flex-shrink-0 w-6 h-6 rounded bg-zinc-800 flex items-center justify-center text-zinc-400">
                  {cue.index + 1}
                </div>
                <div className="flex-1 grid grid-cols-3 gap-1 items-center">
                  {editingSubtitle ? (
                    <>
                      <input
                        type="number"
                        step="0.1"
                        min={0}
                        value={cue.start_time}
                        onChange={(e) => handleSubtitleCueChange(idx, 'start_time', parseFloat(e.target.value) || 0)}
                        className="bg-zinc-800 border border-zinc-700 text-zinc-200 text-xs rounded px-1.5 py-0.5 w-full"
                        placeholder="开始"
                      />
                      <input
                        type="number"
                        step="0.1"
                        min={0}
                        value={cue.end_time}
                        onChange={(e) => handleSubtitleCueChange(idx, 'end_time', parseFloat(e.target.value) || 0)}
                        className="bg-zinc-800 border border-zinc-700 text-zinc-200 text-xs rounded px-1.5 py-0.5 w-full"
                        placeholder="结束"
                      />
                      <input
                        type="text"
                        value={cue.text}
                        onChange={(e) => handleSubtitleCueChange(idx, 'text', e.target.value)}
                        className="bg-zinc-800 border border-zinc-700 text-zinc-200 text-xs rounded px-1.5 py-0.5 w-full"
                        placeholder="字幕文本"
                      />
                    </>
                  ) : (
                    <>
                      <span className="text-zinc-400">{cue.start_time.toFixed(1)}s</span>
                      <span className="text-zinc-400">{cue.end_time.toFixed(1)}s</span>
                      <span className="text-zinc-300">{cue.text}</span>
                    </>
                  )}
                </div>
                {editingSubtitle && (
                  <button
                    onClick={() => handleRemoveSubtitleCue(idx)}
                    className="flex-shrink-0 text-red-400 hover:text-red-300 text-xs px-1"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
            {editingSubtitle && (
              <button onClick={handleAddSubtitleCue} className="text-xs text-blue-400 hover:text-blue-300 mt-1">
                + 添加字幕
              </button>
            )}
          </div>
        )}
      </GlassSurface>
    );
  };

  const renderAudioMixPanel = () => {
    if (!selectedVersion) return null;
    return (
      <GlassSurface variant="panel" className="p-4 mt-4">
        <div className="flex items-center justify-between mb-3">
          <div className="text-xs text-zinc-500 font-medium">🎵 音频混音</div>
          <div className="flex items-center gap-2">
            {editingAudioMix ? (
              <>
                <button
                  onClick={() => { setEditingAudioMix(false); handleLoadAudioMix(); }}
                  className="text-xs px-2 py-1 bg-zinc-700 hover:bg-zinc-600 text-white rounded transition-colors"
                  disabled={audioMixSaving}
                >
                  取消
                </button>
                <button
                  onClick={handleSaveAudioMix}
                  className="text-xs px-2 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors"
                  disabled={audioMixSaving}
                >
                  {audioMixSaving ? '保存中...' : '保存'}
                </button>
              </>
            ) : (
              <button
                onClick={() => { setEditingAudioMix(true); }}
                className="text-xs px-2 py-1 bg-zinc-700 hover:bg-zinc-600 text-white rounded transition-colors"
              >
                编辑
              </button>
            )}
          </div>
        </div>
        {loadingAudioMix ? (
          <div className="text-sm text-zinc-500">加载中...</div>
        ) : audioMixError ? (
          <div className="text-sm text-red-400">{audioMixError}</div>
        ) : audioMixData ? (
          <div className="grid grid-cols-2 gap-3 text-sm">
            {(['voice_volume', 'bgm_volume', 'bgm_fade_in', 'bgm_fade_out'] as const).map((key) => {
              const labels: Record<string, string> = {
                voice_volume: '人声音量',
                bgm_volume: 'BGM 音量',
                bgm_fade_in: 'BGM 淡入',
                bgm_fade_out: 'BGM 淡出',
              };
              return (
                <div key={key} className="flex items-center justify-between">
                  <span className="text-xs text-zinc-500">{labels[key]}</span>
                  {editingAudioMix ? (
                    <input
                      type="number"
                      step="0.1"
                      min={0}
                      max={2}
                      value={audioMixForm[key]}
                      onChange={(e) => setAudioMixForm({ ...audioMixForm, [key]: parseFloat(e.target.value) || 0 })}
                      className="bg-zinc-800 border border-zinc-700 text-zinc-200 text-xs rounded px-1.5 py-0.5 w-20 text-right"
                    />
                  ) : (
                    <span className="text-xs text-zinc-300">{audioMixData[key]}</span>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-sm text-zinc-500">暂无混音参数</div>
        )}
      </GlassSurface>
    );
  };

  const renderVersionDetails = () => {
    if (!selectedVersion) return null;

    const v = selectedVersion;
    const versionFallbackRecords = versionTree?.versions.find((version) => version.id === v.id)?.fallback_records ?? [];
    const providerPath = [
      typeof v.model_bundle?.primary_provider === 'string' ? v.model_bundle.primary_provider : null,
      typeof v.model_bundle?.provider === 'string' ? v.model_bundle.provider : null,
      typeof v.model_bundle?.fallback_provider === 'string' ? v.model_bundle.fallback_provider : null,
    ].filter(Boolean).join(' → ');

    return (
      <GlassSurface variant="panel" className="p-4 mt-4">
        <div className="text-xs text-zinc-500 mb-3 font-medium">
          版本详情
        </div>
        <div className="space-y-2 text-sm">
          {/* 创建时间 */}
          <div className="flex justify-between items-baseline">
            <span className="text-zinc-500">创建时间</span>
            <span className="text-zinc-300">{formatDateTime(v.created_at ?? null)}</span>
          </div>

          {/* 父版本 ID */}
          <div className="flex justify-between items-baseline">
            <span className="text-zinc-500">父版本</span>
            <span className="text-zinc-300">
              {v.parent_version_id ? `#${v.parent_version_id.slice(0, 8)}` : '无'}
            </span>
          </div>

          {/* 实际成本 */}
          <div className="flex justify-between items-baseline">
            <span className="text-zinc-500">实际成本</span>
            <span className="text-zinc-300">
              {v.cost_actual != null ? `¥${v.cost_actual.toFixed(2)}` : '未知'}
            </span>
          </div>

          <div className="flex justify-between items-baseline">
            <span className="text-zinc-500">变更原因</span>
            <span className="text-zinc-300 text-right max-w-[60%] break-words">{v.change_reason || '—'}</span>
          </div>

          <div className="flex justify-between items-baseline">
            <span className="text-zinc-500">Tier</span>
            <span className="text-zinc-300">
              {typeof v.model_bundle?.tier === 'string' ? v.model_bundle.tier : '—'}
            </span>
          </div>

          <div className="flex justify-between items-baseline">
            <span className="text-zinc-500">Provider Path</span>
            <span className="text-zinc-300 text-right max-w-[60%] break-words">{providerPath || '—'}</span>
          </div>

          {/* 评分快照 */}
          {v.score_snapshot && Object.keys(v.score_snapshot).length > 0 && (
            <div className="pt-2">
              <div className="text-xs text-zinc-500 mb-1">评分快照</div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {Object.entries(v.score_snapshot).map(([key, value]) => (
                  <div key={key} className="flex justify-between">
                    <span className="text-zinc-500">{key}</span>
                    <span className="text-zinc-300">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* QA 信息 */}
          {loadingQA ? (
            <div className="pt-2">
              <div className="text-xs text-zinc-500 mb-1">QA 检测</div>
              <div className="text-xs text-zinc-400">加载中...</div>
            </div>
          ) : qaError ? (
            <div className="pt-2">
              <div className="text-xs text-zinc-500 mb-1">QA 检测</div>
              <div className="text-xs text-red-400">{qaError}</div>
            </div>
          ) : versionQARun ? (
            <div className="pt-2">
              <div className="text-xs text-zinc-500 mb-1 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  QA 检测
                  <VersionStatusBadge status={versionQARun.status} />
                </div>
                <button
                  onClick={handleRefreshQA}
                  disabled={refreshingQA}
                  className="text-xs px-2 py-0.5 bg-zinc-700 hover:bg-zinc-600 text-white rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title="刷新 QA 数据"
                >
                  {refreshingQA ? '刷新中...' : '↻ 刷新 QA'}
                </button>
              </div>

              {/* QA 历史列表 */}
              {versionQARuns && versionQARuns.length > 1 && (
                <div className="mt-2">
                  <div className="text-xs text-zinc-500 mb-1">QA 历史 ({versionQARuns.length})</div>
                  <div className="space-y-1">
                    {versionQARuns.map((run) => {
                      const isSelected = run.id === versionQARun.id;
                      return (
                        <div
                          key={run.id}
                          onClick={() => handleSelectQARun(run.id)}
                          className={`flex items-center justify-between p-1.5 rounded cursor-pointer transition-colors ${
                            isSelected
                              ? 'bg-blue-600/20 border border-blue-600/50'
                              : 'bg-zinc-800/50 hover:bg-zinc-700/50'
                          }`}
                        >
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <VersionStatusBadge status={run.status} />
                            <div className="text-xs text-zinc-300 font-mono">{run.gate_code}</div>
                          </div>
                          <div className="text-xs text-zinc-500 flex-shrink-0 ml-2">
                            {formatDateTime(run.finished_at || run.created_at).split(' ')[0]}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-zinc-500">检测码</span>
                  <span className="text-zinc-300 font-mono">{versionQARun.gate_code}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">检测时间</span>
                  <span className="text-zinc-300">{formatDateTime(versionQARun.finished_at)}</span>
                </div>
                {versionQARun.score_json && Object.keys(versionQARun.score_json).length > 0 && (
                  <div className="pt-1">
                    <div className="text-xs text-zinc-500 mb-1">QA 评分</div>
                    <div className="grid grid-cols-2 gap-1">
                      {Object.entries(versionQARun.score_json).map(([key, value]) => (
                        <div key={key} className="flex justify-between">
                          <span className="text-zinc-500">{key}</span>
                          <span className={typeof value === 'number' && value >= 0.9 ? 'text-green-400' : 'text-zinc-300'}>{value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {versionQARun.threshold_snapshot && Object.keys(versionQARun.threshold_snapshot).length > 0 && (
                  <div className="pt-1">
                    <div className="text-xs text-zinc-500 mb-1">阈值</div>
                    <div className="grid grid-cols-2 gap-1">
                      {Object.entries(versionQARun.threshold_snapshot).map(([key, value]) => (
                        <div key={key} className="flex justify-between">
                          <span className="text-zinc-500">{key}</span>
                          <span className="text-zinc-300">{value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {versionQARun.issues && versionQARun.issues.length > 0 && (
                  <div className="pt-1">
                    <div className="text-xs text-zinc-500 mb-1">问题列表 ({versionQARun.issues.length})</div>
                    <div className="space-y-1">
                      {versionQARun.issues.map((issue, idx: number) => (
                        <div key={issue.id || idx} className="p-1.5 bg-zinc-800/50 rounded">
                          <div className="flex items-center gap-2 mb-1">
                            <GlassChip
                              tone={issue.severity === 'error' ? 'danger' : issue.severity === 'warning' ? 'warning' : 'info'}
                              className="text-xs"
                            >
                              {issue.severity}
                            </GlassChip>
                            <span className="text-xs text-zinc-300 font-mono">{issue.issue_code}</span>
                          </div>
                          <div className="text-xs text-zinc-300">{issue.message}</div>
                          {issue.suggested_action && (
                            <div className="text-xs text-zinc-500 mt-1">建议：{issue.suggested_action}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : null}

          {/* 模型配置摘要 */}
          {v.model_bundle && Object.keys(v.model_bundle).length > 0 && (
            <div className="pt-2">
              <div className="text-xs text-zinc-500 mb-1">模型配置</div>
              <div className="text-xs text-zinc-400 break-all">
                {JSON.stringify(v.model_bundle)}
              </div>
            </div>
          )}

          {/* Prompt 摘要 */}
          {v.prompt_bundle && Object.keys(v.prompt_bundle).length > 0 && (
            <div className="pt-2">
              <div className="text-xs text-zinc-500 mb-1">Prompt 配置</div>
              <div className="text-xs text-zinc-400 break-all">
                {JSON.stringify(v.prompt_bundle)}
              </div>
            </div>
          )}

          {/* 参数摘要 */}
          {v.params && Object.keys(v.params).length > 0 && (
            <div className="pt-2">
              <div className="text-xs text-zinc-500 mb-1">生成参数</div>
              <div className="text-xs text-zinc-400 break-all">
                {JSON.stringify(v.params)}
              </div>
            </div>
          )}

          <div className="pt-3 border-t border-zinc-800/60">
            <div className="text-xs text-zinc-500 mb-2 font-medium">Fallback 记录（当前版本）</div>
            {versionFallbackRecords.length === 0 ? (
              <div className="text-xs text-zinc-500">当前版本暂无 fallback 记录</div>
            ) : (
              <div className="space-y-2">
                {versionFallbackRecords.map((record, index) => (
                  <div key={`${record.scene_version_id}-${record.timestamp}-${index}`} className="rounded-lg bg-zinc-900/60 p-3 text-xs text-zinc-300">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <GlassChip tone="warning" className="text-xs">{record.from_tier} → {record.to_tier}</GlassChip>
                      <span className="text-zinc-500">{record.from_provider} → {record.to_provider}</span>
                    </div>
                    <div className="text-zinc-400">原因：{record.reason || '—'}</div>
                    <div className="text-zinc-500 mt-1">触发 Gate：{record.trigger_gate || '—'} · {formatDateTime(record.timestamp)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </GlassSurface>
    );
  };

  // 渲染任务步骤进度
  const renderStepProgress = () => {
    if (!viewingJob || !viewingJob.steps || viewingJob.steps.length === 0) {
      return null;
    }

    const steps = viewingJob.steps;
    const completedSteps = steps.filter(s => s.status === 'SUCCESS' || s.status === 'completed').length;
    const runningStep = steps.find(s => s.status === 'RUNNING' || s.status === 'running');
    const failedStep = steps.find(s => s.status === 'FAILED' || s.status === 'failed');
    
    // 计算进度
    const progress = (completedSteps / steps.length) * 100;
    
    return (
      <GlassSurface variant="panel" className="p-4">
        <div className="text-xs text-zinc-500 mb-3 font-medium">
          任务进度
        </div>
        
        {/* 进度条 */}
        <div className="mb-3">
          <div className="flex items-center justify-between text-xs text-zinc-500 mb-1">
            <span>已完成 {completedSteps} / {steps.length} 步</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${
                failedStep ? 'bg-red-500' : runningStep ? 'bg-blue-500' : 'bg-green-500'
              }`}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* 步骤列表 */}
        <div className="space-y-2">
          {steps.map((step) => {
            const stepStatus = (step.status?.toUpperCase() || step.status) as string;
            const stepTone = getStatusTone(stepStatus) as 'neutral' | 'info' | 'success' | 'warning' | 'danger';
            const isCurrentStep = runningStep?.id === step.id;
            const isFailedStep = failedStep?.id === step.id;
            
            return (
              <div
                key={step.id}
                className={`flex items-center gap-3 p-2 rounded transition-colors ${
                  isCurrentStep ? 'bg-blue-600/20 border border-blue-600/50' :
                  isFailedStep ? 'bg-red-600/20 border border-red-600/50' :
                  'bg-zinc-800/50'
                }`}
              >
                {/* 步骤序号 */}
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                  stepStatus === 'SUCCESS' || stepStatus === 'completed' ? 'bg-green-600 text-white' :
                  stepStatus === 'RUNNING' || stepStatus === 'running' ? 'bg-blue-600 text-white' :
                  stepStatus === 'FAILED' || stepStatus === 'failed' ? 'bg-red-600 text-white' :
                  'bg-zinc-700 text-zinc-400'
                }`}>
                  {step.step_order}
                </div>
                
                {/* 步骤名称和状态 */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-zinc-300 truncate">{step.step_name}</span>
                    <GlassChip tone={stepTone} className="text-xs">
                      {getJobStatusText(stepStatus)}
                    </GlassChip>
                  </div>
                  {step.error_message && (
                    <div className="text-xs text-red-400 mt-1 truncate">
                      {step.error_message}
                    </div>
                  )}
                  {step.output_data ? (
                    <div className="text-xs text-zinc-500 mt-1 truncate">
                      输出：{step.output_data as string}
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </GlassSurface>
    );
  };

  const renderRecentJobs = () => {
    if (loadingRecentJobs) {
      return (
        <GlassSurface variant="panel" className="p-4 mt-4">
          <div className="text-xs text-zinc-500 mb-2 font-medium">
            最近任务
          </div>
          <div className="flex items-center justify-center py-2">
            <div className="text-sm text-zinc-500">加载中...</div>
          </div>
        </GlassSurface>
      );
    }

    if (recentJobsError) {
      return (
        <GlassSurface variant="panel" className="p-4 mt-4">
          <div className="text-xs text-zinc-500 mb-2 font-medium">
            最近任务
          </div>
          <div className="text-sm text-red-400">
            {recentJobsError}
          </div>
        </GlassSurface>
      );
    }

    if (!recentJobs || recentJobs.length === 0) {
      return (
        <GlassSurface variant="panel" className="p-4 mt-4">
          <div className="flex items-center justify-between mb-3">
            <div className="text-xs text-zinc-500 font-medium">
              最近任务
            </div>
            <button
              onClick={handleRefreshRecentJobs}
              disabled={refreshingRecentJobs}
              className="text-xs px-2 py-1 bg-zinc-700 hover:bg-zinc-600 text-white rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="刷新任务列表"
            >
              {refreshingRecentJobs ? '刷新中...' : '↻ 刷新'}
            </button>
          </div>
          <div className="text-center py-6">
            <p className="text-sm text-zinc-400 mb-2">暂无任务记录</p>
            <p className="text-xs text-zinc-500">点击场景的「重跑」按钮可创建新任务</p>
          </div>
        </GlassSurface>
      );
    }

    return (
      <GlassSurface variant="panel" className="p-4 mt-4">
        <div className="flex items-center justify-between mb-3">
          <div className="text-xs text-zinc-500 font-medium">
            最近任务 ({recentJobs.length})
          </div>
          <button
            onClick={handleRefreshRecentJobs}
            disabled={refreshingRecentJobs}
            className="text-xs px-2 py-1 bg-zinc-700 hover:bg-zinc-600 text-white rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="刷新任务列表"
          >
            {refreshingRecentJobs ? '刷新中...' : '↻ 刷新'}
          </button>
        </div>
        <div className="space-y-2">
          {recentJobs.map((job) => (
            <div
              key={job.id}
              className="flex items-center justify-between p-2 bg-zinc-800/50 rounded hover:bg-zinc-700/50 transition-colors cursor-pointer"
              onClick={() => handleViewJob(job.id)}
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <TaskStatusMini status={job.status} latestProgress={job.latest_progress} />
                <div className="text-xs text-zinc-400 font-mono flex-shrink-0">
                  {job.id.slice(0, 8)}
                </div>
              </div>
              <div className="text-xs text-zinc-500 flex-shrink-0 ml-2">
                {job.created_at ? formatDateTime(job.created_at).split(' ')[0] : '-'}
              </div>
            </div>
          ))}
        </div>
      </GlassSurface>
    );
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-zinc-100">场景列表</h3>
        <span className="text-sm text-zinc-500">
          共 {scenes.length} 场
        </span>
      </div>

      {scenes.length === 0 ? (
        <GlassSurface variant="panel" className="p-8">
          <div className="text-center text-zinc-500">
            <p className="mb-2">暂无场景</p>
            <p className="text-sm">点击上方按钮创建新场景</p>
          </div>
        </GlassSurface>
      ) : (
        <div className="grid gap-3">
          {scenes.map((scene) => (
            <GlassSurface
              key={scene.id}
              variant="panel"
              className="p-4 hover:border-zinc-700 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs text-zinc-500">
                      第 {scene.scene_no} 场
                    </span>
                    <h4 className="font-medium text-zinc-100">
                      {scene.title || `场景 ${scene.scene_no}`}
                    </h4>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-zinc-500">
                    <SceneStatusBadge status={scene.status} />
                    {scene.duration && (
                      <span>{Math.round(scene.duration)}s</span>
                    )}
                    {scene.latest_version && (
                      <>
                        <span>
                          版本 {scene.latest_version.version_no}
                        </span>
                        {/* 显示锁定状态 */}
                        <LockStatusBadge
                          isLocked={!!scene.locked_version_id}
                          isCurrentVersionLocked={scene.locked_version_id === scene.latest_version.id}
                          lockedVersionNo={scene.locked_version_id === scene.latest_version.id ? scene.latest_version.version_no : undefined}
                        />
                      </>
                    )}
                  </div>
                </div>
                <div className="flex flex-col gap-2 items-end">
                  {scene.latest_version && (
                    <>
                      <VersionStatusBadge status={scene.latest_version.status} />
                      <button
                        onClick={() => handlePreviewClick(scene)}
                        className="mt-1 text-xs px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors"
                      >
                        预览版本
                      </button>
                      <button
                        onClick={() => handleRetryClick(scene)}
                        className="text-xs px-3 py-1.5 bg-green-700 hover:bg-green-600 text-white rounded transition-colors"
                      >
                        重跑
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => handleEditClick(scene)}
                    className="text-xs px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 text-white rounded transition-colors"
                  >
                    编辑
                  </button>
                  <button
                    onClick={() => handleDeleteClick(scene)}
                    className="text-xs px-3 py-1.5 bg-red-900 hover:bg-red-800 text-white rounded transition-colors"
                  >
                    删除
                  </button>
                </div>
              </div>
            </GlassSurface>
          ))}
        </div>
      )}

      {/* Preview Modal */}
      {previewingScene && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={() => setPreviewingScene(null)}
        >
          <div
            className="w-full max-w-2xl max-h-[80vh]"
            onClick={(e: React.MouseEvent) => e.stopPropagation()}
          >
            <GlassSurface variant="modal" className="w-full">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-zinc-100">
                    版本预览
                  </h3>
                  <p className="text-sm text-zinc-500">
                    {previewingScene.title || `场景 ${previewingScene.scene_no}`}
                  </p>
                </div>
                <button
                  onClick={() => setPreviewingScene(null)}
                  className="text-zinc-400 hover:text-zinc-200 transition-colors p-2"
                >
                  ✕
                </button>
              </div>

              <div className="border-t border-zinc-700 pt-4">
                {renderVersionSelector()}
                {renderPreviewContent()}
                {renderRecentJobs()}
                {renderSubtitlePanel()}
                {renderAudioMixPanel()}
              </div>
            </GlassSurface>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingScene && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={() => setEditingScene(null)}
        >
          <div
            className="w-full max-w-md"
            onClick={(e: React.MouseEvent) => e.stopPropagation()}
          >
            <GlassSurface variant="modal" className="w-full">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-zinc-100">
                    编辑场景
                  </h3>
                  <p className="text-sm text-zinc-500">
                    第 {editingScene.scene_no} 场
                  </p>
                </div>
                <button
                  onClick={() => setEditingScene(null)}
                  disabled={editSubmitting}
                  className="text-zinc-400 hover:text-zinc-200 transition-colors p-2 disabled:opacity-50"
                >
                  ✕
                </button>
              </div>

              <div className="border-t border-zinc-700 pt-4 space-y-4">
                <GlassField label="标题">
                  <GlassInput
                    value={editForm.title}
                    onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                    placeholder="场景标题"
                    disabled={editSubmitting}
                  />
                </GlassField>

                <GlassField label="时长（秒）">
                  <GlassInput
                    type="number"
                    step="0.1"
                    value={editForm.duration}
                    onChange={(e) => setEditForm({ ...editForm, duration: e.target.value })}
                    placeholder="例如：5.5"
                    disabled={editSubmitting}
                  />
                </GlassField>

                <GlassField label="状态">
                  <select
                    value={editForm.status}
                    onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                    disabled={editSubmitting}
                    className="glass-input-base h-10 px-3 text-sm leading-5 bg-zinc-900 border-zinc-700 text-zinc-100"
                  >
                    <option value="DRAFT">草稿 (DRAFT)</option>
                    <option value="READY">就绪 (READY)</option>
                  </select>
                </GlassField>

                {editError && (
                  <div className="text-sm text-red-400">
                    {editError}
                  </div>
                )}

                <div className="flex justify-end gap-3 pt-2">
                  <GlassButton
                    variant="secondary"
                    onClick={() => setEditingScene(null)}
                    disabled={editSubmitting}
                  >
                    取消
                  </GlassButton>
                  <GlassButton
                    variant="primary"
                    onClick={handleEditSubmit}
                    loading={editSubmitting}
                  >
                    保存
                  </GlassButton>
                </div>
              </div>
            </GlassSurface>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingScene && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={() => setDeletingScene(null)}
        >
          <div
            className="w-full max-w-md"
            onClick={(e: React.MouseEvent) => e.stopPropagation()}
          >
            <GlassSurface variant="modal" className="w-full">
              <div className="mb-4">
                <h3 className="text-lg font-semibold text-zinc-100">
                  确认删除
                </h3>
                <p className="text-sm text-zinc-500 mt-2">
                  确定要删除以下场景吗？
                </p>
                <div className="mt-3 p-3 bg-zinc-800/50 rounded">
                  <p className="text-sm text-zinc-300">
                    第 {deletingScene.scene_no} 场 - {deletingScene.title || `场景 ${deletingScene.scene_no}`}
                  </p>
                  {deletingScene.latest_version && (
                    <p className="text-xs text-zinc-500 mt-1">
                      包含版本 {deletingScene.latest_version.version_no}
                    </p>
                  )}
                </div>
              </div>

              <div className="border-t border-zinc-700 pt-4 space-y-3">
                {deleteError && (
                  <div className="text-sm text-red-400">
                    {deleteError}
                  </div>
                )}

                <div className="flex justify-end gap-3 pt-2">
                  <GlassButton
                    variant="secondary"
                    onClick={() => setDeletingScene(null)}
                    disabled={deleteSubmitting}
                  >
                    取消
                  </GlassButton>
                  <GlassButton
                    variant="danger"
                    onClick={handleDeleteConfirm}
                    loading={deleteSubmitting}
                  >
                    确认删除
                  </GlassButton>
                </div>
              </div>
            </GlassSurface>
          </div>
        </div>
      )}

      {/* Retry Confirmation Modal */}
      {retryingScene && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={() => setRetryingScene(null)}
        >
          <div
            className="w-full max-w-md"
            onClick={(e: React.MouseEvent) => e.stopPropagation()}
          >
            <GlassSurface variant="modal" className="w-full">
              <div className="mb-4">
                <h3 className="text-lg font-semibold text-zinc-100">
                  确认重跑
                </h3>
                <p className="text-sm text-zinc-500 mt-2">
                  将为以下场景创建新的生成任务和版本：
                </p>
                <div className="mt-3 p-3 bg-zinc-800/50 rounded">
                  <p className="text-sm text-zinc-300">
                    第 {retryingScene.scene_no} 场 - {retryingScene.title || `场景 ${retryingScene.scene_no}`}
                  </p>
                  {retryingScene.latest_version && (
                    <p className="text-xs text-zinc-500 mt-1">
                      当前版本 {retryingScene.latest_version.version_no} · 状态：<VersionStatusBadge status={retryingScene.latest_version.status} />
                    </p>
                  )}
                </div>
              </div>

              <div className="border-t border-zinc-700 pt-4 space-y-3">
                {retryError && (
                  <div className="text-sm text-red-400">
                    {retryError}
                  </div>
                )}

                <div className="flex justify-end gap-3 pt-2">
                  <GlassButton
                    variant="secondary"
                    onClick={() => setRetryingScene(null)}
                    disabled={retrySubmitting}
                  >
                    取消
                  </GlassButton>
                  <GlassButton
                    variant="primary"
                    onClick={handleRetryConfirm}
                    loading={retrySubmitting}
                  >
                    确认重跑
                  </GlassButton>
                </div>
              </div>
            </GlassSurface>
          </div>
        </div>
      )}

      {/* Lock Version Confirmation Modal */}
      {lockingScene && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={() => setLockingScene(null)}
        >
          <div
            className="w-full max-w-md"
            onClick={(e: React.MouseEvent) => e.stopPropagation()}
          >
            <GlassSurface variant="modal" className="w-full">
              <div className="mb-4">
                <h3 className="text-lg font-semibold text-zinc-100">
                  确认锁定版本
                </h3>
                <p className="text-sm text-zinc-500 mt-2">
                  将以下场景锁定到当前预览的版本：
                </p>
                <div className="mt-3 p-3 bg-zinc-800/50 rounded">
                  <p className="text-sm text-zinc-300">
                    第 {lockingScene.scene_no} 场 - {lockingScene.title || `场景 ${lockingScene.scene_no}`}
                  </p>
                  {selectedVersion && (
                    <p className="text-xs text-zinc-500 mt-1">
                      锁定到版本 {selectedVersion.version_no} · 状态：<VersionStatusBadge status={selectedVersion.status} />
                    </p>
                  )}
                </div>
                {lockingScene.locked_version_id && (
                  <p className="text-xs text-orange-400 mt-2">
                    ⚠️ 当前已锁定到版本，锁定后将替换为选中的版本
                  </p>
                )}
              </div>

              <div className="border-t border-zinc-700 pt-4 space-y-3">
                {lockError && (
                  <div className="text-sm text-red-400">
                    {lockError}
                  </div>
                )}

                <div className="flex justify-end gap-3 pt-2">
                  <GlassButton
                    variant="secondary"
                    onClick={() => setLockingScene(null)}
                    disabled={lockSubmitting}
                  >
                    取消
                  </GlassButton>
                  <GlassButton
                    variant="primary"
                    onClick={handleLockVersionConfirm}
                    loading={lockSubmitting}
                  >
                    确认锁定
                  </GlassButton>
                </div>
              </div>
            </GlassSurface>
          </div>
        </div>
      )}

      {/* Lock Success Toast */}
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

      {/* Retry Success Toast */}
      {retrySuccess && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-4">
          <GlassSurface variant="elevated" className="p-4 flex items-center gap-3">
            <GlassChip tone="success">✓</GlassChip>
            <div className="flex flex-col flex-1">
              <span className="text-sm font-medium text-zinc-100">{retrySuccess.message}</span>
              <span className="text-xs text-zinc-500">任务 ID：{retrySuccess.job_id} · 状态：{retrySuccess.status}</span>
            </div>
            <button
              onClick={() => handleViewJob(retrySuccess.job_id)}
              className="text-xs px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 text-white rounded transition-colors"
            >
              查看任务
            </button>
          </GlassSurface>
        </div>
      )}

      {/* ─── 042a: Version Diff Panel ─── */}
      {diffMode && selectedVersion && sceneVersions && sceneVersions.length >= 2 && (
        <GlassSurface variant="panel" className="p-4 mt-4">
          <div className="text-xs text-zinc-500 mb-3 font-medium">版本对比 (042a)</div>
          <div className="flex flex-wrap items-center gap-3 mb-3">
            <select
              value={diffVersionAId || ''}
              onChange={(e) => setDiffVersionAId(e.target.value)}
              className="bg-zinc-800 border border-zinc-700 text-zinc-200 text-xs rounded px-2 py-1.5"
            >
              {sceneVersions.map((v) => (
                <option key={v.id} value={v.id}>v{v.version_no} ({v.status})</option>
              ))}
            </select>
            <span className="text-xs text-zinc-500">vs</span>
            <select
              value={diffVersionBId || ''}
              onChange={(e) => setDiffVersionBId(e.target.value)}
              className="bg-zinc-800 border border-zinc-700 text-zinc-200 text-xs rounded px-2 py-1.5"
            >
              {sceneVersions.map((v) => (
                <option key={v.id} value={v.id}>v{v.version_no} ({v.status})</option>
              ))}
            </select>
            <button
              onClick={handleDiffRun}
              disabled={!diffVersionAId || !diffVersionBId || diffVersionAId === diffVersionBId || loadingDiff}
              className="text-xs px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
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
                      <div className="text-zinc-400 break-all max-h-20 overflow-y-auto">
                        {typeof d.value_a === 'object' ? JSON.stringify(d.value_a) : String(d.value_a ?? '—')}
                      </div>
                    </div>
                    <div>
                      <div className="text-zinc-500">v{versionDiff.version_b.version_no}</div>
                      <div className="text-zinc-400 break-all max-h-20 overflow-y-auto">
                        {typeof d.value_b === 'object' ? JSON.stringify(d.value_b) : String(d.value_b ?? '—')}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              {versionDiff.changed_fields.length === 0 && (
                <div className="text-xs text-zinc-500">两个版本无差异</div>
              )}
            </div>
          )}
        </GlassSurface>
      )}

      {/* ─── 042a: Rework Confirmation Modal ─── */}
      {reworkingVersion && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={() => setReworkingVersion(null)}
        >
          <div
            className="w-full max-w-md"
            onClick={(e: React.MouseEvent) => e.stopPropagation()}
          >
            <GlassSurface variant="modal" className="w-full">
              <div className="mb-4">
                <h3 className="text-lg font-semibold text-zinc-100">局部返修</h3>
                <p className="text-sm text-zinc-500 mt-2">
                  基于版本 v{reworkingVersion.version_no} 创建新版本：
                </p>
                <div className="mt-3 p-3 bg-zinc-800/50 rounded">
                  <p className="text-sm text-zinc-300">
                    {previewingScene?.title || `场景 ${previewingScene?.scene_no}`} · 版本 {reworkingVersion.version_no}
                  </p>
                  <p className="text-xs text-zinc-500 mt-1">
                    状态：<VersionStatusBadge status={reworkingVersion.status} />
                  </p>
                </div>
              </div>
              <div className="border-t border-zinc-700 pt-4 space-y-3">
                <GlassField label="返修原因">
                  <GlassInput
                    value={reworkReason}
                    onChange={(e) => setReworkReason(e.target.value)}
                    placeholder="例如：角色面部不一致，需要修正"
                    disabled={reworkSubmitting}
                  />
                </GlassField>
                {reworkError && <div className="text-sm text-red-400">{reworkError}</div>}
                <div className="flex justify-end gap-3 pt-2">
                  <GlassButton variant="secondary" onClick={() => setReworkingVersion(null)} disabled={reworkSubmitting}>
                    取消
                  </GlassButton>
                  <GlassButton
                    variant="primary"
                    onClick={handleReworkConfirm}
                    loading={reworkSubmitting}
                    disabled={!reworkReason.trim()}
                  >
                    确认返修
                  </GlassButton>
                </div>
              </div>
            </GlassSurface>
          </div>
        </div>
      )}

      {/* ─── 042a: Switch Locked Confirmation Modal ─── */}
      {switchingLocked && selectedVersion && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={() => setSwitchingLocked(null)}
        >
          <div
            className="w-full max-w-md"
            onClick={(e: React.MouseEvent) => e.stopPropagation()}
          >
            <GlassSurface variant="modal" className="w-full">
              <div className="mb-4">
                <h3 className="text-lg font-semibold text-zinc-100">切换锁定版本</h3>
                <p className="text-sm text-zinc-500 mt-2">
                  将锁定版本从当前切换到版本 {selectedVersion.version_no}：
                </p>
                <div className="mt-3 p-3 bg-zinc-800/50 rounded">
                  <p className="text-sm text-zinc-300">
                    {switchingLocked.title || `场景 ${switchingLocked.scene_no}`} · v{selectedVersion.version_no}
                  </p>
                  <p className="text-xs text-orange-400 mt-1">
                    ⚠️ 此操作将强制替换当前锁定版本
                  </p>
                </div>
              </div>
              <div className="border-t border-zinc-700 pt-4 space-y-3">
                {switchError && <div className="text-sm text-red-400">{switchError}</div>}
                <div className="flex justify-end gap-3 pt-2">
                  <GlassButton variant="secondary" onClick={() => setSwitchingLocked(null)} disabled={switchSubmitting}>
                    取消
                  </GlassButton>
                  <GlassButton variant="primary" onClick={handleSwitchLockedConfirm} loading={switchSubmitting}>
                    确认切换
                  </GlassButton>
                </div>
              </div>
            </GlassSurface>
          </div>
        </div>
      )}

      {/* ─── 042a: Rework Success Toast ─── */}
      {reworkSuccess && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-4">
          <GlassSurface variant="elevated" className="p-4 flex items-center gap-3">
            <GlassChip tone="success">✓</GlassChip>
            <div className="flex flex-col flex-1">
              <span className="text-sm font-medium text-zinc-100">{reworkSuccess.message}</span>
              <span className="text-xs text-zinc-500">新版本 ID：{reworkSuccess.scene_version_id?.slice(0, 8)} · 任务 ID：{reworkSuccess.job_id.slice(0, 8)}</span>
            </div>
            <button
              onClick={() => handleViewJob(reworkSuccess.job_id)}
              className="text-xs px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 text-white rounded transition-colors"
            >
              查看任务
            </button>
          </GlassSurface>
        </div>
      )}

      {/* ─── 042a: Switch Locked Success Toast ─── */}
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

      {/* Job Detail Modal */}
      {viewingJob && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={() => setViewingJob(null)}
        >
          <div
            className="w-full max-w-2xl max-h-[80vh]"
            onClick={(e: React.MouseEvent) => e.stopPropagation()}
          >
            <GlassSurface variant="modal" className="w-full">
              <div className="flex items-center justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-zinc-100">
                    任务详情
                  </h3>
                  <p className="text-sm text-zinc-500">
                    任务 ID：{viewingJob.id}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleRefreshJobDetail}
                    disabled={loadingJob}
                    className="text-xs px-2 py-1 bg-zinc-700 hover:bg-zinc-600 text-white rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title="刷新任务详情"
                  >
                    {loadingJob ? '刷新中...' : '↻ 刷新'}
                  </button>
                  <button
                    onClick={() => setViewingJob(null)}
                    className="text-zinc-400 hover:text-zinc-200 transition-colors p-2"
                  >
                    ✕
                  </button>
                </div>
              </div>

              <div className="border-t border-zinc-700 pt-4 space-y-4 max-h-[60vh] overflow-y-auto">
                {/* 任务进度 */}
                {renderStepProgress()}

                {/* 基本信息 */}
                <GlassSurface variant="panel" className="p-4">
                  <div className="text-xs text-zinc-500 mb-3 font-medium">
                    基本信息
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="flex flex-col">
                      <span className="text-zinc-500 text-xs">状态</span>
                      <TaskStatusMini status={viewingJob.status} latestProgress={viewingJob.latest_progress} />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-zinc-500 text-xs">任务类型</span>
                      <span className="text-zinc-300">{viewingJob.job_type}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-zinc-500 text-xs">目标类型</span>
                      <span className="text-zinc-300">{viewingJob.target_type}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-zinc-500 text-xs">Worker</span>
                      <span className="text-zinc-300">{viewingJob.worker_type}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-zinc-500 text-xs">重试次数</span>
                      <span className="text-zinc-300">{viewingJob.retry_count}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-zinc-500 text-xs">实际成本</span>
                      <span className="text-zinc-300">{viewingJob.cost_actual != null ? `¥${viewingJob.cost_actual.toFixed(2)}` : '-'}</span>
                    </div>
                    <div className="flex flex-col col-span-2">
                      <span className="text-zinc-500 text-xs">创建时间</span>
                      <span className="text-zinc-300">{formatDateTime(viewingJob.created_at)}</span>
                    </div>
                    <div className="flex flex-col col-span-2">
                      <span className="text-zinc-500 text-xs">开始时间</span>
                      <span className="text-zinc-300">{formatDateTime(viewingJob.started_at)}</span>
                    </div>
                    <div className="flex flex-col col-span-2">
                      <span className="text-zinc-500 text-xs">完成时间</span>
                      <span className="text-zinc-300">{formatDateTime(viewingJob.finished_at)}</span>
                    </div>
                    {viewingJob.error_message && (
                      <div className="flex flex-col col-span-2 mt-2">
                        <span className="text-red-400 text-xs">错误信息</span>
                        <span className="text-red-300 text-sm break-all">{viewingJob.error_message}</span>
                      </div>
                    )}
                  </div>
                </GlassSurface>

                {jobError && (
                  <div className="text-sm text-red-400 text-center">
                    {jobError}
                  </div>
                )}
              </div>
            </GlassSurface>
          </div>
        </div>
      )}
    </div>
  );
}
