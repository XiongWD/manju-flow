"use client";

import GlassSurface from "@/components/ui/primitives/GlassSurface";
import GlassField from "@/components/ui/primitives/GlassField";
import { type Project, type Episode, type Scene, type SceneVersion } from "@/lib/api-client";
import { shortId } from "./helpers";

interface SceneCascadeSelectorProps {
  projects: Project[];
  selectedProjectId: string;
  onProjectChange: (id: string) => void;
  episodes: Episode[];
  selectedEpisodeId: string;
  onEpisodeChange: (id: string) => void;
  scenes: Scene[];
  selectedSceneId: string;
  onSceneChange: (id: string) => void;
  sceneVersions: SceneVersion[];
  selectedVersionId: string;
  onVersionChange: (id: string) => void;
}

export default function SceneCascadeSelector({
  projects,
  selectedProjectId,
  onProjectChange,
  episodes,
  selectedEpisodeId,
  onEpisodeChange,
  scenes,
  selectedSceneId,
  onSceneChange,
  sceneVersions,
  selectedVersionId,
  onVersionChange,
}: SceneCascadeSelectorProps) {
  return (
    <GlassSurface variant="panel" density="compact">
      <div className="flex flex-wrap items-end gap-4">
        <GlassField label="项目" className="min-w-[180px]">
          <select
            className="glass-input-base h-10 px-3 text-sm"
            value={selectedProjectId}
            onChange={(e) => onProjectChange(e.target.value)}
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
            onChange={(e) => onEpisodeChange(e.target.value)}
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
            onChange={(e) => onSceneChange(e.target.value)}
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
              onChange={(e) => onVersionChange(e.target.value)}
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
  );
}
