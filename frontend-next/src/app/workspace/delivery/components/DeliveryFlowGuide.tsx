"use client";

import GlassSurface from "@/components/ui/primitives/GlassSurface";

export default function DeliveryFlowGuide() {
  return (
    <GlassSurface variant="panel" className="!p-5 space-y-4">
      <h2 className="text-sm font-semibold text-white">📋 交付流程说明</h2>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
        <div className="bg-zinc-800/40 rounded-lg p-3">
          <div className="font-semibold text-zinc-300 mb-1">1️⃣ 选择项目与剧集</div>
          <p className="text-zinc-500 leading-relaxed">
            在上方选择已渲染完成并通过质检的项目和剧集。如果列表为空，请先在「故事」和「资产」页面完成创作与渲染。
          </p>
        </div>
        <div className="bg-zinc-800/40 rounded-lg p-3">
          <div className="font-semibold text-zinc-300 mb-1">2️⃣ 字幕精编 & 音频混音</div>
          <p className="text-zinc-500 leading-relaxed">
            逐场景编辑字幕时间轴和文案，调整人声/BGM 音量与淡入淡出。每条字幕可内联编辑，音频参数实时预览。
          </p>
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
          <p className="text-zinc-500 leading-relaxed">
            基于已生成的交付包创建发布任务，指定目标平台（B站、YouTube、抖音等）。当前为任务管理入口，实际平台对接需后端集成。
          </p>
        </div>
      </div>
      <p className="text-xs text-zinc-600">
        前置条件：项目已有至少一个剧集 → 剧集下的场景已完成渲染 → 渲染结果通过质检 (QA
        页面)。如缺少数据，请先完成上游工作流。
      </p>
    </GlassSurface>
  );
}
