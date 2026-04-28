# optimize — 漫剧一站式生成流水线

## 标题
漫剧一站式生成流水线：从剧本到高质量漫剧的批量生产系统

## 背景摘要
我们是漫剧代加工生成平台，核心诉求是建立从剧本到高质量漫剧的自动化批量生产流水线。业务边界明确：不参与前期剧本选择和后期运营数据回流，只聚焦生产环节的批量生成、低人工介入、高质量输出。需要同时兼容 TikTok 海外漫剧（一期）和国内抖音漫剧（二期），通过规则切换适配不同平台要求。

## 会议目标
1. 确认一期 Demo 的最快落地路径（基于现有剧本）
2. 设计 TikTok 海外漫剧批量生产流水线的 Tier 分级体系（A/S/SSS）
3. 明确平台规则化架构，兼容二期国内抖音漫剧生产
4. 定义 Web UI 核心功能（归档分析、二次剪辑、审核、打回修改）
5. 输出一期开发计划的 Phase 分解与验收标准

## 优先级
高

## 参与者
- 如意粑粑（产品/技术负责人），必须参与
- 剪辑师（返工使用者），可选

## 议题清单
1. 一期 Demo 最快路径确认
   - 简述：基于现有剧本，确定从剧本到成片的最小可行链路
   - 预估时长：20 分钟
   - 是否优先：是
2. Tier 分级体系设计（A/S/SSS）
   - 简述：按模型选型、视频效果定义三级标准，SSS 工业级、A 级门槛级
   - 预估时长：25 分钟
   - 是否优先：是
3. 平台规则化架构设计
   - 简述：TikTok/抖音规则切换机制，保证二期兼容
   - 预估时长：20 分钟
   - 是否优先：是
4. 成本与性价比优化策略
   - 简述：各 Tier 的成本模型、API 选型、性价比最优解
   - 预估时长：15 分钟
   - 是否优先：是
5. Web UI 功能范围与优先级
   - 简述：归档分析、二次剪辑、审核、打回修改的 MVP 定义
   - 预估时长：15 分钟
   - 是否优先：否
6. 二期国内抖音漫剧路径预规划
   - 简述：OpenClaw 调度 CLI-Anything 控制计划生产的可行性
   - 预估时长：10 分钟
   - 是否优先：否

## 约束条件
- 一期目标：最快路径 Demo 落地 + 成熟 TikTok 批量流水线
- 二期目标：国内高质量抖音漫剧流水线（通过 OpenClaw 调度 CLI-Anything）
- 用户只懂代码和 AI，漫剧专业知识需要直白解释
- 非必要环节尽量低人工介入
- 性价比优先：在保证质量前提下成本最优

## 前置准备
- 本地剧本资料归档确认，负责人：如意粑粑，截止时间：已提供，是否需要进入 research：统一由 research 执行

## 成功标准
- 形成清晰的 Tier 分级定义（A/S/SSS）及对应技术选型
- 确认一期 Demo 的最小可行技术栈与落地时间线
- 明确平台规则化架构的关键抽象与接口
- 输出 Web UI MVP 功能清单与优先级

## 建议下一步
research

## 路由提示
go_to:research_then_planning

## 参考资料
- /home/hand/obsidian-vault/漫剧/share/
- /home/hand/obsidian-vault/漫剧/tiktok/TK漫剧制作与剧本总结 - 豆包 (1).md
- https://github.com/calesthio/OpenMontage
- https://github.com/microsoft/VibeVoice
- https://github.com/ArcReel/ArcReel
- https://artificialanalysis.ai/video/models
- https://artificialanalysis.ai/image/models
- https://github.com/browser-use/video-use
- https://aidrama.hidreamai.com/
