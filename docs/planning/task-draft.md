# task-draft — 漫剧 Production OS 开发任务

> 基于 planning-step2 生成 | 2026-04-26 | topic #4 #5 已回流

## task-dev-037
---
type: dev
priority: P0
status: draft
owner: TBD
created: 2026-04-26 UTC
summary: Phase 0 — 环境准备 + Web UI 项目骨架：搭建开发环境、初始化 FastAPI 后端 + 前端框架 + DB schema，实现项目管理和 API Key 管理基础页面

## goals
- 搭建开发环境（Kling 3.0/Seedance API Key 配置、ComfyUI、FFmpeg、c2patool）
- 初始化 FastAPI 后端项目（项目结构、SQLAlchemy/PostgreSQL schema、核心 API 路由）
- 初始化前端项目（Vue3/React 框架搭建、路由配置、基础布局组件）
- 实现项目 CRUD API + 前端页面（项目创建、项目列表、项目设置）
- 实现 API Key 管理 API + 前端页面（添加/编辑/删除/测试连通性）
- 编写环境连通性测试脚本（一键验证所有 API + 本地工具）

## notes
- Phase 0 是所有后续 Phase 的前置条件，优先级最高
- Web UI 技术栈：FastAPI + Vue3/React + PostgreSQL，本地部署
- ComfyUI 需要 GPU 环境（本地或 Vast.ai）
- 需确认前端框架选型（Vue3 vs React）

---

## task-dev-038
---
type: dev
priority: P0
status: draft
owner: TBD
created: 2026-04-26 UTC
summary: Phase 1 — A 级 Demo 流水线 + 生产调度面板：后端实现完整 A 级流水线，前端实现一键生产 + 实时进度 + 素材浏览

## goals
- 后端实现 IP-Adapter Plus 角色资产生成模块（ComfyUI pipeline）
- 后端实现 Kling 3.0 img2vid 视频生成模块（含 prompt 模板、重试逻辑、失败计数）
- 后端实现 ElevenLabs Creator TTS 音频生成模块（角色 voice mapping、台词分段）
- 后端实现 FFmpeg 合成模块（视频拼接、音频叠加、字幕烧录、安全区处理）
- 后端实现 C2PA 元数据注入模块
- 后端实现生产调度 API（启动/暂停/取消/重跑、WebSocket 实时进度推送）
- 前端实现生产调度面板（项目工作台、一键生产、实时进度 WebSocket、任务队列）
- 前端实现素材浏览器（角色资产卡片、镜头素材按集/按镜头浏览）
- 端到端执行 Demo 生产，产出 1 集 A 级成片，验证单集成本 ≤ $4

## notes
- **阻塞项 #1（IP-Adapter 一致性≥0.80）和 #3（Kling 审核误判率≤20%）必须在编码前验证通过**
- 验证失败：#1 降级为 Kling 角色锁定；#3 切换 Seedance 2.0 Fast
- Web UI 是生产唯一入口，所有操作通过前端触发，无 CLI
- 依赖 Phase 0 Web UI 骨架

---

## task-dev-039
---
type: dev
priority: P0
status: draft
owner: TBD
created: 2026-04-26 UTC
summary: Phase 2 — SSS 级流水线 + Tier 管理：LoRA 微调 + Seedance + 三级降级链，前端 Tier 选择器 + 任务队列管理

## goals
- 后端实现 LoRA 微调训练模块（数据准备、训练脚本、模型管理）
- 后端实现 Seedance 2.0 Fast img2vid 模块（API 调用、prompt 优化）
- 后端实现三级降级容错链（路径B→路径A→SSSS→A级兜底）
- 后端实现故障恢复机制（资产版本管理、自动切换、重试 3 次策略）
- 前端实现 Tier 选择器（项目/集级别切换 A/SSS，自动切分 API 路由）
- 前端实现任务队列管理面板（并行控制、优先级排序、暂停/取消/重跑）
- 执行 SSS 级 Demo 生产，对比 A 级质量

## notes
- **阻塞项 #2（LoRA→Seedance 衔接质量）必须在编码前验证通过**；失败则路径 A（Kling）为默认
- 依赖 Phase 1 A 级流水线代码 + Web UI 生产面板
- LoRA 训练需要 Vast.ai GPU

---

## task-dev-040
---
type: dev
priority: P1
status: draft
owner: TBD
created: 2026-04-26 UTC
summary: Phase 3 — 音频增强 + 音频面板：Veo 3.1 原生音频 + Suno 备选 + Fish Audio 降本，前端音频配置面板

## goals
- 后端实现 Veo 3.1 原生音频 BGM 生成模块
- 后端实现 Suno Pro BGM 生成模块（默认关闭，参数切换启用）
- 后端实现 Fish Audio S2 Pro TTS 模块（ElevenLabs 接口兼容）
- 后端实现音频混合模块（TTS + BGM + 音效，FFmpeg-based）
- 前端实现音频配置面板（TTS 模型选择、BGM 开关/选择、各音轨音量比例调节）
- 执行音频质量 A/B 对比测试

## notes
- **阻塞项 #4（Suno 许可）采用先行假设降级路径**——默认 Veo 3.1 原生音频；Suno 代码实现但默认关闭
- 依赖 Phase 1 音频模块基础 + Web UI 骨架

---

## task-dev-041
---
type: dev
priority: P1
status: draft
owner: TBD
created: 2026-04-26 UTC
summary: Phase 4 — 批量生产 + 平台规则引擎：多剧本并行调度、rules.json 配置化规则引擎、TikTok/抖音双平台规则、合规标注

## goals
- 后端实现批量生产调度器（多剧本并行处理、进度追踪、错误重试）
- 后端实现规则引擎（读取 rules.json 配置，硬规则阻塞 + 软规则 flag 提醒，输出标记报告）
- 后端编写 tiktok.json 规则配置（8 硬规则 + 9 软规则，含安全区数值、编码格式、文件大小阈值等）
- 后端编写 douyin.json 规则配置（10 硬规则，软规则二期补充；含网信办 AI 标识、品牌水印禁令、深度合成备案等）
- 后端实现 target_platform 切换参数（加载对应 rules.json）
- 后端实现合规标注（TikTok C2PA + invisible watermark；抖音网信办 AI 标识预留）
- 后端实现生产日志与成本追踪模块
- 前端实现批量调度面板（多剧本选择、批量启动、进度总览）
- 前端实现规则校验报告页（每集硬规则/软规则结果、阻塞项高亮）
- 前端实现交付打包页（选择平台→导出规范成片）
- 执行批量生产测试（≥3 集连续产出，规则引擎全量校验通过）

## notes
- ✅ topic #4 已完成（2026-04-26），规则引擎架构、TikTok/抖音硬软规则清单已确认
- 规则引擎采用配置化 rules.json 架构，硬规则阻塞 + 软规则 flag 提醒
- 安全区数值采用 ghostshorts 2026 保守值（顶150/底440/右100/左60px）
- TikTok 规则来源：ghostshorts.com, viraly.io, seller-us.tiktok.com, 豆包文档
- 抖音规则来源：open.douyin.com API 文档, newrank.cn, 21jingji.com
- 抖音软规则（国内受众偏好）二期补充

---

## task-dev-042
---
type: dev
priority: P1
status: draft
owner: TBD
created: 2026-04-26 UTC
summary: Phase 5 — 后期剪辑中心（重点）：时间线编辑器、局部返修、字幕/音频编辑、安全区蒙版、创意剪辑

## goals
- 前端实现时间线编辑器（镜头缩略图轨道、拖拽排序、时长调整、添加/删除镜头）
- 前端实现成片播放器（逐集播放、逐镜头跳转、播放速度控制）
- 后端实现局部返修 API（选中镜头→修改 prompt→调用生成 API→FFmpeg 自动替换拼接）
- 前端实现局部返修交互（镜头选中→prompt 编辑面板→触发重跑→进度显示→替换确认）
- 前端实现边界框标注（画面上画框标记问题区域→时间戳+坐标→文字批注）
- 前端实现 Version Diff（修改前后 A/B 对比播放）
- 前端实现字幕编辑器（文本编辑、时间轴拖拽、字体/大小/颜色/位置配置）
- 后端实现音频混音 API（各音轨音量调节、BGM 替换、时间轴对齐）
- 前端实现音频混音台（多音轨波形显示、音量滑块、BGM 选择器）
- 前端实现转场效果（镜头间淡入淡出、交叉溶解参数配置）
- 前端实现安全区蒙版（TikTok/抖音 UI 半透明叠加、内容遮挡检测高亮）
- 前端实现画面裁切/缩放（构图调整、安全区适配）
- 端到端测试（从批量生产到剪辑到导出全流程通过 Web UI 完成）

## notes
- ✅ topic #5 已完成（2026-04-26），Web UI 定位为漫剧 Production OS，后期剪辑是重点
- Web UI 是生产唯一入口，所有操作通过前端触发，不考虑 OpenClaw 介入
- 创意剪辑功能（镜头重排序、转场效果）酌情添加，aidrama 对标
- 时间线编辑器是核心组件，建议评估专业前端视频编辑库（如 fabric.js / konva.js / remotion）
- 工作量最大，预估 7-10 天
- 依赖 Phase 1-4 全部流水线代码
