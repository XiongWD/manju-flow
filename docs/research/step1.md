# Step 1 — 研究框架制定

> flow-id: manju-2026-04-24-1511
> 时间：2026-04-25（重跑）
> 输入：step0.md（业务定向）+ briefing 消费 + 本地用户资料

---

## 1. 对业务对象的理解

**业务对象**：面向 TikTok 美区的 B2B 漫剧代加工生成平台，核心交付物为 50-60s 竖屏 9:16 漫剧单集成片。

**关键特征**：
- 客户自带剧本，平台负责从剧本到成片的自动化生产
- B2B 代工模式，交付稳定、风格一致、返工少是核心诉求
- 建设者只有 1 人（如意粑粑），懂代码和 AI，不懂漫剧专业流程
- 平台规则做成可插拔插槽，兼容二期其他平台
- 预算策略：GPU 走 Vast.ai 性价比路线，API 质量优先但开源达标则首选
- Demo 目标：1 周内最快路径跑通 A 级流水线
- 音频主方案：ElevenLabs，VibeVoice/Gemini 3.1 Flash TTS 仅用于类比 Tier
- 角色一致性：S/SSS 用商用 API 原生角色锁定，A级用 IP-Adapter
- Web UI 技术栈留到 planning 阶段

## 2. 0→1 生产流程草图

```
剧本输入(JSON/文本) → 结构拆解(钩子地图/分镜JSON) → 角色资产库(基准图/表情/服装) →
批量生图(Prompt工程/一致性控制) → 微动态制作(Ken Burns/LivePortrait/口型) →
音频制作(ElevenLabs配音/BGM/音效/混音) → 合成拼接(FFmpeg/字幕/水印/安全区) →
自动质检(帧级检查/同步/合规) → 多版本导出(TikTok版/Series版) → 交付
```

**0→1 完整生产流程硬指标**：

| # | 环节 | 上游输入 | 中间产物 | 下游输出 | 角色 | 工具/依赖 | 成本敏感点 | 风险点 | 可替代方案 |
|---|------|---------|---------|---------|------|----------|-----------|-------|----------|
| 1 | 剧本解析 | 客户剧本(22集大纲+分集) | 结构化JSON(钩子点/分镜/对白/情绪弧) | 分镜清单+对白序列 | 自动化 | LLM(Claude/GPT-4o) | API调用费 | 解析质量不稳定 | 多模型交叉校验 |
| 2 | 分镜生成 | 结构化剧本 | 镜头清单(时长/运动/安全区) | 每镜头描述 | 自动化 | LLM + 规则引擎 | API调用费 | 分镜节奏不合理 | 人工微调规则 |
| 3 | 角色资产 | 角色描述 | 基准图+表情组+服装组+voice ID | 角色资产库 | A级半自动/S+人工审核 | Flux/IP-Adapter/Midjourney | 生图API/算力 | 角色一致性是核心瓶颈 | LoRA/InstantID/商用API角色锁定 |
| 4 | 批量生图 | 分镜描述+角色基准 | 每镜头静态图(1080P+) | 静态图序列 | 自动化 | ComfyUI+Flux/SDXL | GPU算力 | 风格漂移 | IP-Adapter+ControlNet |
| 5 | 微动态制作 | 静态图+对白 | 3-5s动态片段(24-30fps) | 视频片段 | 自动化 | LivePortrait/Ken Burns/Kling/Runway | 视频API/算力(最高) | 口型同步偏差 | 多Tier分流 |
| 6 | 音频制作 | 台词+情绪标签+时长约束 | 配音+BGM+SFX+混音母带 | 音频轨道 | 自动化 | ElevenLabs+Suno/库音乐 | TTS API | 情感表达不足 | 开源TTS降级 |
| 7 | 合成拼接 | 图+动效+音频 | 单集MP4(1080x1920) | 成片 | 自动化 | FFmpeg+LUT+安全区裁剪 | 计算资源 | 音画同步 | 规则引擎调参 |
| 8 | 自动质检 | 成片 | 质检报告+返工清单 | 通过/返工判定 | 自动化+人工抽检 | Python CV/DSP | 计算资源 | 漏检 | 多维质检规则 |
| 9 | 多版本导出 | 母版 | TikTok版/Series版/平台版 | 导出文件 | 自动化 | FFmpeg+C2PA注入 | 计算资源 | 格式兼容 | 转码队列 |

**瓶颈环节**：角色资产(3)、微动态制作(5)、音频制作(6)
**可并行环节**：1→2串行，3可提前，4-6部分可并行，7等全部就绪

## 3. 研究维度

| # | 维度 | 研究什么 | 为什么重要 | 对当前项目意味着什么 |
|---|------|---------|----------|-------------------|
| 1 | 竞品与开源平台 | ArcReel/OpenMontage/video-use/aidrama 的能力边界、定价、缺口 | 确认差异化竞争点，避免重复造轮子 | 决定哪些可复用、哪些必须自建 |
| 2 | 角色一致性技术 | 2026年4月最新角色一致性方案能力边界和稳定性 | 角色跨集一致是漫剧最大质量瓶颈 | 决定 Tier 分配和返工率 |
| 3 | 视频生成模型 | 各模型能力、定价、API稳定性、漫剧适用度 | 直接决定 Tier 技术栈和成本模型 | 决定每个 Tier 用什么模型 |
| 4 | 音频方案 | ElevenLabs(主方案) vs VibeVoice/Gemini Flash TTS(类比Tier) | 配音质量直接影响观众留存 | 确认 Tier 音频分配 |
| 5 | Vast.ai 算力 | GPU实时价格、Spot中断率、恢复机制 | GPU成本占非API成本主体 | 算力分配和稳定性策略 |
| 6 | 开源vs商用边界 | 各环节开源方案成熟度与商用方案差距 | 用户要求"开源达标则首选" | 决定哪些环节可用开源 |
| 7 | 成本结构 | 各Tier单集成本模型、边际成本递减 | 支撑定价和ROI | 决定可行性底线 |
| 8 | 人工介入点 | 哪些环节必须人工、哪些可自动化 | 目标非必要人工<10% | 定义自动化覆盖率 |
| 9 | TikTok合规 | AIGC标注+C2PA实现方式、版权音乐规则 | 合规是上架前提 | 决定合规技术实现复杂度 |
| 10 | 风险与不可行项 | 技术风险、单兵瓶颈、许可证风险 | 提前识别并缓解 | 决定项目可行性 |

## 4. 信息源路由

| 研究问题 | 优先平台 | 工具策略 |
|---------|---------|---------|
| 竞品平台功能与定价 | GitHub/官网/Product Hunt | agent-reach 直接访问 + serper |
| 视频模型最新能力 | 官方博客/arXiv/X/Reddit | serper + agent-reach + last30days |
| 角色一致性技术 | GitHub/Reddit/官方文档 | agent-reach 读取 GitHub + serper |
| 音频方案 ElevenLabs vs 开源 | 官网/Reddit/YouTube | agent-reach + serper |
| Vast.ai GPU 实时价格 | Vast.ai 官网 API | agent-reach |
| 开源项目成熟度 | GitHub README/Issues/Release | agent-reach 读取 GitHub |
| 成本基准 | 官网定价页 | agent-reach |
| TikTok AIGC 合规 | TikTok 官方规则页 + serper | serper 找源 + agent-reach 精读 |
| 漫剧制作专业知识 | 本地 briefing 文档 | 本地读取（已完成） |

## 5. 研究批次规划

| 批次 | 覆盖维度 | 研究子问题 | 信息源 | 落盘文件 |
|------|---------|----------|-------|---------|
| batch-01 | 维度1 | 竞品平台(ArcReel/OpenMontage/video-use/aidrama)的功能、定价、缺口、可复用点 | agent-reach(GitHub+官网) + serper | research-batch-01.md |
| batch-02a | 维度3 | 视频生成模型能力与定价(Kling/Runway/Veo/Pika/Wan/CogVideoX) | serper + agent-reach | research-batch-02a.md |
| batch-02b | 维度2 | 角色一致性技术(IP-Adapter/InstantID/LoRA/PhotoMaker/商用API角色锁定) | serper + agent-reach | research-batch-02b.md |
| batch-02c | 维度2+3交叉 | 各Tier视频模型+角色一致性分配建议 | 综合前两批 + serper 补充 | research-batch-02c.md |
| batch-03 | 维度4+5+7 | 音频方案+Vast.ai算力+各Tier成本模型 | agent-reach + serper | research-batch-03.md |
| batch-04 | 维度6+8+9+10 | 开源vs商用边界+人工介入点+TikTok合规+风险不可行项 | serper + agent-reach | research-batch-04.md |

## 6. 关键变量

1. **开源视频生成模型是否可达商用漫剧质量** → 直接决定 Tier 分配和成本模型
2. **角色一致性技术的实际稳定性** → 决定返工率和客户满意度
3. **ElevenLabs vs 开源 TTS 在漫剧配音场景的实际差距** → 决定音频成本占比
4. **1 周 Demo 的最小可行范围** → 决定 MVP 功能边界和技术选型
5. **TikTok AIGC 标注+C2PA 的实现复杂度** → 决定合规上架路径

---

## Step 1 缺失项检查

- [x] 业务对象：已确认（B2B 漫剧代加工生成平台）
- [x] 目标市场：已确认（一期 TikTok，二期抖音）
- [x] 目标客户：已确认（B2B 代工，客户提供剧本）
- [x] 目标交付物：已确认
- [x] 用户能力边界：已确认
- [x] 0→1 流程草图：已画出
- [x] 研究维度：10 个维度已定义
- [x] 关键问题：每个维度已列出
- [x] 信息源路由：已规划
- [x] 批次规划：4 个批次已定义
- [x] 关键变量：5 个已列出

**无缺失项，可进入 Step 2。**