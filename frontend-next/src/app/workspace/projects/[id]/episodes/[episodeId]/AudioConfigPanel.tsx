"use client";

import { useState } from "react";
import { GlassSurface, GlassChip, GlassButton } from "@/components/ui/primitives";
import type { AudioConfig as AudioConfigType } from "@/lib/api-client";

// Props for the component
interface AudioConfigPanelProps {
  audioConfig?: {
    effective_config: AudioConfigType;
    config_sources: {
      project_default?: AudioConfigType;
      episode_override?: AudioConfigType;
      scene_override?: AudioConfigType;
    };
  };
  loading?: boolean;
  error?: string | null;
}

// 获取 provider 显示名称
function getProviderDisplayName(provider: string): string {
  const providerMap: Record<string, string> = {
    elevenlabs: "ElevenLabs",
    azure: "Azure TTS",
    google: "Google TTS",
    suno: "Suno",
    ElevenLabs: "ElevenLabs",
    Suno: "Suno",
  };
  return providerMap[provider] || provider;
}

// 获取 tier 来源显示
function getTierSourceDisplay(source: string | undefined): { text: string; tone: 'neutral' | 'info' | 'success' | 'warning' } {
  if (!source) return { text: '未知', tone: 'neutral' };
  
  const sourceMap: Record<string, { text: string; tone: 'neutral' | 'info' | 'success' | 'warning' }> = {
    'project_default': { text: '项目默认', tone: 'neutral' },
    'episode_override': { text: '剧集覆盖', tone: 'warning' },
    'scene_override': { text: '场景覆盖', tone: 'success' },
  };
  return sourceMap[source] || { text: source, tone: 'neutral' };
}

// Voice Config Display
function VoiceConfigDisplay({ config, source }: { config: AudioConfigType['voice']; source?: string }) {
  const sourceInfo = getTierSourceDisplay(source);
  
  return (
    <GlassSurface variant="panel" className="p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-zinc-500 font-medium">Voice</span>
        <GlassChip tone={sourceInfo.tone} className="text-xs">
          {sourceInfo.text}
        </GlassChip>
      </div>
      <div className="space-y-1 text-xs">
        <div className="flex justify-between">
          <span className="text-zinc-500">Provider</span>
          <span className="text-zinc-300">{getProviderDisplayName(config.provider)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-zinc-500">Voice ID</span>
          <span className="text-zinc-300">{config.voice_id}</span>
        </div>
        {config.params && (
          <>
            <div className="flex justify-between">
              <span className="text-zinc-500">Stability</span>
              <span className="text-zinc-300">{config.params.stability ?? '-'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">Similarity</span>
              <span className="text-zinc-300">{config.params.similarity_boost ?? '-'}</span>
            </div>
          </>
        )}
      </div>
    </GlassSurface>
  );
}

// BGM Config Display
function BGMConfigDisplay({ config, source }: { config: AudioConfigType['bgm']; source?: string }) {
  const sourceInfo = getTierSourceDisplay(source);
  
  return (
    <GlassSurface variant="panel" className="p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-zinc-500 font-medium">BGM</span>
        <GlassChip tone={sourceInfo.tone} className="text-xs">
          {sourceInfo.text}
        </GlassChip>
      </div>
      <div className="space-y-1 text-xs">
        <div className="flex justify-between">
          <span className="text-zinc-500">Provider</span>
          <span className="text-zinc-300">{getProviderDisplayName(config.provider)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-zinc-500">Style</span>
          <span className="text-zinc-300">{config.style ?? '-'}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-zinc-500">Volume</span>
          <span className="text-zinc-300">{config.volume ?? '-'}</span>
        </div>
      </div>
    </GlassSurface>
  );
}

// Mix Config Display
function MixConfigDisplay({ config }: { config: AudioConfigType['mix'] }) {
  return (
    <GlassSurface variant="panel" className="p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-zinc-500 font-medium">Mix</span>
      </div>
      <div className="space-y-1 text-xs">
        <div className="flex justify-between">
          <span className="text-zinc-500">Voice Volume</span>
          <span className="text-zinc-300">{config.voice_volume ?? '-'}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-zinc-500">BGM Volume</span>
          <span className="text-zinc-300">{config.bgm_volume ?? '-'}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-zinc-500">Sample Rate</span>
          <span className="text-zinc-300">{config.sample_rate ?? '-'}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-zinc-500">Format</span>
          <span className="text-zinc-300">{config.format ?? '-'}</span>
        </div>
      </div>
    </GlassSurface>
  );
}

export function AudioConfigPanel({ audioConfig, loading, error }: AudioConfigPanelProps) {
  const [expanded, setExpanded] = useState(true);

  if (loading) {
    return (
      <GlassSurface variant="elevated" className="p-4">
        <div className="text-sm text-zinc-500">加载音频配置...</div>
      </GlassSurface>
    );
  }

  if (error) {
    return (
      <GlassSurface variant="elevated" className="p-4">
        <div className="text-sm text-red-400">加载音频配置失败</div>
      </GlassSurface>
    );
  }

  if (!audioConfig) {
    return (
      <GlassSurface variant="elevated" className="p-4">
        <div className="text-sm text-zinc-500">音频配置面板</div>
        <div className="text-xs text-zinc-600 mt-1">暂无音频配置数据</div>
      </GlassSurface>
    );
  }

  const effectiveConfig = audioConfig.effective_config;
  const sources = audioConfig.config_sources;

  return (
    <GlassSurface variant="elevated" className="p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-zinc-200">音频配置</span>
          <GlassChip tone="info" className="text-xs">
            040b
          </GlassChip>
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-zinc-500 hover:text-zinc-300 transition-colors text-xs"
        >
          {expanded ? '收起' : '展开'}
        </button>
      </div>

      {expanded && (
        <div className="space-y-3">
          {/* 配置来源说明 */}
          <div className="text-xs text-zinc-500 mb-3">
            <span className="text-zinc-400 font-medium">配置继承</span>
            <span className="ml-2">project → episode → scene</span>
          </div>

          {/* 生效的配置 */}
          <div>
            <div className="text-xs text-zinc-500 mb-2 font-medium">生效配置</div>
            <div className="grid grid-cols-3 gap-2">
              <VoiceConfigDisplay config={effectiveConfig.voice} source="effective" />
              <BGMConfigDisplay config={effectiveConfig.bgm} source="effective" />
              <MixConfigDisplay config={effectiveConfig.mix} />
            </div>
          </div>

          {/* 配置来源详情 */}
          {sources && (
            <div className="mt-4 pt-3 border-t border-zinc-800/50">
              <div className="text-xs text-zinc-500 mb-2 font-medium">配置来源详情</div>
              <div className="grid grid-cols-3 gap-2 text-xs">
                {sources.project_default && (
                  <VoiceConfigDisplay config={sources.project_default.voice} source="project_default" />
                )}
                {sources.episode_override && (
                  <VoiceConfigDisplay config={sources.episode_override.voice} source="episode_override" />
                )}
                {sources.scene_override && (
                  <VoiceConfigDisplay config={sources.scene_override.voice} source="scene_override" />
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </GlassSurface>
  );
}