"use client";

import { useState } from "react";
import GlassSurface from "@/components/ui/primitives/GlassSurface";
import GlassButton from "@/components/ui/primitives/GlassButton";
import GlassInput from "@/components/ui/primitives/GlassInput";
import { type SubtitleEditResponse } from "@/lib/api-client";
import { formatTime } from "./helpers";

interface SubtitleEditorProps {
  data: SubtitleEditResponse | null;
  loading: boolean;
  saving: boolean;
  onSave: () => void;
  onCueTextChange: (index: number, newText: string) => void;
}

export default function SubtitleEditor({
  data,
  loading,
  saving,
  onSave,
  onCueTextChange,
}: SubtitleEditorProps) {
  const [editingCueIndex, setEditingCueIndex] = useState<number | null>(null);
  const [editingCueText, setEditingCueText] = useState("");

  const startEditCue = (index: number) => {
    setEditingCueIndex(index);
    setEditingCueText(data?.cues[index].text ?? "");
  };

  const confirmEditCue = () => {
    if (editingCueIndex !== null) {
      onCueTextChange(editingCueIndex, editingCueText);
    }
    setEditingCueIndex(null);
  };

  return (
    <GlassSurface variant="panel">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-zinc-100">字幕编辑</h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            对当前场景版本的字幕进行逐条编辑。点击字幕文案可内联修改，修改后点击「保存字幕」提交。字幕数据来源于渲染流程自动生成的
            SRT。
          </p>
        </div>
        <GlassButton variant="primary" size="sm" loading={saving} onClick={onSave}>
          保存字幕
        </GlassButton>
      </div>

      {loading ? (
        <p className="text-zinc-500 text-sm py-8 text-center">加载字幕…</p>
      ) : !data ? (
        <p className="text-zinc-500 text-sm py-8 text-center">该版本暂无字幕数据</p>
      ) : (
        <div className="space-y-1 max-h-[500px] overflow-y-auto pr-1">
          {data.cues.map((cue, idx) => (
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
          {data.cues.length === 0 && (
            <p className="text-zinc-500 text-sm py-4 text-center">暂无字幕条目</p>
          )}
        </div>
      )}
    </GlassSurface>
  );
}
