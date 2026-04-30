"use client";

import GlassSurface from "@/components/ui/primitives/GlassSurface";
import GlassButton from "@/components/ui/primitives/GlassButton";
import GlassField from "@/components/ui/primitives/GlassField";
import { type AudioMixEditResponse } from "@/lib/api-client";

interface AudioMixEditorProps {
  data: AudioMixEditResponse | null;
  loading: boolean;
  saving: boolean;
  audioForm: {
    voice_volume: number;
    bgm_volume: number;
    bgm_fade_in: number;
    bgm_fade_out: number;
  };
  onFormChange: (updater: (prev: AudioMixEditorProps["audioForm"]) => AudioMixEditorProps["audioForm"]) => void;
  onSave: () => void;
}

export default function AudioMixEditor({
  data,
  loading,
  saving,
  audioForm,
  onFormChange,
  onSave,
}: AudioMixEditorProps) {
  return (
    <GlassSurface variant="panel">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-zinc-100">音频混音</h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            调整人声与背景音乐的音量平衡和淡入淡出参数。数值范围 0.0~2.0，1.0 为原始音量。修改后点击「保存混音」提交。
          </p>
        </div>
        <GlassButton variant="primary" size="sm" loading={saving} onClick={onSave}>
          保存混音
        </GlassButton>
      </div>

      {loading ? (
        <p className="text-zinc-500 text-sm py-8 text-center">加载混音数据…</p>
      ) : !data ? (
        <p className="text-zinc-500 text-sm py-8 text-center">该版本暂无混音数据</p>
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
                  onFormChange((f) => ({ ...f, voice_volume: parseFloat(e.target.value) }))
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
                  onFormChange((f) => ({ ...f, bgm_volume: parseFloat(e.target.value) }))
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
                  onFormChange((f) => ({ ...f, bgm_fade_in: parseFloat(e.target.value) }))
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
                  onFormChange((f) => ({ ...f, bgm_fade_out: parseFloat(e.target.value) }))
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
  );
}
