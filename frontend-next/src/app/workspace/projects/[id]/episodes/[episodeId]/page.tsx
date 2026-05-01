'use client';

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { GlassSurface, GlassChip } from "@/components/ui/primitives";
import { apiClient, EpisodeWithScenes, AssetWithLinks, EpisodeAudioConfig, EpisodeAudioAssets, QAEvidenceAssets, RulesReportResponse } from "@/lib/api-client";
import { SceneList } from "./SceneList";
import { SceneCreateForm } from "./SceneCreateForm";

function EpisodeDetailContent({
  episode,
  currentCutAsset,
  audioConfig,
  audioAssets,
  qaEvidenceAssets,
  rulesReport,
}: {
  episode: EpisodeWithScenes;
  currentCutAsset: AssetWithLinks | null;
  audioConfig: EpisodeAudioConfig | null;
  audioAssets: EpisodeAudioAssets | null;
  qaEvidenceAssets: QAEvidenceAssets | null;
  rulesReport: RulesReportResponse | null;
}) {
  const scenes = episode.scenes || [];

  // 从 asset_id 中提取简短标识（取前 8 位）
  const currentCutAssetShort = episode.current_cut_asset_id
    ? `#${episode.current_cut_asset_id.slice(0, 8)}`
    : null;

  // 格式化时间显示
  const formatTimeAgo = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "刚刚";
    if (diffMins < 60) return `${diffMins}分钟前`;
    if (diffHours < 24) return `${diffHours}小时前`;
    if (diffDays < 7) return `${diffDays}天前`;
    return date.toLocaleDateString('zh-CN');
  };

  // 获取类型显示名称
  const getTypeDisplayName = (type: string) => {
    const typeMap: Record<string, string> = {
      'video': '视频',
      'audio': '音频',
      'image': '图片',
      'document': '文档',
      'subtitle': '字幕',
    };
    return typeMap[type] || type;
  };

  return (
    <div className="space-y-6">
      {/* Episode Info */}
      <GlassSurface variant="elevated" className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-zinc-100 mb-2">
              {episode.title}
            </h2>
            <p className="text-sm text-zinc-500">第 {episode.episode_no} 集</p>
          </div>
          <span
            className={`text-sm px-3 py-1 rounded-full ${
              episode.status === "IN_PRODUCTION"
                ? "bg-blue-900/30 text-blue-400"
                : "bg-zinc-800 text-zinc-400"
            }`}
          >
            {episode.status}
          </span>
        </div>

        {/* 当前剪辑版（只读展示） */}
        {currentCutAssetShort && (
          <div className="mt-4 pt-4 border-t border-zinc-800/50">
            <div className="text-xs text-zinc-500 mb-2">当前剪辑版</div>
            <div className="flex items-center gap-2 flex-wrap">
              <GlassChip tone="success" className="text-xs">
                {currentCutAssetShort}
              </GlassChip>
              {currentCutAsset && (
                <>
                  <GlassChip tone="neutral" className="text-xs text-zinc-400">
                    {getTypeDisplayName(currentCutAsset.type)}
                  </GlassChip>
                  <span className="text-xs text-zinc-500">
                    {formatTimeAgo(currentCutAsset.created_at)}
                  </span>
                  {currentCutAsset.uri ? (
                    <a
                      href={currentCutAsset.uri}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block text-xs text-violet-400 hover:underline"
                    >
                      打开资源
                    </a>
                  ) : (
                    <span className="text-xs text-zinc-600">无可访问链接</span>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {episode.outline && (
          <div className="mt-4 pt-4 border-t border-zinc-800/50">
            <div className="text-xs text-zinc-500 mb-2">剧情大纲</div>
            <p className="text-sm text-zinc-300">{episode.outline}</p>
          </div>
        )}

        {episode.script && (
          <div className="mt-4 pt-4 border-t border-zinc-800/50">
            <div className="text-xs text-zinc-500 mb-2">剧本内容</div>
            <p className="text-sm text-zinc-300 whitespace-pre-wrap">
              {episode.script}
            </p>
          </div>
        )}

        {/* Task center 占位入口 */}
        <div className="mt-6 pt-4 border-t border-zinc-800/50">
          <div className="flex items-center justify-between">
            <span className="text-sm text-zinc-500">Task center</span>
            <GlassChip tone="neutral" className="text-xs text-zinc-500">
              待补强
            </GlassChip>
          </div>
          <p className="text-xs text-zinc-600 mt-2">后续开放：统一任务管理与工作台视图，集中监控项目执行状态</p>
        </div>

        {/* Shot preparation 占位入口 */}
        <div className="mt-6 pt-4 border-t border-zinc-800/50">
          <div className="flex items-center justify-between">
            <span className="text-sm text-zinc-500">Shot preparation</span>
            <GlassChip tone="neutral" className="text-xs text-zinc-500">
              待补强
            </GlassChip>
          </div>
          <p className="text-xs text-zinc-600 mt-2">后续开放：统一入口管理场景的前期准备工作与任务流程</p>
        </div>

        {/* 发布功能占位入口 */}
        <div className="mt-6 pt-4 border-t border-zinc-800/50">
          <div className="flex items-center justify-between">
            <span className="text-sm text-zinc-500">发布功能</span>
            <GlassChip tone="neutral" className="text-xs text-zinc-500">
              待后端接通
            </GlassChip>
          </div>
          <p className="text-xs text-zinc-600 mt-2">发布模块暂未开放，敬请期待</p>
        </div>

        {/* 最小音频信息面板 */}
        <div className="mt-6 pt-4 border-t border-zinc-800/50">
          <div className="text-xs text-zinc-500 mb-3">音频配置</div>
          <GlassSurface variant="panel" className="p-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              {/* Voice 配置 */}
              <div className="flex flex-col">
                <span className="text-zinc-500 text-xs">Voice Provider</span>
                <span className="text-zinc-300">{audioConfig?.effective_config?.voice?.provider || '-'}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-zinc-500 text-xs">Voice ID</span>
                <span className="text-zinc-300">{audioConfig?.effective_config?.voice?.voice_id || '-'}</span>
              </div>
              {/* BGM 配置 */}
              <div className="flex flex-col">
                <span className="text-zinc-500 text-xs">BGM Provider</span>
                <span className="text-zinc-300">{audioConfig?.effective_config?.bgm?.provider || '-'}</span>
              </div>
              {/* Mix 参数 */}
              <div className="flex flex-col">
                <span className="text-zinc-500 text-xs">Mix 参数</span>
                <span className="text-zinc-300">
                  voice:{audioConfig?.effective_config?.mix?.voice_volume ?? '-'} bgm:{audioConfig?.effective_config?.mix?.bgm_volume ?? '-'}
                </span>
              </div>
            </div>
            {/* 最近音频资产入口 */}
            <div className="mt-4 pt-3 border-t border-zinc-700">
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-500">最近音频资产</span>
                {audioAssets?.mixed_audio_assets?.[0]?.uri ? (
                  <a
                    href={audioAssets.mixed_audio_assets[0].uri}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-violet-400 hover:underline"
                  >
                    打开 →
                  </a>
                ) : (
                  <span className="text-xs text-zinc-600">暂无</span>
                )}
              </div>
            </div>
            {/* QA Evidence 入口 */}
            <div className="mt-3 pt-3 border-t border-zinc-700">
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-500">QA Evidence</span>
                {qaEvidenceAssets?.evidence_assets?.[0]?.uri ? (
                  <a
                    href={qaEvidenceAssets.evidence_assets[0].uri}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-violet-400 hover:underline"
                  >
                    打开 →
                  </a>
                ) : (
                  <span className="text-xs text-zinc-600">暂无</span>
                )}
              </div>
            </div>
          </GlassSurface>
        </div>
      </GlassSurface>

      {/* Rules Report — 041a.4 最小闭环 */}
      <GlassSurface variant="elevated" className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-zinc-100 mb-1">Rules Report</h2>
            <p className="text-xs text-zinc-500">平台合规规则检测 · BLOCK / FLAG / MANUAL_REVIEW_REQUIRED</p>
          </div>
          {rulesReport ? (
            <div className="flex items-center gap-2">
              {rulesReport.summary.block_count > 0 && (
                <GlassChip tone="danger" className="text-xs">
                  🚫 BLOCK ×{rulesReport.summary.block_count}
                </GlassChip>
              )}
              {rulesReport.summary.flag_count > 0 && (
                <GlassChip tone="warning" className="text-xs">
                  ⚠️ FLAG ×{rulesReport.summary.flag_count}
                </GlassChip>
              )}
              {rulesReport.summary.manual_review_count > 0 && (
                <GlassChip tone="info" className="text-xs">
                  👁 MANUAL_REVIEW ×{rulesReport.summary.manual_review_count}
                </GlassChip>
              )}
              {rulesReport.summary.failed === 0 && rulesReport.summary.total > 0 && (
                <GlassChip tone="success" className="text-xs">
                  ✓ ALL PASSED
                </GlassChip>
              )}
            </div>
          ) : (
            <GlassChip tone="neutral" className="text-xs text-zinc-500">
              待后端接通
            </GlassChip>
          )}
        </div>

        {!rulesReport || rulesReport.results.length === 0 ? (
          <div className="text-sm text-zinc-500">
            {rulesReport
              ? '所有规则已通过，无违规项'
              : '规则报告尚未生成 — 041a.4 后端 API 就绪后自动展示'
            }
          </div>
        ) : (
          <div className="space-y-2 max-h-[50vh] overflow-y-auto">
            {rulesReport.results.map((r, idx) => (
              <div
                key={`${r.rule_id}-${r.subject_id}-${idx}`}
                className={`p-3 rounded-lg border ${
                  r.passed
                    ? 'bg-zinc-900/40 border-zinc-800/50'
                    : r.severity === 'BLOCK'
                      ? 'bg-red-900/20 border-red-800/50'
                      : 'bg-amber-900/20 border-amber-800/50'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <GlassChip
                        tone={
                          r.passed
                            ? 'success'
                            : r.severity === 'BLOCK'
                              ? 'danger'
                              : 'warning'
                        }
                        className="text-xs"
                      >
                        {r.passed ? 'PASS' : r.severity}
                      </GlassChip>
                      {r.manual_review_required && (
                        <GlassChip tone="info" className="text-xs">
                          MANUAL_REVIEW_REQUIRED
                        </GlassChip>
                      )}
                      <span className="text-xs text-zinc-400 font-mono">{r.rule_id}</span>
                      <span className="text-xs text-zinc-500">· {r.platform}</span>
                    </div>
                    <div className="text-sm text-zinc-300">
                      {r.failure_reason || '—'}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-zinc-500">
                      <span>对象: {r.subject_type} #{r.subject_id.slice(0, 8)}</span>
                      <span>检查: {r.auto_checkable ? '自动' : '手动'}</span>
                      {r.qa_run_id && (
                        <span className="text-violet-400">
                          QA Run: #{r.qa_run_id.slice(0, 8)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </GlassSurface>

      {/* Create Scene Form */}
      <SceneCreateForm episodeId={episode.id} />

      {/* Scenes List */}
      <SceneList
        scenes={scenes}
        projectId={episode.project_id}
        episodeId={episode.id}
        episodeEffectiveTier={episode.effective_tier}
        episodeTierSource={episode.tier_source}
      />
    </div>
  );
}

function EpisodeDetail({ projectId, episodeId }: { projectId: string; episodeId: string }) {
  const [episode, setEpisode] = useState<EpisodeWithScenes | null>(null);
  const [currentCutAsset, setCurrentCutAsset] = useState<AssetWithLinks | null>(null);
  const [audioConfig, setAudioConfig] = useState<EpisodeAudioConfig | null>(null);
  const [audioAssets, setAudioAssets] = useState<EpisodeAudioAssets | null>(null);
  const [qaEvidenceAssets, setQaEvidenceAssets] = useState<QAEvidenceAssets | null>(null);
  const [rulesReport, setRulesReport] = useState<RulesReportResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const ep = await apiClient.get<EpisodeWithScenes>(`episodes/${episodeId}`);
        if (!ep) { setError('剧集未找到'); setLoading(false); return; }
        setEpisode(ep);

        if (ep.current_cut_asset_id) {
          try { setCurrentCutAsset(await apiClient.getAsset(ep.current_cut_asset_id)); } catch {}
        }
        try {
          const [ac, aa, qa, rr] = await Promise.all([
            apiClient.getEpisodeAudioConfig(episodeId),
            apiClient.getEpisodeAudioAssets(episodeId),
            apiClient.getEpisodeQAEvidenceAssets(episodeId),
            apiClient.getEpisodeRulesReport(episodeId).catch(() => null),
          ]);
          setAudioConfig(ac);
          setAudioAssets(aa);
          setQaEvidenceAssets(qa);
          setRulesReport(rr);
        } catch {}
      } catch (e) {
        setError(e instanceof Error ? e.message : '加载失败');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [episodeId]);

  if (loading) return <div className="flex items-center justify-center py-12"><div className="text-zinc-500">加载中...</div></div>;
  if (error || !episode) return <GlassSurface variant="elevated" className="p-6"><p className="text-zinc-400">{error || '剧集未找到'}</p></GlassSurface>;

  return (
    <EpisodeDetailContent
      episode={episode}
      currentCutAsset={currentCutAsset}
      audioConfig={audioConfig}
      audioAssets={audioAssets}
      qaEvidenceAssets={qaEvidenceAssets}
      rulesReport={rulesReport}
    />
  );
}

export default function EpisodeDetailPage({
  params,
}: {
  params: Promise<{ id: string; episodeId: string }>;
}) {
  const { id, episodeId } = use(params);

  return (
    <div className="p-6">
      <div className="mb-6">
        <Link
          href={`/workspace/projects/${id}`}
          className="text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
        >
          ← 返回项目详情
        </Link>
      </div>
      <EpisodeDetail projectId={id} episodeId={episodeId} />
    </div>
  );
}
