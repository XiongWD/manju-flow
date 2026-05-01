"use client";

import { GlassSurface, GlassChip, GlassButton, GlassField, GlassInput } from "@/components/ui/primitives";
import { Scene, SceneVersion, QARun, QARunDetail, SubtitleCue } from "@/lib/api-client";
import { getStatusTone, getJobStatusText, formatBytes, formatDateTime } from "./components/utils";
import { SceneStatusBadge, VersionStatusBadge, TaskStatusMini, LockStatusBadge } from "./components/badges";
import { useSceneList, PreviewAsset } from "./components/hooks/useSceneList";
import { SceneDialogs } from "./components/SceneDialogs";

interface SceneListProps {
  scenes: Scene[];
  projectId: string;
  episodeId: string;
  episodeEffectiveTier?: string;
  episodeTierSource?: string;
}

export function SceneList({ scenes, projectId, episodeId, episodeEffectiveTier, episodeTierSource }: SceneListProps) {
  const {
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
    editingScene, setEditingScene,
    editForm, setEditForm,
    editSubmitting,
    editError,
    deletingScene, setDeletingScene,
    deleteSubmitting,
    deleteError,
    retryingScene, setRetryingScene,
    retrySubmitting,
    retryError,
    retrySuccess, setRetrySuccess,
    viewingJob, setViewingJob,
    loadingJob,
    jobError,
    recentJobs,
    loadingRecentJobs,
    recentJobsError,
    refreshingRecentJobs,
    lockingScene, setLockingScene,
    lockSubmitting,
    lockError,
    lockSuccess, setLockSuccess,
    reworkingVersion, setReworkingVersion,
    reworkReason, setReworkReason,
    reworkSubmitting,
    reworkError,
    reworkSuccess, setReworkSuccess,
    diffMode,
    diffVersionAId, setDiffVersionAId,
    diffVersionBId, setDiffVersionBId,
    versionDiff,
    loadingDiff,
    diffError,
    subtitleCues,
    editingSubtitle, setEditingSubtitle,
    subtitleSaving,
    subtitleError,
    loadingSubtitle,
    audioMixData,
    editingAudioMix, setEditingAudioMix,
    audioMixForm, setAudioMixForm,
    audioMixSaving,
    audioMixError,
    loadingAudioMix,
    switchingLocked, setSwitchingLocked,
    switchSubmitting,
    switchError,
    switchSuccess, setSwitchSuccess,
    versionQARun,
    versionQARuns,
    loadingQA,
    refreshingQA,
    qaError,
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
  } = useSceneList({ projectId, episodeId });

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
                  {steps.indexOf(step) + 1}
                </div>
                
                {/* 步骤名称和状态 */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-zinc-300 truncate">{step.step_key ?? step.tool_name ?? step.id.slice(0, 8)}</span>
                    <GlassChip tone={stepTone} className="text-xs">
                      {getJobStatusText(stepStatus)}
                    </GlassChip>
                  </div>
                  {step.error_message && (
                    <div className="text-xs text-red-400 mt-1 truncate">
                      {step.error_message}
                    </div>
                  )}
                  {step.output_json ? (
                    <div className="text-xs text-zinc-500 mt-1 truncate">
                      输出：{JSON.stringify(step.output_json)}
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

      <SceneDialogs
        editingScene={editingScene} setEditingScene={setEditingScene}
        editForm={editForm} setEditForm={setEditForm}
        editSubmitting={editSubmitting} editError={editError}
        handleEditSubmit={handleEditSubmit}
        deletingScene={deletingScene} setDeletingScene={setDeletingScene}
        deleteSubmitting={deleteSubmitting} deleteError={deleteError}
        handleDeleteConfirm={handleDeleteConfirm}
        retryingScene={retryingScene} setRetryingScene={setRetryingScene}
        retrySubmitting={retrySubmitting} retryError={retryError}
        retrySuccess={retrySuccess} setRetrySuccess={setRetrySuccess}
        handleRetryConfirm={handleRetryConfirm}
        lockingScene={lockingScene} setLockingScene={setLockingScene}
        lockSubmitting={lockSubmitting} lockError={lockError}
        lockSuccess={lockSuccess} setLockSuccess={setLockSuccess}
        handleLockVersionConfirm={handleLockVersionConfirm}
        reworkingVersion={reworkingVersion} setReworkingVersion={setReworkingVersion}
        reworkReason={reworkReason} setReworkReason={setReworkReason}
        reworkSubmitting={reworkSubmitting} reworkError={reworkError}
        reworkSuccess={reworkSuccess} setReworkSuccess={setReworkSuccess}
        handleReworkConfirm={handleReworkConfirm}
        previewingScene={previewingScene}
        switchingLocked={switchingLocked} setSwitchingLocked={setSwitchingLocked}
        switchSubmitting={switchSubmitting} switchError={switchError}
        switchSuccess={switchSuccess} setSwitchSuccess={setSwitchSuccess}
        handleSwitchLockedConfirm={handleSwitchLockedConfirm}
        diffMode={diffMode}
        diffVersionAId={diffVersionAId} setDiffVersionAId={setDiffVersionAId}
        diffVersionBId={diffVersionBId} setDiffVersionBId={setDiffVersionBId}
        versionDiff={versionDiff} loadingDiff={loadingDiff} diffError={diffError}
        handleDiffRun={handleDiffRun} sceneVersions={sceneVersions}
        viewingJob={viewingJob} setViewingJob={setViewingJob}
        loadingJob={loadingJob} jobError={jobError}
        handleRefreshJobDetail={handleRefreshJobDetail}
        handleViewJob={handleViewJob}
        selectedVersion={selectedVersion}
      />
    </div>
  );
}
