import GlassSurface from '@/components/ui/primitives/GlassSurface'

export function PipelineTab() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-white">流水线配置</h2>
        <p className="text-sm text-zinc-500 mt-1">控制漫剧生产流水线的模型路由、质检阈值和自动化行为。当前为配置说明入口，实际执行依赖后端流水线服务。</p>
      </div>

      <GlassSurface variant="panel" className="!p-5 space-y-5">
        <h3 className="text-sm font-semibold text-white">📋 漫剧生产流水线阶段</h3>
        <div className="space-y-3 text-xs">
          <div className="flex gap-3 items-start bg-zinc-800/40 rounded-lg p-3">
            <span className="text-lg shrink-0">📖</span>
            <div>
              <div className="font-semibold text-zinc-300">故事 & 剧本生成</div>
              <p className="text-zinc-500 mt-1">LLM 根据用户输入（题材、风格、集数）生成故事大纲 → 剧本 → 分镜描述。质检门禁 G1a-G1d。</p>
              <p className="text-zinc-600 mt-1"><strong className="text-zinc-500">可配置项：</strong>默认 LLM 模型、最大重试次数、大纲结构校验阈值。</p>
            </div>
          </div>
          <div className="flex gap-3 items-start bg-zinc-800/40 rounded-lg p-3">
            <span className="text-lg shrink-0">🎨</span>
            <div>
              <div className="font-semibold text-zinc-300">角色 & 资产生成</div>
              <p className="text-zinc-500 mt-1">根据剧本生成角色设定图、场景背景、道具等静态资产。质检门禁 G2-G5。</p>
              <p className="text-zinc-600 mt-1"><strong className="text-zinc-500">可配置项：</strong>图像生成模型、角色一致性参考图、生成分辨率、安全区比例。</p>
            </div>
          </div>
          <div className="flex gap-3 items-start bg-zinc-800/40 rounded-lg p-3">
            <span className="text-lg shrink-0">🎬</span>
            <div>
              <div className="font-semibold text-zinc-300">视频渲染</div>
              <p className="text-zinc-500 mt-1">将分镜图像转为动态视频，叠加音频和字幕。质检门禁 G6-G9。</p>
              <p className="text-zinc-600 mt-1"><strong className="text-zinc-500">可配置项：</strong>视频生成模型、帧率、时长限制、唇形同步精度阈值、音频响度标准。</p>
            </div>
          </div>
          <div className="flex gap-3 items-start bg-zinc-800/40 rounded-lg p-3">
            <span className="text-lg shrink-0">✅</span>
            <div>
              <div className="font-semibold text-zinc-300">质检 & 终检</div>
              <p className="text-zinc-500 mt-1">成片级质检，综合所有维度评分。质检门禁 G10-G12。</p>
              <p className="text-zinc-600 mt-1"><strong className="text-zinc-500">可配置项：</strong>终检通过阈值（默认 70 分）、人工终审是否必须、合规红线关键词列表。</p>
            </div>
          </div>
          <div className="flex gap-3 items-start bg-zinc-800/40 rounded-lg p-3">
            <span className="text-lg shrink-0">📦</span>
            <div>
              <div className="font-semibold text-zinc-300">交付 & 发布</div>
              <p className="text-zinc-500 mt-1">生成剪辑包/审片包/发布包，提交到目标平台。</p>
              <p className="text-zinc-600 mt-1"><strong className="text-zinc-500">可配置项：</strong>默认包类型、目标平台列表、自动发布开关。</p>
            </div>
          </div>
        </div>
      </GlassSurface>

      <GlassSurface variant="panel" className="!p-5">
        <h3 className="text-sm font-semibold text-white mb-3">⚙️ 配置示例</h3>
        <div className="bg-zinc-800/60 rounded-lg p-4 font-mono text-xs text-zinc-300 space-y-1">
          <div>{'// 流水线配置（JSON 格式，后端管理）'}</div>
          <div>{'{'}</div>
          <div>{'  "default_llm": "openai/gpt-4o",'}</div>
          <div>{'  "default_image_model": "kling/kling-v2",'}</div>
          <div>{'  "default_video_model": "kling/kling-v2-video",'}</div>
          <div>{'  "default_tts": "elevenlabs/turbo-v2",'}</div>
          <div>{'  "qa_pass_threshold": 70,'}</div>
          <div>{'  "require_human_review": true,'}</div>
          <div>{'  "max_retries": 3,'}</div>
          <div>{'  "audio_lufs_target": -14,'}</div>
          <div>{'}'}</div>
        </div>
        <p className="text-xs text-zinc-600 mt-3">⚠️ 以上配置通过后端 API 管理，前端仅展示说明。流水线配置功能开发中，完成后将提供可视化编辑界面。</p>
      </GlassSurface>
    </div>
  )
}
