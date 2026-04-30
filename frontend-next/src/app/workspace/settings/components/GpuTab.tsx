import GlassSurface from '@/components/ui/primitives/GlassSurface'

export function GpuTab() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-white">GPU 实例管理</h2>
        <p className="text-sm text-zinc-500 mt-1">管理用于图像/视频渲染的 GPU 计算资源。当前为配置说明入口，实际实例管理依赖后端集成 Vast.ai 或其他 GPU 云服务。</p>
      </div>

      <GlassSurface variant="panel" className="!p-5 space-y-4">
        <h3 className="text-sm font-semibold text-white">🖥️ GPU 实例说明</h3>
        <div className="text-xs text-zinc-400 leading-relaxed space-y-3">
          <p>漫剧生产中，图像生成和视频渲染是计算密集型任务，需要 GPU 加速。系统通过以下方式管理 GPU 资源：</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="bg-zinc-800/40 rounded-lg p-3">
              <div className="font-semibold text-zinc-300 mb-1">🔗 实例连接</div>
              <p className="text-zinc-500">通过 Vast.ai API 或自定义 GPU 节点接入。配置实例的 SSH 连接、API 端口和认证信息。</p>
            </div>
            <div className="bg-zinc-800/40 rounded-lg p-3">
              <div className="font-semibold text-zinc-300 mb-1">💚 健康监控</div>
              <p className="text-zinc-500">实时监控 GPU 利用率、显存占用、温度和任务队列。异常时自动告警。</p>
            </div>
            <div className="bg-zinc-800/40 rounded-lg p-3">
              <div className="font-semibold text-zinc-300 mb-1">📈 自动扩缩容</div>
              <p className="text-zinc-500">根据任务队列深度自动启停实例。低负载时释放闲置实例以节省成本。</p>
            </div>
            <div className="bg-zinc-800/40 rounded-lg p-3">
              <div className="font-semibold text-zinc-300 mb-1">📊 资源用量统计</div>
              <p className="text-zinc-500">按项目/剧集统计 GPU 时长和费用，便于成本追踪和预算管理。</p>
            </div>
          </div>
        </div>
      </GlassSurface>

      <GlassSurface variant="panel" className="!p-5">
        <h3 className="text-sm font-semibold text-white mb-3">⚙️ 推荐配置</h3>
        <div className="bg-zinc-800/60 rounded-lg p-4 font-mono text-xs text-zinc-300 space-y-1">
          <div>{'// GPU 实例配置（后端管理）'}</div>
          <div>{'{'}</div>
          <div>{'  "provider": "vastai",          // vastai | runpod | custom'}</div>
          <div>{'  "gpu_type": "RTX 4090",       // 推荐 24GB+ 显存'}</div>
          <div>{'  "gpu_count": 1,'}</div>
          <div>{'  "max_instances": 3,            // 最大并行实例数'}</div>
          <div>{'  "min_instances": 0,            // 空闲时缩到 0'}</div>
          <div>{'  "auto_scale": true,'}</div>
          <div>{'  "comfyui_port": 8188,'}</div>
          <div>{'  "max_cost_per_hour": 0.5       // 单实例小时费用上限 ($)'}</div>
          <div>{'}'}</div>
        </div>
        <div className="mt-4 text-xs text-zinc-500 space-y-2">
          <p><strong className="text-zinc-400">操作步骤：</strong></p>
          <ol className="list-decimal list-inside space-y-1 text-zinc-600">
            <li>在 Vast.ai 或 RunPod 创建 GPU 实例，安装 ComfyUI 或 Stable Diffusion WebUI</li>
            <li>在上方填写实例的 API 地址和认证信息（后端配置）</li>
            <li>系统会自动检测实例健康状态并分配渲染任务</li>
            <li>在「资产」页面发起渲染时，任务将自动调度到可用 GPU 实例</li>
          </ol>
        </div>
        <p className="text-xs text-zinc-600 mt-3">⚠️ GPU 实例管理功能开发中，完成后将提供可视化实例列表、实时监控面板和一键启停操作。当前请在后端配置文件中管理实例。</p>
      </GlassSurface>
    </div>
  )
}
