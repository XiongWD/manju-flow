"use client";

import { useState, useEffect, useCallback } from "react";
import {
  apiClient,
  type Project,
  type Episode,
  type Scene,
  type SceneVersion,
  type SubtitleEditResponse,
  type AudioMixEditResponse,
  type DeliveryPackage,
  type PublishJob,
} from "@/lib/api-client";

export function useDeliveryData() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [selectedEpisodeId, setSelectedEpisodeId] = useState<string>("");
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [selectedSceneId, setSelectedSceneId] = useState<string>("");
  const [sceneVersions, setSceneVersions] = useState<SceneVersion[]>([]);
  const [selectedVersionId, setSelectedVersionId] = useState<string>("");
  const [loading, setLoading] = useState(true);

  // Load projects
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

  // Load episodes when project changes
  useEffect(() => {
    if (!selectedProjectId) { setEpisodes([]); setSelectedEpisodeId(""); return; }
    (async () => {
      try {
        const data = await apiClient.listEpisodes({ project_id: selectedProjectId });
        setEpisodes(data.items);
      } catch (err) {
        console.error("Failed to load episodes", err);
      }
    })();
  }, [selectedProjectId]);

  // Load scenes + packages + jobs when episode changes
  useEffect(() => {
    if (!selectedEpisodeId) {
      setScenes([]); setSelectedSceneId(""); return;
    }
    const projectId = selectedProjectId;
    (async () => {
      try {
        const sceneData = await apiClient.listScenes({ episode_id: selectedEpisodeId });
        setScenes(sceneData.items);
        if (sceneData.items.length > 0) setSelectedSceneId(sceneData.items[0].id);
      } catch (err) {
        console.error("Failed to load scenes", err);
      }
    })();
  }, [selectedEpisodeId, selectedProjectId]);

  // Load scene versions when scene changes
  useEffect(() => {
    if (!selectedSceneId) { setSceneVersions([]); setSelectedVersionId(""); return; }
    (async () => {
      try {
        const data = await apiClient.listSceneVersions(selectedSceneId);
        setSceneVersions(data);
        if (data.length > 0) setSelectedVersionId(data[data.length - 1].id);
      } catch (err) {
        console.error("Failed to load versions", err);
      }
    })();
  }, [selectedSceneId]);

  return {
    projects, selectedProjectId, setSelectedProjectId,
    episodes, selectedEpisodeId, setSelectedEpisodeId,
    scenes, selectedSceneId, setSelectedSceneId,
    sceneVersions, selectedVersionId, setSelectedVersionId,
    loading,
  };
}

export function useSubtitleEditor(selectedSceneId: string, selectedVersionId: string) {
  const [data, setData] = useState<SubtitleEditResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!selectedSceneId || !selectedVersionId) return;
    setLoading(true);
    try {
      const result = await apiClient.getSceneSubtitle(selectedSceneId, selectedVersionId);
      setData(result);
    } catch { setData(null); } finally { setLoading(false); }
  }, [selectedSceneId, selectedVersionId]);

  useEffect(() => { load(); }, [load]);

  const save = useCallback(async () => {
    if (!selectedSceneId || !selectedVersionId || !data) return;
    setSaving(true);
    try {
      const result = await apiClient.updateSceneSubtitle(selectedSceneId, selectedVersionId, { cues: data.cues });
      setData(result);
    } catch (err) { console.error("Failed to save subtitle", err); } finally { setSaving(false); }
  }, [selectedSceneId, selectedVersionId, data]);

  const updateCueText = useCallback((index: number, newText: string) => {
    setData((prev) => {
      if (!prev) return prev;
      const cues = [...prev.cues];
      cues[index] = { ...cues[index], text: newText };
      return { ...prev, cues };
    });
  }, []);

  return { data, loading, saving, save, updateCueText, reload: load };
}

export function useAudioMixEditor(selectedSceneId: string, selectedVersionId: string) {
  const [data, setData] = useState<AudioMixEditResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [audioForm, setAudioForm] = useState({
    voice_volume: 1.0, bgm_volume: 0.3, bgm_fade_in: 1.0, bgm_fade_out: 2.0,
  });

  const load = useCallback(async () => {
    if (!selectedSceneId || !selectedVersionId) return;
    setLoading(true);
    try {
      const result = await apiClient.getSceneAudioMix(selectedSceneId, selectedVersionId);
      setData(result);
      setAudioForm({ voice_volume: result.voice_volume, bgm_volume: result.bgm_volume, bgm_fade_in: result.bgm_fade_in, bgm_fade_out: result.bgm_fade_out });
    } catch { setData(null); } finally { setLoading(false); }
  }, [selectedSceneId, selectedVersionId]);

  useEffect(() => { load(); }, [load]);

  const save = useCallback(async () => {
    if (!selectedSceneId || !selectedVersionId) return;
    setSaving(true);
    try {
      const result = await apiClient.updateSceneAudioMix(selectedSceneId, selectedVersionId, audioForm);
      setData(result);
    } catch (err) { console.error("Failed to save audio mix", err); } finally { setSaving(false); }
  }, [selectedSceneId, selectedVersionId, audioForm]);

  return { data, loading, saving, audioForm, setAudioForm, save, reload: load };
}

export function useDeliveryPackages(selectedEpisodeId: string) {
  const [packages, setPackages] = useState<DeliveryPackage[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!selectedEpisodeId) { setPackages([]); return; }
    setLoading(true);
    (async () => {
      try {
        const data = await apiClient.listDeliveryPackages({ episode_id: selectedEpisodeId });
        setPackages(data.items);
      } catch { setPackages([]); } finally { setLoading(false); }
    })();
  }, [selectedEpisodeId]);

  const createPackage = useCallback(async (packageType: DeliveryPackage["package_type"]) => {
    if (!selectedEpisodeId) return;
    try {
      await apiClient.createDeliveryPackage({ episode_id: selectedEpisodeId, package_type: packageType });
      const data = await apiClient.listDeliveryPackages({ episode_id: selectedEpisodeId });
      setPackages(data.items);
    } catch (err) { console.error("Failed to create package", err); }
  }, [selectedEpisodeId]);

  return { packages, loading, createPackage };
}

export function usePublishJobs(selectedProjectId: string, selectedEpisodeId: string) {
  const [jobs, setJobs] = useState<PublishJob[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!selectedProjectId) { setJobs([]); return; }
    setLoading(true);
    try {
      const data = await apiClient.listPublishJobs({ project_id: selectedProjectId, episode_id: selectedEpisodeId || undefined });
      setJobs(data.items);
    } catch { setJobs([]); } finally { setLoading(false); }
  }, [selectedProjectId, selectedEpisodeId]);

  useEffect(() => { load(); }, [load]);

  const createJob = useCallback(async (platform: string) => {
    if (!selectedProjectId) return;
    try {
      await apiClient.createPublishJob({ project_id: selectedProjectId, episode_id: selectedEpisodeId || undefined, platform });
      await load();
    } catch (err) { console.error("Failed to create publish job", err); }
  }, [selectedProjectId, selectedEpisodeId, load]);

  return { jobs, loading, createJob };
}
