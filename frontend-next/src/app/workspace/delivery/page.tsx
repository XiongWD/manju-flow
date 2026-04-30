"use client";

import GlassEmptyState from "@/components/ui/primitives/GlassEmptyState";
import { ListSkeleton } from "@/components/Skeleton";
import {
  useDeliveryData,
  useSubtitleEditor,
  useAudioMixEditor,
  useDeliveryPackages,
  usePublishJobs,
} from "./components/useDeliveryHooks";
import DeliveryFlowGuide from "./components/DeliveryFlowGuide";
import SceneCascadeSelector from "./components/SceneCascadeSelector";
import SubtitleEditor from "./components/SubtitleEditor";
import AudioMixEditor from "./components/AudioMixEditor";
import DeliveryPackagesPanel from "./components/DeliveryPackagesPanel";
import PublishJobsPanel from "./components/PublishJobsPanel";

export default function DeliveryPage() {
  const {
    projects, selectedProjectId, setSelectedProjectId,
    episodes, selectedEpisodeId, setSelectedEpisodeId,
    scenes, selectedSceneId, setSelectedSceneId,
    sceneVersions, selectedVersionId, setSelectedVersionId,
    loading,
  } = useDeliveryData();

  const subtitle = useSubtitleEditor(selectedSceneId, selectedVersionId);
  const audioMix = useAudioMixEditor(selectedSceneId, selectedVersionId);
  const delivery = useDeliveryPackages(selectedEpisodeId);
  const publish = usePublishJobs(selectedProjectId, selectedEpisodeId);

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 p-4 md:p-6 lg:p-8">
        <ListSkeleton count={4} />
      </div>
    );
  }

  const emptyTitle = projects.length === 0
    ? "暂无项目"
    : !selectedProjectId
      ? "请先选择一个项目"
      : !selectedEpisodeId
        ? "请选择一个剧集"
        : "请选择一个场景和版本";
  const emptyDesc = projects.length === 0
    ? "请先创建项目后再进入剪辑与交付工作台。"
    : !selectedProjectId
      ? "选定项目后，才能加载对应剧集、场景与版本。"
      : !selectedEpisodeId
        ? "先选中剧集，再继续进行字幕、混音与交付操作。"
        : "选中具体场景与版本后，即可开始字幕编辑与音频混音。";

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-zinc-100">剪辑与交付</h1>
        <p className="text-zinc-400 mt-1 text-sm">
          后期工作台 — 在渲染完成并通过质检后，在此进行字幕精编、音频混音调整，然后按剧集/场景生成交付包（剪辑包、审片包、发布包），最终提交到目标平台发布。
        </p>
      </div>

      {/* Flow guide (shown when no project selected) */}
      {!selectedProjectId && <DeliveryFlowGuide />}

      {/* Cascade selectors */}
      <SceneCascadeSelector
        projects={projects} selectedProjectId={selectedProjectId} onProjectChange={setSelectedProjectId}
        episodes={episodes} selectedEpisodeId={selectedEpisodeId} onEpisodeChange={setSelectedEpisodeId}
        scenes={scenes} selectedSceneId={selectedSceneId} onSceneChange={setSelectedSceneId}
        sceneVersions={sceneVersions} selectedVersionId={selectedVersionId} onVersionChange={setSelectedVersionId}
      />

      {/* Main content: subtitle + audio mix, or empty state */}
      {!selectedSceneId || !selectedVersionId ? (
        <GlassEmptyState title={emptyTitle} description={emptyDesc} />
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <SubtitleEditor
            data={subtitle.data} loading={subtitle.loading} saving={subtitle.saving}
            onSave={subtitle.save} onCueTextChange={subtitle.updateCueText}
          />
          <AudioMixEditor
            data={audioMix.data} loading={audioMix.loading} saving={audioMix.saving}
            audioForm={audioMix.audioForm} onFormChange={audioMix.setAudioForm} onSave={audioMix.save}
          />
        </div>
      )}

      {/* Delivery packages */}
      <DeliveryPackagesPanel
        selectedEpisodeId={selectedEpisodeId} packages={delivery.packages}
        loading={delivery.loading} onCreatePackage={delivery.createPackage}
      />

      {/* Publish jobs */}
      <PublishJobsPanel
        selectedProjectId={selectedProjectId} jobs={publish.jobs}
        loading={publish.loading} onCreateJob={publish.createJob}
      />
    </div>
  );
}
