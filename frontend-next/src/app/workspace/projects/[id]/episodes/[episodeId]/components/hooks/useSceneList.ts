"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  apiClient,
  Scene,
  Asset,
  SceneVersion,
  QARun,
  QARunDetail,
  SceneVersionTreeResponse,
  FallbackHistoryResponse,
  VersionDiffResponse,
  JobDetail,
} from "@/lib/api-client";
import type {
  SceneReworkResponse,
  SwitchLockedVersionResponse,
  SubtitleCue,
  AudioMixEditResponse,
} from "@/lib/api-client";

// ─── Shared Types ────────────────────────────────────────────────
export interface PreviewAsset {
  asset: Asset;
  type: "video" | "image" | "audio" | "other";
}

interface RecentJob {
  id: string;
  status: string;
  created_at: string | null;
  latest_progress?: {
    step: string;
    status: string;
    message: string;
    timestamp: string;
  } | null;
}

// ─── Hook Params ─────────────────────────────────────────────────
interface UseSceneListParams {
  projectId: string;
  episodeId: string;
}

// ─── Hook ────────────────────────────────────────────────────────
export function useSceneList({ projectId, episodeId }: UseSceneListParams) {
  const router = useRouter();

  // ── Preview state ──────────────────────────────────────────────
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

  // ── 编辑状态 ───────────────────────────────────────────────────
  const [editingScene, setEditingScene] = useState<Scene | null>(null);
  const [editForm, setEditForm] = useState({ title: "", duration: "", status: "DRAFT" });
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // ── 删除状态 ───────────────────────────────────────────────────
  const [deletingScene, setDeletingScene] = useState<Scene | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // ── 重跑状态 ───────────────────────────────────────────────────
  const [retryingScene, setRetryingScene] = useState<Scene | null>(null);
  const [retrySubmitting, setRetrySubmitting] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);
  const [retrySuccess, setRetrySuccess] = useState<{ job_id: string; status: string; message: string } | null>(null);

  // ── 查看 Job 状态 ──────────────────────────────────────────────
  const [viewingJob, setViewingJob] = useState<JobDetail | null>(null);
  const [loadingJob, setLoadingJob] = useState(false);
  const [jobError, setJobError] = useState<string | null>(null);

  // ── 最近任务状态 ───────────────────────────────────────────────
  const [recentJobs, setRecentJobs] = useState<RecentJob[] | null>(null);
  const [loadingRecentJobs, setLoadingRecentJobs] = useState(false);
  const [recentJobsError, setRecentJobsError] = useState<string | null>(null);
  const [refreshingRecentJobs, setRefreshingRecentJobs] = useState(false);

  // ── 锁定版本状态 ───────────────────────────────────────────────
  const [lockingScene, setLockingScene] = useState<Scene | null>(null);
  const [lockSubmitting, setLockSubmitting] = useState(false);
  const [lockError, setLockError] = useState<string | null>(null);
  const [lockSuccess, setLockSuccess] = useState(false);

  // ── 返修状态 ───────────────────────────────────────────────────
  const [reworkingVersion, setReworkingVersion] = useState<SceneVersion | null>(null);
  const [reworkReason, setReworkReason] = useState("");
  const [reworkSubmitting, setReworkSubmitting] = useState(false);
  const [reworkError, setReworkError] = useState<string | null>(null);
  const [reworkSuccess, setReworkSuccess] = useState<SceneReworkResponse | null>(null);

  // ── 版本对比状态 ───────────────────────────────────────────────
  const [diffMode, setDiffMode] = useState(false);
  const [diffVersionAId, setDiffVersionAId] = useState<string | null>(null);
  const [diffVersionBId, setDiffVersionBId] = useState<string | null>(null);
  const [versionDiff, setVersionDiff] = useState<VersionDiffResponse | null>(null);
  const [loadingDiff, setLoadingDiff] = useState(false);
  const [diffError, setDiffError] = useState<string | null>(null);

  // ── 字幕编辑状态 ───────────────────────────────────────────────
  const [subtitleCues, setSubtitleCues] = useState<SubtitleCue[]>([]);
  const [editingSubtitle, setEditingSubtitle] = useState(false);
  const [subtitleSaving, setSubtitleSaving] = useState(false);
  const [subtitleError, setSubtitleError] = useState<string | null>(null);
  const [loadingSubtitle, setLoadingSubtitle] = useState(false);

  // ── 音频混音编辑状态 ───────────────────────────────────────────
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

  // ── 切换锁定版本状态 ───────────────────────────────────────────
  const [switchingLocked, setSwitchingLocked] = useState<Scene | null>(null);
  const [switchSubmitting, setSwitchSubmitting] = useState(false);
  const [switchError, setSwitchError] = useState<string | null>(null);
  const [switchSuccess, setSwitchSuccess] = useState<SwitchLockedVersionResponse | null>(null);

  // ── QA 状态 ────────────────────────────────────────────────────
  const [versionQARun, setVersionQARun] = useState<QARunDetail | null>(null);
  const [versionQARuns, setVersionQARuns] = useState<QARun[] | null>(null);
  const [loadingQA, setLoadingQA] = useState(false);
  const [refreshingQA, setRefreshingQA] = useState(false);
  const [qaError, setQaError] = useState<string | null>(null);

  // ─── Helpers ─────────────────────────────────────────────────────
  const determineAssetType = (asset: Asset): PreviewAsset["type"] => {
    const mime = asset.mime_type?.toLowerCase() || "";
    const type = asset.type?.toLowerCase() || "";
    if (type === "video" || mime.startsWith("video/")) return "video";
    if (type === "image" || mime.startsWith("image/")) return "image";
    if (type === "audio" || mime.startsWith("audio/")) return "audio";
    return "other";
  };

  // ─── Handlers ────────────────────────────────────────────────────

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
      const tree = await apiClient.getSceneVersionTree(scene.id);
      setVersionTree(tree);

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

      const selected = versions.find(v => v.id === scene.latest_version!.id) || versions[0];
      setSelectedVersion(selected);
      setSelectedVersionId(selected.id);

      const assets = await apiClient.listAssets({
        owner_type: "scene_version",
        owner_id: selected.id,
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

      const fallbackHistoryResponse = await apiClient.getSceneFallbackHistory(scene.id);
      setFallbackHistory(fallbackHistoryResponse);

      const jobsResponse = await apiClient.listJobs({ target_id: scene.id, limit: 3 });
      setRecentJobs(jobsResponse.items);

      if (selected.id) {
        setLoadingQA(true);
        setQaError(null);
        try {
          const qaRunsResponse = await apiClient.listQARuns({
            subject_type: "scene",
            subject_id: selected.id,
            limit: 3,
          });
          setVersionQARuns(qaRunsResponse.items);
          if (qaRunsResponse.items.length > 0) {
            const qaRunDetail = await apiClient.getQARun(qaRunsResponse.items[0].id);
            setVersionQARun(qaRunDetail);
          } else {
            setVersionQARun(null);
          }
        } catch (error) {
          console.error("Failed to load QA data:", error);
          setQaError("加载 QA 数据失败");
        } finally {
          setLoadingQA(false);
        }
      }

      // 显式传入 versionId，避免 stale closure
      handleLoadSubtitle(selected.id);
      handleLoadAudioMix(selected.id);
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

      const qaRunsResponse = await apiClient.listQARuns({
        subject_type: "scene",
        subject_id: version.id,
        limit: 3,
      });
      setVersionQARuns(qaRunsResponse.items);
      if (qaRunsResponse.items.length > 0) {
        const qaRunDetail = await apiClient.getQARun(qaRunsResponse.items[0].id);
        setVersionQARun(qaRunDetail);
      } else {
        setVersionQARun(null);
      }

      // 显式传入 versionId，避免 stale closure
      handleLoadSubtitle(version.id);
      handleLoadAudioMix(version.id);
    } catch (error) {
      console.error("Failed to load assets or QA data:", error);
      setPreviewError("加载资产失败");
      setQaError("加载 QA 数据失败");
    } finally {
      setLoadingAssets(false);
      setLoadingQA(false);
    }
  };

  const handleEditClick = (scene: Scene) => {
    setEditingScene(scene);
    setEditForm({
      title: scene.title || "",
      duration: scene.duration ? scene.duration.toString() : "",
      status: scene.status,
    });
    setEditError(null);
  };

  const handleEditSubmit = async () => {
    if (!editingScene) return;
    setEditSubmitting(true);
    setEditError(null);
    try {
      const updateData: { title?: string; duration?: number; status?: string } = {};
      if (editForm.title !== editingScene.title) updateData.title = editForm.title || undefined;
      if (editForm.duration !== (editingScene.duration || "").toString())
        updateData.duration = editForm.duration ? parseFloat(editForm.duration) : undefined;
      if (editForm.status !== editingScene.status) updateData.status = editForm.status;
      if (Object.keys(updateData).length === 0) { setEditingScene(null); return; }
      await apiClient.updateScene(editingScene.id, updateData);
      setEditingScene(null);
      router.refresh();
    } catch (error: unknown) {
      console.error("Failed to update scene:", error);
      setEditError(error instanceof Error ? error.message : "更新失败");
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
      router.refresh();
    } catch (error: unknown) {
      console.error("Failed to delete scene:", error);
      setDeleteError(error instanceof Error ? error.message : "删除失败");
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
      setTimeout(() => { router.refresh(); }, 2000);
    } catch (error: unknown) {
      console.error("Failed to retry scene:", error);
      setRetryError(error instanceof Error ? error.message : "重跑失败");
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
        force: false,
      });
      setLockingScene(null);
      setLockSuccess(true);
      setTimeout(() => { router.refresh(); }, 2000);
    } catch (error: unknown) {
      console.error("Failed to lock version:", error);
      setLockError(error instanceof Error ? error.message : "锁定失败");
    } finally {
      setLockSubmitting(false);
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
      console.error("Failed to load job:", error);
      setJobError(error instanceof Error ? error.message : "加载任务详情失败");
    } finally {
      setLoadingJob(false);
    }
  };

  const handleRefreshRecentJobs = async () => {
    if (!previewingScene) return;
    setRefreshingRecentJobs(true);
    setRecentJobsError(null);
    try {
      const jobsResponse = await apiClient.listJobs({ target_id: previewingScene.id, limit: 3 });
      setRecentJobs(jobsResponse.items);
    } catch (error: unknown) {
      console.error("Failed to refresh recent jobs:", error);
      setRecentJobsError(error instanceof Error ? error.message : "刷新任务列表失败");
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
        subject_type: "scene",
        subject_id: selectedVersion.id,
        limit: 3,
      });
      setVersionQARuns(qaRunsResponse.items);
      if (qaRunsResponse.items.length > 0) {
        const qaRunDetail = await apiClient.getQARun(qaRunsResponse.items[0].id);
        setVersionQARun(qaRunDetail);
      } else {
        setVersionQARun(null);
      }
    } catch (error: unknown) {
      console.error("Failed to refresh QA data:", error);
      setQaError(error instanceof Error ? error.message : "刷新 QA 数据失败");
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
      console.error("Failed to load QA run detail:", error);
      setQaError(error instanceof Error ? error.message : "加载 QA 详情失败");
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
      console.error("Failed to refresh job detail:", error);
      setJobError(error instanceof Error ? error.message : "刷新任务详情失败");
    } finally {
      setLoadingJob(false);
    }
  };

  const handleReworkClick = (version: SceneVersion) => {
    setReworkingVersion(version);
    setReworkReason("");
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
      setTimeout(() => { router.refresh(); }, 2000);
    } catch (error: unknown) {
      console.error("Failed to rework version:", error);
      setReworkError(error instanceof Error ? error.message : "返修失败");
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
      const result = await apiClient.getSceneVersionDiff(previewingScene.id, diffVersionAId, diffVersionBId);
      setVersionDiff(result);
    } catch (error: unknown) {
      console.error("Failed to load version diff:", error);
      setDiffError(error instanceof Error ? error.message : "版本对比失败");
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
      setTimeout(() => { router.refresh(); }, 2000);
    } catch (error: unknown) {
      console.error("Failed to switch locked version:", error);
      setSwitchError(error instanceof Error ? error.message : "切换失败");
    } finally {
      setSwitchSubmitting(false);
    }
  };

  // ── 字幕 handlers ──────────────────────────────────────────────
  const handleLoadSubtitle = async (versionId?: string) => {
    const vid = versionId ?? selectedVersion?.id;
    if (!previewingScene || !vid) return;
    setLoadingSubtitle(true);
    setSubtitleError(null);
    try {
      const data = await apiClient.getSceneSubtitle(previewingScene.id, vid);
      setSubtitleCues(data.cues);
    } catch (error: unknown) {
      console.error("Failed to load subtitle:", error);
      setSubtitleError(error instanceof Error ? error.message : "加载字幕失败");
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
    setSubtitleCues(prev => [...prev, { index: prev.length, start_time: startTime, end_time: startTime + 3, text: "" }]);
  };

  const handleRemoveSubtitleCue = (index: number) => {
    setSubtitleCues(prev => prev.filter((_, i) => i !== index).map((c, i) => ({ ...c, index: i })));
  };

  const handleSaveSubtitle = async () => {
    if (!previewingScene || !selectedVersion) return;
    setSubtitleSaving(true);
    setSubtitleError(null);
    try {
      await apiClient.updateSceneSubtitle(previewingScene.id, selectedVersion.id, { cues: subtitleCues });
      setEditingSubtitle(false);
    } catch (error: unknown) {
      console.error("Failed to save subtitle:", error);
      setSubtitleError(error instanceof Error ? error.message : "保存字幕失败");
    } finally {
      setSubtitleSaving(false);
    }
  };

  // ── 音频混音 handlers ──────────────────────────────────────────
  const handleLoadAudioMix = async (versionId?: string) => {
    const vid = versionId ?? selectedVersion?.id;
    if (!previewingScene || !vid) return;
    setLoadingAudioMix(true);
    setAudioMixError(null);
    try {
      const data = await apiClient.getSceneAudioMix(previewingScene.id, vid);
      setAudioMixData(data);
      setAudioMixForm({
        voice_volume: data.voice_volume,
        bgm_volume: data.bgm_volume,
        bgm_fade_in: data.bgm_fade_in,
        bgm_fade_out: data.bgm_fade_out,
      });
    } catch (error: unknown) {
      console.error("Failed to load audio mix:", error);
      setAudioMixError(error instanceof Error ? error.message : "加载混音参数失败");
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
      console.error("Failed to save audio mix:", error);
      setAudioMixError(error instanceof Error ? error.message : "保存混音参数失败");
    } finally {
      setAudioMixSaving(false);
    }
  };

  // ─── Return ───────────────────────────────────────────────────────
  return {
    // ── preview ──
    previewingScene, setPreviewingScene,
    previewAssets,
    loadingAssets,
    previewError,
    sceneVersions,
    selectedVersionId,
    selectedVersion,
    loadingVersions,
    versionTree,
    fallbackHistory,
    loadingFallbackHistory,
    // ── edit ──
    editingScene, setEditingScene,
    editForm, setEditForm,
    editSubmitting,
    editError,
    // ── delete ──
    deletingScene, setDeletingScene,
    deleteSubmitting,
    deleteError,
    // ── retry ──
    retryingScene, setRetryingScene,
    retrySubmitting,
    retryError,
    retrySuccess, setRetrySuccess,
    // ── job ──
    viewingJob, setViewingJob,
    loadingJob,
    jobError,
    // ── recent jobs ──
    recentJobs,
    loadingRecentJobs,
    recentJobsError,
    refreshingRecentJobs,
    // ── lock ──
    lockingScene, setLockingScene,
    lockSubmitting,
    lockError,
    lockSuccess, setLockSuccess,
    // ── rework ──
    reworkingVersion, setReworkingVersion,
    reworkReason, setReworkReason,
    reworkSubmitting,
    reworkError,
    reworkSuccess, setReworkSuccess,
    // ── diff ──
    diffMode,
    diffVersionAId, setDiffVersionAId,
    diffVersionBId, setDiffVersionBId,
    versionDiff,
    loadingDiff,
    diffError,
    // ── subtitle ──
    subtitleCues,
    editingSubtitle, setEditingSubtitle,
    subtitleSaving,
    subtitleError,
    loadingSubtitle,
    // ── audio mix ──
    audioMixData,
    editingAudioMix, setEditingAudioMix,
    audioMixForm, setAudioMixForm,
    audioMixSaving,
    audioMixError,
    loadingAudioMix,
    // ── switch locked ──
    switchingLocked, setSwitchingLocked,
    switchSubmitting,
    switchError,
    switchSuccess, setSwitchSuccess,
    // ── QA ──
    versionQARun,
    versionQARuns,
    loadingQA,
    refreshingQA,
    qaError,
    // ── handlers ──
    handlePreviewClick,
    handleVersionChange,
    handleEditClick,
    handleEditSubmit,
    handleDeleteClick,
    handleDeleteConfirm,
    handleRetryClick,
    handleRetryConfirm,
    handleLockVersionClick,
    handleLockVersionConfirm,
    handleViewJob,
    handleRefreshRecentJobs,
    handleRefreshQA,
    handleSelectQARun,
    handleRefreshJobDetail,
    handleReworkClick,
    handleReworkConfirm,
    handleDiffToggle,
    handleDiffRun,
    handleSwitchLockedClick,
    handleSwitchLockedConfirm,
    handleLoadSubtitle,
    handleSubtitleCueChange,
    handleAddSubtitleCue,
    handleRemoveSubtitleCue,
    handleSaveSubtitle,
    handleLoadAudioMix,
    handleSaveAudioMix,
  };
}
