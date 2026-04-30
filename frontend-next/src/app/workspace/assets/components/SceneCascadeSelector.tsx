"use client";

import { useState, useEffect, useCallback } from "react";
import GlassSurface from "@/components/ui/primitives/GlassSurface";
import GlassButton from "@/components/ui/primitives/GlassButton";
import GlassChip from "@/components/ui/primitives/GlassChip";
import { apiClient, type Episode, type Scene, type SceneVersion } from "@/lib/api-client";

interface SceneCascadeSelectorProps {
  projectId?: string;
  selectedVersionId: string | null;
  onSelectVersion: (versionId: string | null) => void;
  onClear: () => void;
}

export default function SceneCascadeSelector({
  projectId,
  selectedVersionId,
  onSelectVersion,
  onClear,
}: SceneCascadeSelectorProps) {
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [selectedEpisodeId, setSelectedEpisodeId] = useState<string | null>(null);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null);
  const [versions, setVersions] = useState<SceneVersion[]>([]);
  const [cascadeLoading, setCascadeLoading] = useState(false);

  const fetchEpisodes = useCallback(async () => {
    if (!projectId) { setEpisodes([]); setSelectedEpisodeId(null); return; }
    try {
      setCascadeLoading(true);
      const data = await apiClient.listEpisodes({ project_id: projectId });
      setEpisodes(data.items);
      if (data.items.length > 0 && !selectedEpisodeId) setSelectedEpisodeId(data.items[0].id);
      else if (data.items.length === 0) setSelectedEpisodeId(null);
    } catch (e) { console.error("加载剧集失败:", e); }
    finally { setCascadeLoading(false); }
  }, [projectId, selectedEpisodeId]);

  const fetchScenes = useCallback(async () => {
    if (!selectedEpisodeId) { setScenes([]); setSelectedSceneId(null); return; }
    try {
      setCascadeLoading(true);
      const data = await apiClient.listScenes({ episode_id: selectedEpisodeId });
      setScenes(data.items);
      if (data.items.length > 0 && !selectedSceneId) setSelectedSceneId(data.items[0].id);
      else if (data.items.length === 0) setSelectedSceneId(null);
    } catch (e) { console.error("加载场景失败:", e); }
    finally { setCascadeLoading(false); }
  }, [selectedEpisodeId, selectedSceneId]);

  const fetchVersions = useCallback(async () => {
    if (!selectedSceneId) { setVersions([]); onSelectVersion(null); return; }
    try {
      setCascadeLoading(true);
      const data = await apiClient.listSceneVersions(selectedSceneId);
      setVersions(data);
      if (data.length > 0) onSelectVersion(data[data.length - 1].id);
      else onSelectVersion(null);
    } catch (e) { console.error("加载版本失败:", e); }
    finally { setCascadeLoading(false); }
  }, [selectedSceneId, onSelectVersion]);

  useEffect(() => { void fetchEpisodes(); }, [fetchEpisodes]);
  useEffect(() => { void fetchScenes(); }, [fetchScenes]);
  useEffect(() => { void fetchVersions(); }, [fetchVersions]);

  const handleSelectEpisode = (id: string) => {
    setSelectedEpisodeId(id); setSelectedSceneId(null); onSelectVersion(null); setScenes([]); setVersions([]);
  };
  const handleSelectScene = (id: string) => {
    setSelectedSceneId(id); onSelectVersion(null); setVersions([]);
  };

  const handleClearCascade = () => {
    setSelectedEpisodeId(null); setSelectedSceneId(null); onSelectVersion(null);
    setEpisodes([]); setScenes([]); setVersions([]); onClear();
  };

  if (!projectId) return null;

  return (
    <GlassSurface variant="panel" padded>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-zinc-200">场景版本导航</h2>
        {selectedVersionId && (
          <GlassButton variant="ghost" size="sm" onClick={handleClearCascade}>清除选择</GlassButton>
        )}
      </div>
      {cascadeLoading && episodes.length === 0 ? (
        <p className="text-xs text-zinc-500">加载中...</p>
      ) : episodes.length === 0 ? (
        <p className="text-xs text-zinc-500">该项目暂无剧集数据</p>
      ) : (
        <div className="space-y-3">
          <div>
            <span className="mb-1.5 block text-xs text-zinc-500">集</span>
            <div className="flex flex-wrap gap-1.5">
              {episodes.map((ep) => (
                <GlassChip key={ep.id} tone={selectedEpisodeId === ep.id ? "info" : "neutral"} className="cursor-pointer" onRemove={undefined}>
                  <button onClick={() => handleSelectEpisode(ep.id)} className="text-xs">
                    E{ep.episode_no}{ep.title ? ` · ${ep.title}` : ""}
                  </button>
                </GlassChip>
              ))}
            </div>
          </div>
          {selectedEpisodeId && scenes.length > 0 && (
            <div>
              <span className="mb-1.5 block text-xs text-zinc-500">场景</span>
              <div className="flex flex-wrap gap-1.5">
                {scenes.map((s) => (
                  <GlassChip key={s.id} tone={selectedSceneId === s.id ? "info" : "neutral"} className="cursor-pointer" onRemove={undefined}>
                    <button onClick={() => handleSelectScene(s.id)} className="text-xs">
                      S{String(s.scene_no).padStart(2, "0")}{s.title ? ` · ${s.title}` : ""}
                    </button>
                  </GlassChip>
                ))}
              </div>
            </div>
          )}
          {selectedSceneId && versions.length > 0 && (
            <div>
              <span className="mb-1.5 block text-xs text-zinc-500">版本</span>
              <div className="flex flex-wrap gap-1.5">
                {versions.map((v) => {
                  const isLatest = v === versions[versions.length - 1];
                  return (
                    <GlassChip key={v.id} tone={selectedVersionId === v.id ? "success" : "neutral"} className="cursor-pointer" onRemove={undefined}>
                      <button onClick={() => onSelectVersion(v.id)} className="text-xs font-mono">
                        v{v.version_no}{isLatest ? " (最新)" : ""}
                      </button>
                    </GlassChip>
                  );
                })}
              </div>
            </div>
          )}
          {selectedVersionId && (
            <p className="text-xs text-zinc-400">✓ 已选择版本，资产列表已过滤</p>
          )}
          {selectedSceneId && versions.length === 0 && !cascadeLoading && (
            <p className="text-xs text-zinc-500">该场景暂无版本</p>
          )}
        </div>
      )}
    </GlassSurface>
  );
}
