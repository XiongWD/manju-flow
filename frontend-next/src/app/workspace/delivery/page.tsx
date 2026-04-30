"use client";

import { useState, useEffect, useCallback } from "react";
import GlassSurface from "@/components/ui/primitives/GlassSurface";
import GlassButton from "@/components/ui/primitives/GlassButton";
import GlassChip from "@/components/ui/primitives/GlassChip";
import GlassInput from "@/components/ui/primitives/GlassInput";
import GlassField from "@/components/ui/primitives/GlassField";
import GlassTextarea from "@/components/ui/primitives/GlassTextarea";
import GlassEmptyState from "@/components/ui/primitives/GlassEmptyState";
import { ListSkeleton } from "@/components/Skeleton";
import {
  apiClient,
  type Project,
  type Episode,
  type Scene,
  type SceneVersion,
  type SubtitleCue,
  type SubtitleEditResponse,
  type AudioMixEditResponse,
  type DeliveryPackage,
  type PublishJob,
} from "@/lib/api-client";

// ── Helpers ──────────────────────────────────────────────────────

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function statusTone(
  status: string
): "neutral" | "info" | "success" | "warning" | "danger" {
  if (["completed", "published", "ready"].includes(status)) return "success";
  if (["running", "publishing", "building"].includes(status)) return "info";
  if (["failed", "expired"].includes(status)) return "danger";
  if (["queued", "pending"].includes(status)) return "warning";
  return "neutral";
}

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    completed: '已完成',
    published: '已发布',
    ready: '就绪',
    running: '进行中',
    publishing: '发布中',
    building: '生成中',
    failed: '失败',
    expired: '已过期',
    queued: '排队中',
    pending: '待处理',
  };
  return map[status] ?? status;
}

function shortId(id: string): string {
  return `#${id.slice(0, 8)}`;
}

// ── Main Page ────────────────────────────────────────────────────

export default function DeliveryPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [selectedEpisodeId, setSelectedEpisodeId] = useState<string>("");
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [selectedSceneId, setSelectedSceneId] = useState<string>("");
  const [sceneVersions, setSceneVersions] = useState<SceneVersion[]>([]);
  const [selectedVersionId, setSelectedVersionId] = useState<string>("");

  // Subtitle state
  const [subtitleData, setSubtitleData] = useState<SubtitleEditResponse | null>(null);
  const [subtitleLoading, setSubtitleLoading] = useState(false);
  const [subtitleSaving, setSubtitleSaving] = useState(false);
  const [editingCueIndex, setEditingCueIndex] = useState<number | null>(null);
  const [editingCueText, setEditingCueText] = useState("");

  // Audio mix state
  const [audioMixData, setAudioMixData] = useState<AudioMixEditResponse | null>(null);
  const [audioMixLoading, setAudioMixLoading] = useState(false);
  const [audioMixSaving, setAudioMixSaving] = useState(false);
  const [audioForm, setAudioForm] = useState({
    voice_volume: 1.0,
    bgm_volume: 0.3,
    bgm_fade_in: 1.0,
    bgm_fade_out: 2.0,
  });

  // Delivery packages
  const [deliveryPackages, setDeliveryPackages] = useState<DeliveryPackage[]>([]);
  const [packagesLoading, setPackagesLoading] = useState(false);

  // Publish jobs
  const [publishJobs, setPublishJobs] = useState<PublishJob[]>([]);
  const [jobsLoading, setJobsLoading] = useState(false);

  // New publish job form
  const [newJobPlatform, setNewJobPlatform] = useState("");
  const [showNewJobForm, setShowNewJobForm] = useState(false);

  // General loading
  const [loading, setLoading] = useState(true);

  // ── Load projects ─────────────────────────────────────────────

  useEffect(() => {
    (async () => {
      try {
        const data = await apiClient.listProjects();
        setProjects(data.items);
      } catch (err) {
        console.error("Failed to load projects", err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // ── Load episodes when project changes ────────────────────────

  useEffect(() => {
    if (!selectedProjectId) {
      setEpisodes([]);
      setSelectedEpisodeId("");
      return;
    }
    (async () => {
      try {
        const data = await apiClient.listEpisodes({ project_id: selectedProjectId });
        setEpisodes(data.items);
      } catch (err) {
        console.error("Failed to load episodes", err);
      }
    })();
  }, [selectedProjectId]);

  // ── Load scenes + packages + jobs when episode changes ────────

  useEffect(() => {
    if (!selectedEpisodeId) {
      setScenes([]);
      setSelectedSceneId("");
      setDeliveryPackages([]);
      setPublishJobs([]);
      return;
    }

    const projectId = selectedProjectId;

    (async () => {
      // Scenes
      try {
        const sceneData = await apiClient.listScenes({ episode_id: selectedEpisodeId });
        setScenes(sceneData.items);
        if (sceneData.items.length > 0) {
          setSelectedSceneId(sceneData.items[0].id);
        }
      } catch (err) {
        console.error("Failed to load scenes", err);
      }

      // Delivery packages
      setPackagesLoading(true);
      try {
        const pkgData = await apiClient.listDeliveryPackages({ episode_id: selectedEpisodeId });
        setDeliveryPackages(pkgData.items);
      } catch {
        setDeliveryPackages([]);
      } finally {
        setPackagesLoading(false);
      }

      // Publish jobs
      setJobsLoading(true);
      try {
        const jobData = await apiClient.listPublishJobs({ project_id: projectId, episode_id: selectedEpisodeId });
        setPublishJobs(jobData.items);
      } catch {
        setPublishJobs([]);
      } finally {
        setJobsLoading(false);
      }
    })();
  }, [selectedEpisodeId, selectedProjectId]);

  // ── Load scene versions when scene changes ────────────────────

  useEffect(() => {
    if (!selectedSceneId) {
      setSceneVersions([]);
      setSelectedVersionId("");
      return;
    }
    (async () => {
      try {
        const data = await apiClient.listSceneVersions(selectedSceneId);
        setSceneVersions(data);
        if (data.length > 0) {
          setSelectedVersionId(data[data.length - 1].id);
        }
      } catch (err) {
        console.error("Failed to load versions", err);
      }
    })();
  }, [selectedSceneId]);

  // ── Load subtitle when version changes ────────────────────────

  const loadSubtitle = useCallback(async () => {
    if (!selectedSceneId || !selectedVersionId) return;
    setSubtitleLoading(true);
    try {
      const data = await apiClient.getSceneSubtitle(selectedSceneId, selectedVersionId);
      setSubtitleData(data);
    } catch {
      setSubtitleData(null);
    } finally {
      setSubtitleLoading(false);
    }
  }, [selectedSceneId, selectedVersionId]);

  // ── Load audio mix when version changes ───────────────────────

  const loadAudioMix = useCallback(async () => {
    if (!selectedSceneId || !selectedVersionId) return;
    setAudioMixLoading(true);
    try {
      const data = await apiClient.getSceneAudioMix(selectedSceneId, selectedVersionId);
      setAudioMixData(data);
      setAudioForm({
        voice_volume: data.voice_volume,
        bgm_volume: data.bgm_volume,
        bgm_fade_in: data.bgm_fade_in,
        bgm_fade_out: data.bgm_fade_out,
      });
    } catch {
      setAudioMixData(null);
    } finally {
      setAudioMixLoading(false);
    }
  }, [selectedSceneId, selectedVersionId]);

  useEffect(() => {
    loadSubtitle();
    loadAudioMix();
  }, [loadSubtitle, loadAudioMix]);

  // ── Subtitle actions ──────────────────────────────────────────

  const handleSaveSubtitle = async () => {
    if (!selectedSceneId || !selectedVersionId || !subtitleData) return;
    setSubtitleSaving(true);
    try {
      const result = await apiClient.updateSceneSubtitle(selectedSceneId, selectedVersionId, {
        cues: subtitleData.cues,
      });
      setSubtitleData(result);
    } catch (err) {
      console.error("Failed to save subtitle", err);
    } finally {
      setSubtitleSaving(false);
    }
  };

  const handleCueTextChange = (index: number, newText: string) => {
    if (!subtitleData) return;
    const updated = { ...subtitleData, cues: [...subtitleData.cues] };
    updated.cues[index] = { ...updated.cues[index], text: newText };
    setSubtitleData(updated);
  };

  const startEditCue = (index: number) => {
    setEditingCueIndex(index);
    setEditingCueText(subtitleData?.cues[index].text ?? "");
  };

  const confirmEditCue = () => {
    if (editingCueIndex !== null) {
      handleCueTextChange(editingCueIndex, editingCueText);
    }
    setEditingCueIndex(null);
  };

  // ── Audio mix actions ─────────────────────────────────────────

  const handleSaveAudioMix = async () => {
    if (!selectedSceneId || !selectedVersionId) return;
    setAudioMixSaving(true);
    try {
      const result = await apiClient.updateSceneAudioMix(selectedSceneId, selectedVersionId, audioForm);
      setAudioMixData(result);
    } catch (err) {
      console.error("Failed to save audio mix", err);
    } finally {
      setAudioMixSaving(false);
    }
  };

  // ── Delivery package actions ──────────────────────────────────

  const handleCreatePackage = async (packageType: DeliveryPackage["package_type"]) => {
    if (!selectedEpisodeId) return;
    try {
      await apiClient.createDeliveryPackage({ episode_id: selectedEpisodeId, package_type: packageType });
      const data = await apiClient.listDeliveryPackages({ episode_id: selectedEpisodeId });
      setDeliveryPackages(data.items);
    } catch (err) {
      console.error("Failed to create package", err);
    }
  };

  // ── Publish job actions ───────────────────────────────────────

  const handleCreatePublishJob = async () => {
    if (!selectedProjectId || !newJobPlatform) return;
    try {
      await apiClient.createPublishJob({
        project_id: selectedProjectId,
        episode_id: selectedEpisodeId || undefined,
        platform: newJobPlatform,
      });
      setNewJobPlatform("");
      setShowNewJobForm(false);
      const data = await apiClient.listPublishJobs({
        project_id: selectedProjectId,
        episode_id: selectedEpisodeId || undefined,
      });
      setPublishJobs(data.items);
    } catch (err) {
      console.error("Failed to create publish job", err);
    }
  };

  // ── Render ────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 p-4 md:p-6 lg:p-8">
        <ListSkeleton count={4} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-6 space-y-6">
      {/* ── Header ─────────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-bold text-zinc-100">剪辑与交付</h1>
        <p className="text-zinc-400 mt-1 text-sm">
          后期工作台 — 在渲染完成并通过质检后，在此进行字幕精编、音频混音调整，然后按剧集/场景生成交付包（剪辑包、审片包、发布包），最终提交到目标平台发布。
        </p>
      </div>

      {/* ── 前置条件 & 流程说明 ────────────────────────────── */}
      {!selectedProjectId && (
        <GlassSurface variant="panel" className="!p-5 space-y-4">
          <h2 className="text-sm font-semibold text-white">📋 交付流程说明</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
            <div className="bg-zinc-800/40 rounded-lg p-3">
              <div className="font-semibold text-zinc-300 mb-1">1️⃣ 选择项目与剧集</div>
              <p className="text-zinc-500 leading-relaxed">在上方选择已渲染完成并通过质检的项目和剧集。如果列表为空，请先在「故事」和「资产」页面完成创作与渲染。</p>
            </div>
            <div className="bg-zinc-800/40 rounded-lg p-3">
              <div className="font-semibold text-zinc-300 mb-1">2️⃣ 字幕精编 & 音频混音</div>
              <p className="text-zinc-500 leading-relaxed">逐场景编辑字幕时间轴和文案，调整人声/BGM 音量与淡入淡出。每条字幕可内联编辑，音频参数实时预览。</p>
            </div>
            <div className="bg-zinc-800/40 rounded-lg p-3">
              <div className="font-semibold text-zinc-300 mb-1">3️⃣ 生成交付包</div>
              <p className="text-zinc-500 leading-relaxed">
                <span className="text-zinc-300">剪辑包 (video)</span>：含视频+字幕的剪辑成品；
                <span className="text-zinc-300">审片包 (bundle)</span>：完整素材供审阅；
                <span className="text-zinc-300">字幕/音频</span>：独立导出。
              </p>
            </div>
            <div className="bg-zinc-800/40 rounded-lg p-3">
              <div className="font-semibold text-zinc-300 mb-1">4️⃣ 发布到平台</div>
              <p className="text-zinc-500 leading-relaxed">基于已生成的交付包创建发布任务，指定目标平台（B站、YouTube、抖音等）。当前为任务管理入口，实际平台对接需后端集成。</p>
            </div>
          </div>
          <p className="text-xs text-zinc-600">
            前置条件：项目已有至少一个剧集 → 剧集下的场景已完成渲染 → 渲染结果通过质检 (QA 页面)。如缺少数据，请先完成上游工作流。
          </p>
        </GlassSurface>
      )}

      {/* ── Selector bar ───────────────────────────────────── */}
      <GlassSurface variant="panel" density="compact">
        <div className="flex flex-wrap items-end gap-4">
          <GlassField label="项目" className="min-w-[180px]">
            <select
              className="glass-input-base h-10 px-3 text-sm"
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
            >
              <option value="">选择项目…</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </GlassField>

          <GlassField label="剧集" className="min-w-[180px]">
            <select
              className="glass-input-base h-10 px-3 text-sm"
              value={selectedEpisodeId}
              onChange={(e) => setSelectedEpisodeId(e.target.value)}
              disabled={!selectedProjectId}
            >
              <option value="">选择剧集…</option>
              {episodes.map((ep) => (
                <option key={ep.id} value={ep.id}>
                  第 {ep.episode_no} 集 — {ep.title}
                </option>
              ))}
            </select>
          </GlassField>

          <GlassField label="场景" className="min-w-[180px]">
            <select
              className="glass-input-base h-10 px-3 text-sm"
              value={selectedSceneId}
              onChange={(e) => setSelectedSceneId(e.target.value)}
              disabled={!selectedEpisodeId}
            >
              <option value="">选择场景…</option>
              {scenes.map((sc) => (
                <option key={sc.id} value={sc.id}>
                  场景 {sc.scene_no} {sc.title ? `— ${sc.title}` : ""}
                </option>
              ))}
            </select>
          </GlassField>

          {sceneVersions.length > 0 && (
            <GlassField label="版本" className="min-w-[140px]">
              <select
                className="glass-input-base h-10 px-3 text-sm"
                value={selectedVersionId}
                onChange={(e) => setSelectedVersionId(e.target.value)}
              >
                {sceneVersions.map((v) => (
                  <option key={v.id} value={v.id}>
                    v{v.version_no} {shortId(v.id)}
                  </option>
                ))}
              </select>
            </GlassField>
          )}
        </div>
      </GlassSurface>

      {/* ── Main content grid ──────────────────────────────── */}
      {!selectedSceneId || !selectedVersionId ? (
        <GlassEmptyState
          title={projects.length === 0 ? "暂无项目" : !selectedProjectId ? "请先选择一个项目" : !selectedEpisodeId ? "请选择一个剧集" : "请选择一个场景和版本"}
          description={projects.length === 0 ? "请先创建项目后再进入剪辑与交付工作台。" : !selectedProjectId ? "选定项目后，才能加载对应剧集、场景与版本。" : !selectedEpisodeId ? "先选中剧集，再继续进行字幕、混音与交付操作。" : "选中具体场景与版本后，即可开始字幕编辑与音频混音。"}
        />
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* ── Left: Subtitle Editor ─────────────────────── */}
          <GlassSurface variant="panel">
            <div className="flex items-center justify-between mb-4">
                  <div>
              <h2 className="text-lg font-semibold text-zinc-100">字幕编辑</h2>
              <p className="text-xs text-zinc-500 mt-0.5">对当前场景版本的字幕进行逐条编辑。点击字幕文案可内联修改，修改后点击「保存字幕」提交。字幕数据来源于渲染流程自动生成的 SRT。</p>
            </div>
              <GlassButton
                variant="primary"
                size="sm"
                loading={subtitleSaving}
                onClick={handleSaveSubtitle}
              >
                保存字幕
              </GlassButton>
            </div>

            {subtitleLoading ? (
              <p className="text-zinc-500 text-sm py-8 text-center">加载字幕…</p>
            ) : !subtitleData ? (
              <p className="text-zinc-500 text-sm py-8 text-center">
                该版本暂无字幕数据
              </p>
            ) : (
              <div className="space-y-1 max-h-[500px] overflow-y-auto pr-1">
                {subtitleData.cues.map((cue, idx) => (
                  <div
                    key={cue.index}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/5 transition-colors group"
                  >
                    <span className="text-xs text-zinc-500 w-20 shrink-0 tabular-nums">
                      {formatTime(cue.start_time)} → {formatTime(cue.end_time)}
                    </span>
                    {editingCueIndex === idx ? (
                      <div className="flex items-center gap-2 flex-1">
                        <GlassInput
                          value={editingCueText}
                          onChange={(e) => setEditingCueText(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") confirmEditCue();
                            if (e.key === "Escape") setEditingCueIndex(null);
                          }}
                          className="flex-1"
                          density="compact"
                          autoFocus
                        />
                        <GlassButton variant="primary" size="sm" onClick={confirmEditCue}>
                          确认
                        </GlassButton>
                        <GlassButton variant="ghost" size="sm" onClick={() => setEditingCueIndex(null)}>
                          取消
                        </GlassButton>
                      </div>
                    ) : (
                      <>
                        <span className="text-sm text-zinc-200 flex-1">{cue.text}</span>
                        <button
                          className="text-xs text-zinc-500 hover:text-zinc-300 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => startEditCue(idx)}
                        >
                          编辑
                        </button>
                      </>
                    )}
                  </div>
                ))}
                {subtitleData.cues.length === 0 && (
                  <p className="text-zinc-500 text-sm py-4 text-center">暂无字幕条目</p>
                )}
              </div>
            )}
          </GlassSurface>

          {/* ── Right: Audio Mix Editor ───────────────────── */}
          <GlassSurface variant="panel">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold text-zinc-100">音频混音</h2>
                <p className="text-xs text-zinc-500 mt-0.5">调整人声与背景音乐的音量平衡和淡入淡出参数。数值范围 0.0~2.0，1.0 为原始音量。修改后点击「保存混音」提交。</p>
              </div>
              <GlassButton
                variant="primary"
                size="sm"
                loading={audioMixSaving}
                onClick={handleSaveAudioMix}
              >
                保存混音
              </GlassButton>
            </div>

            {audioMixLoading ? (
              <p className="text-zinc-500 text-sm py-8 text-center">加载混音数据…</p>
            ) : !audioMixData ? (
              <p className="text-zinc-500 text-sm py-8 text-center">
                该版本暂无混音数据
              </p>
            ) : (
              <div className="space-y-5">
                <GlassField label="人声音量" hint="0.0 ~ 2.0">
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min={0}
                      max={2}
                      step={0.05}
                      value={audioForm.voice_volume}
                      onChange={(e) =>
                        setAudioForm((f) => ({ ...f, voice_volume: parseFloat(e.target.value) }))
                      }
                      className="flex-1 accent-blue-500"
                    />
                    <span className="text-sm text-zinc-300 w-12 text-right tabular-nums">
                      {audioForm.voice_volume.toFixed(2)}
                    </span>
                  </div>
                </GlassField>

                <GlassField label="背景音乐音量" hint="0.0 ~ 2.0">
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min={0}
                      max={2}
                      step={0.05}
                      value={audioForm.bgm_volume}
                      onChange={(e) =>
                        setAudioForm((f) => ({ ...f, bgm_volume: parseFloat(e.target.value) }))
                      }
                      className="flex-1 accent-blue-500"
                    />
                    <span className="text-sm text-zinc-300 w-12 text-right tabular-nums">
                      {audioForm.bgm_volume.toFixed(2)}
                    </span>
                  </div>
                </GlassField>

                <GlassField label="背景音乐淡入时长" hint="秒">
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min={0}
                      max={10}
                      step={0.5}
                      value={audioForm.bgm_fade_in}
                      onChange={(e) =>
                        setAudioForm((f) => ({ ...f, bgm_fade_in: parseFloat(e.target.value) }))
                      }
                      className="flex-1 accent-blue-500"
                    />
                    <span className="text-sm text-zinc-300 w-12 text-right tabular-nums">
                      {audioForm.bgm_fade_in.toFixed(1)}s
                    </span>
                  </div>
                </GlassField>

                <GlassField label="背景音乐淡出时长" hint="秒">
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min={0}
                      max={10}
                      step={0.5}
                      value={audioForm.bgm_fade_out}
                      onChange={(e) =>
                        setAudioForm((f) => ({ ...f, bgm_fade_out: parseFloat(e.target.value) }))
                      }
                      className="flex-1 accent-blue-500"
                    />
                    <span className="text-sm text-zinc-300 w-12 text-right tabular-nums">
                      {audioForm.bgm_fade_out.toFixed(1)}s
                    </span>
                  </div>
                </GlassField>
              </div>
            )}
          </GlassSurface>
        </div>
      )}

      {/* ── Delivery Packages ──────────────────────────────── */}
      <GlassSurface variant="panel">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-zinc-100">交付包</h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              按剧集维度生成不同用途的交付包：<strong className="text-zinc-400">视频</strong>（剪辑成品，含画面+字幕）、<strong className="text-zinc-400">音频</strong>（独立音轨）、<strong className="text-zinc-400">字幕</strong>（SRT 文件）、<strong className="text-zinc-400">完整包</strong>（视频+音频+字幕+元数据，用于审片或归档）。生成过程异步执行，状态可在此跟踪。
            </p>
          </div>
          {selectedEpisodeId && (
            <div className="flex gap-2">
              {(["video", "audio", "subtitle", "bundle"] as const).map((t) => (
                <GlassButton
                  key={t}
                  variant="secondary"
                  size="sm"
                  onClick={() => handleCreatePackage(t)}
                >
                  {t === "video" ? "视频" : t === "audio" ? "音频" : t === "subtitle" ? "字幕" : "完整包"}
                </GlassButton>
              ))}
            </div>
          )}
        </div>

        {!selectedEpisodeId ? (
          <p className="text-zinc-500 text-sm py-4 text-center">请先选择剧集</p>
        ) : packagesLoading ? (
          <p className="text-zinc-500 text-sm py-4 text-center">加载中…</p>
        ) : deliveryPackages.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-zinc-500 text-sm">暂无交付包。点击上方按钮为当前剧集生成第一个交付包。</p>
            <p className="text-zinc-600 text-xs mt-1">提示：确保该剧集下的场景已完成渲染并通过质检，否则生成的包可能不完整。</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-left text-zinc-400">
                  <th className="pb-2 pr-4 font-medium">类型</th>
                  <th className="pb-2 pr-4 font-medium">状态</th>
                  <th className="pb-2 pr-4 font-medium">大小</th>
                  <th className="pb-2 pr-4 font-medium">创建时间</th>
                  <th className="pb-2 font-medium">ID</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {deliveryPackages.map((pkg) => (
                  <tr key={pkg.id} className="hover:bg-white/[0.02]">
                    <td className="py-2.5 pr-4 text-zinc-200">
                      {pkg.package_type === "video"
                        ? "视频"
                        : pkg.package_type === "audio"
                          ? "音频"
                          : pkg.package_type === "subtitle"
                            ? "字幕"
                            : "完整包"}
                    </td>
                    <td className="py-2.5 pr-4">
                      <GlassChip tone={statusTone(pkg.status)}>
                        {statusLabel(pkg.status)}
                      </GlassChip>
                    </td>
                    <td className="py-2.5 pr-4 text-zinc-400 tabular-nums">
                      {pkg.file_size
                        ? `${(pkg.file_size / 1024 / 1024).toFixed(1)} MB`
                        : "—"}
                    </td>
                    <td className="py-2.5 pr-4 text-zinc-400">
                      {new Date(pkg.created_at).toLocaleString("zh-CN", {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="py-2.5 text-zinc-500 text-xs font-mono">
                      {shortId(pkg.id)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </GlassSurface>

      {/* ── Publish Jobs ───────────────────────────────────── */}
      <GlassSurface variant="panel">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-zinc-100">发布任务</h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              基于已生成的交付包，创建向各平台的发布任务。当前为任务记录与管理入口，实际平台上传对接依赖后端集成（B站、YouTube、抖音等 API）。
            </p>
          </div>
          {selectedProjectId && (
            <GlassButton
              variant="secondary"
              size="sm"
              onClick={() => setShowNewJobForm((v) => !v)}
            >
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
                onKeyDown={(e) => e.key === "Enter" && handleCreatePublishJob()}
              />
            </GlassField>
            <GlassButton
              variant="primary"
              size="sm"
              onClick={handleCreatePublishJob}
              disabled={!newJobPlatform}
            >
              创建
            </GlassButton>
          </div>
        )}

        {!selectedProjectId ? (
          <p className="text-zinc-500 text-sm py-4 text-center">请先选择项目</p>
        ) : jobsLoading ? (
          <p className="text-zinc-500 text-sm py-4 text-center">加载中…</p>
        ) : publishJobs.length === 0 ? (
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
                {publishJobs.map((job) => (
                  <tr key={job.id} className="hover:bg-white/[0.02]">
                    <td className="py-2.5 pr-4 text-zinc-200">{job.platform}</td>
                    <td className="py-2.5 pr-4">
                      <GlassChip tone={statusTone(job.status)}>
                        {statusLabel(job.status)}
                      </GlassChip>
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
                    <td className="py-2.5 text-zinc-500 text-xs font-mono">
                      {shortId(job.id)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </GlassSurface>
    </div>
  );
}
