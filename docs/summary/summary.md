# 项目决策记录 - 漫剧 B2B 代加工平台

> flow-id: manju-2026-04-24-1511
> 生成日期: 2026-04-26

## 1. 确认的技术选型

| 环节 | 选型方案 | 决策理由 |
|------|---------|---------|
| A级角色资产 | IP-Adapter Plus (ComfyUI) | 零训练、商用安全、6.5/10够用A-tier；InsightFace非商用已排除 |
| A级视频生成 | Kling 3.0 img2vid | 原生音频+10s clip+角色锁定；降级备选 Seedance 2.0 Fast |
| SSS级角色资产 | LoRA微调 (Vast.ai GPU) | 一致性8.5/10最高；社区确认"已解决" |
| SSS级视频生成 | Seedance 2.0 Fast (默认) + Kling 3.0 (备选) | Seedance $0.022/sec最低价；降级链已定义 |
| SSSS容错 | IP-Adapter + Seedance基础版 | $5-7/集兜底；保留LoRA资产复用 |
| 主TTS | ElevenLabs Creator ($22/月) | 质量⭐⭐⭐⭐⭐；商用安全；Demo首选 |
| 降本TTS | Fish Audio S2 Pro | 质量超越ElevenLabs(EmergentTTS-Eval验证)；成本1/11 |
| 默认BGM | Veo 3.1 原生音频 | 规避Suno版权不确定性(UC-4) |
| 备选BGM | Suno Pro ($10/月) | 代码实现但默认关闭；待许可验证后启用 |
| 后期合成 | FFmpeg + DaVinci Free | 开源已达标(research §7确认) |
| 合规标注(TikTok) | C2PA + invisible watermark | TikTok 2026强制要求；13亿+视频已标注 |
| 合规标注(抖音) | 网信办显式标识 + 隐式元数据水印 | 预留接口，二期实现 |
| 规则引擎架构 | rules.json 配置化 | TikTok/抖音双平台热切换；DR4设计参考；用户确认 |
| Web UI 技术栈 | FastAPI + Vue3/React + PostgreSQL | API-first、WebSocket实时推送、本地部署；0.4.1决策确认 |
| Web UI 定位 | 漫剧 Production OS（唯一入口） | 不考虑CLI流水线和OpenClaw介入；用户明确要求 |

## 2. 拒绝的选项及原因

| 选项 | 拒绝原因 |
|------|---------|
| InstantID (角色一致性) | InsightFace antelopev2非商用许可，商业风险不可控 |
| PhotoMaker V2 | 2025-2026无重大更新，被新方案侵蚀 |
| XTTS-v2 (TTS) | 项目已停止维护 + 非商用许可 |
| Bark (TTS) | 质量⭐⭐，不满足漫剧配音要求 |
| Sora (视频) | 2026-03-14已关闭独立产品，证明API停服风险 |
| CLI流水线 | 用户要求Web UI为唯一入口 |
| 硬编码规则引擎 | 配置化rules.json更灵活，支持TikTok/抖音热切换 |

## 3. Phase 规划

| Phase | 目标 | 验收标准 | 依赖 |
|-------|------|---------|------|
| 0 环境+Web骨架 | 搭建环境+FastAPI+前端框架+DB+项目管理页 | API连通、项目CRUD可用、前端可访问 | 无 |
| 1 A级Demo+生产面板 | A级流水线后端+生产调度面板+素材浏览 | Web UI一键生产、实时进度、1集Demo≤$4 | Phase 0 + #1,#3验证 |
| 2 SSS级+Tier管理 | LoRA+Seedance+降级链+Tier选择器+任务队列 | Tier切换自动路由、降级链自动触发 | Phase 1 + #2验证 |
| 3 音频增强+音频面板 | Veo3.1/Suno/Fish Audio+音频配置面板 | 音频参数可配置、混合输出达标 | Phase 1 |
| 4 批量+规则引擎 | 批量调度+rules.json+TikTok/抖音规则+交付打包 | ≥3集批量、规则校验报告、平台切换 | Phase 1-3 |
| 5 后期剪辑中心 | 时间线编辑器+局部返修+字幕/音频编辑+安全区蒙版 | 剪辑全流程Web UI完成 | Phase 1-4 |

## 4. 待验证项清单

| # | 验证项 | 优先级 | 测试方案 | 阻塞状态 |
|---|--------|--------|---------|---------|
| 1 | IP-Adapter一致性≥0.80 | P0 | 3角色×5镜头实测 | 阻塞Phase 1 |
| 2 | LoRA→Seedance衔接质量 | P0 | 1集端到端测试 | 阻塞Phase 2 |
| 3 | Kling审核误判率≤20% | P1 | 5角色提交测试 | 阻塞Phase 1 |
| 4 | Suno商用许可覆盖TikTok | P1 | 查阅许可条款 | 不阻塞(已降级) |
| 5 | Seedance 2.0 Fast漫剧一致性 | P1 | img2vid测试 | 不阻塞 |
| 6 | Fish Audio S2 Pro配音情感 | P1 | A/B vs ElevenLabs | 不阻塞 |
| 7 | C2PA标注TikTok效果 | P2 | 上传测试 | 不阻塞 |
| 8 | Wan 2.6自部署A级质量 | P2 | 自部署测试 | 不阻塞 |
| 9 | ElevenLabs口型同步工具 | P2 | 技术调研 | 不阻塞 |

## 5. 风险与兜底方案

| 风险 | 严重程度 | 兜底方案 |
|------|---------|---------|
| IP-Adapter不达标 | 中 | 降级Kling角色锁定 |
| LoRA→Seedance失败 | 中 | 路径A(Kling $14-18)→SSSS($5-7)→A级兜底 |
| Kling审核误判高 | 中 | 切换Seedance 2.0 Fast |
| API停服 | 中 | 多模型策略+降级链；Sora已验证风险 |
| Web UI工作量大 | 中 | Gradio过渡+分优先级迭代 |
| GPU资源不足 | 中 | Vast.ai弹性扩缩 |

## 6. 已知不可行项

| 不可行项 | 说明 |
|---------|------|
| S级≤$5/集 | 当前API定价不支持，批量折扣可能降低 |
| <10%人工介入 | 当前技术约30-40%人工占比 |
| InsightFace商用 | antelopev2非商用许可，商业使用需购买 |
| CLI流水线 | 用户决策Web UI为唯一入口 |
| EU AI Act一期实现 | 2026-08-02生效，预留接口但不编码 |

## 7. 编码任务摘要

- task-draft 路径: `skills/meeting/flow/manju-2026-04-24-1511/planning/task-draft.md`
- 任务总数: 6 (task-dev-037 ~ 042)
- P0: task-dev-037(环境+Web骨架), task-dev-038(A级Demo), task-dev-039(SSS级)
- P1: task-dev-040(音频), task-dev-041(批量+规则引擎), task-dev-042(后期剪辑)
- 预估总工期: 24-35天

## 8. 关键架构决策

| 决策 | 决策理由 |
|------|---------|
| Web UI为唯一入口 | 用户明确要求，所有流水线操作通过前端触发，不考虑CLI和OpenClaw介入 |
| Phase 0即搭建Web UI | 避免Phase 5一次性做大量前端工作，每个Phase同步迭代前后端 |
| 规则引擎配置化 | TikTok/抖音硬规则差异大(8vs10条)，配置化支持热切换不改代码 |
| 安全区用ghostshorts保守值 | 顶150/底440/右100/左60px，比DR数据更保守，覆盖更多遮挡场景 |
| 抖音硬规则写入douyin.json | 10条硬规则已确认(open.douyin.com API文档+newrank+21jingji)，软规则二期补充 |
