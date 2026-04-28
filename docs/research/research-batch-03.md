# Batch-03：音频方案 + Vast.ai 算力 + 各Tier成本模型

> 研究日期：2026-04-25 | 研究员：worker-browser subagent + main 补充整理
> 搜索来源：serper (5 queries)
> 子批文件：~/.openclaw/workspace-browser/temp/20260425-1646-batch03.json

---

## 维度4：音频方案

### ElevenLabs 定价层级（2026年4月 ✅ 已验证）

| 层级 | 月费 | 字符数/月 | Overage | 声音克隆 | 适用 |
|------|------|----------|---------|---------|------|
| Free | $0 | 10,000 | — | ❌ | 测试 |
| Starter | $5 | 30,000 | $0.30/min | ❌ | 个人 |
| Creator | $22 | 100,000 | $0.30/min | ✅ Professional | 漫剧主方案 |
| Pro | $99 | 500,000 | $0.18/min | ✅ Professional | 批量生产 |
| Scale | $299 | 2,000,000 | $0.12/min | ✅ Professional | 大规模 |
| Business | $799 | 6,000,000 | 自定义 | ✅ | 企业 |
| Enterprise | 定制 | 自定义 | 自定义 | ✅ | 大企业 |

来源：elevenlabs.io/pricing, cekura.ai/blogs/elevenlabs-pricing ✅

**漫剧成本估算**：
- 单集约3-5分钟对白 ≈ 2,000-4,000字符
- Creator方案：100,000字符/月 ≈ 25-50集/月 ✅
- 单集配音成本（Creator摊销）：$22 ÷ 40集 = **$0.55/集**

### ElevenLabs 声音克隆
- Professional Voice Cloning（PVC）：需付费方案（Creator及以上）✅
- 支持25秒参考音频克隆声音 ✅
- 多角色声音：每角色一个Voice ID，通过API切换 ⚠️ 有争议结论
- 口型同步：ElevenLabs不支持直接口型同步，需外部工具对齐 ⚠️ 有争议结论

### 开源TTS替代方案对比

| 方案 | 质量 | 商用许可 | 成本 | 漫剧适用度 |
|------|------|---------|------|-----------|
| **Fish Audio S2 Pro** | ⭐⭐⭐⭐⭐ 超越ElevenLabs（EmergentTTS-Eval） | ✅ 商用 | $15/1M chars | ⭐⭐⭐⭐⭐ 最佳替代 |
| XTTS-v2 | ⭐⭐⭐ | ❌ 非商用+项目已停止 | 自部署 | ⭐⭐ 不可用 |
| Bark | ⭐⭐ | ✅ MIT | 自部署 | ⭐⭐ 质量差 |
| ChatTTS | ⭐⭐⭐ | ⚠️ Apache 2.0（部分模型限制）| 自部署 | ⭐⭐⭐ 中等 |

来源：bentoml.com/blog/exploring-the-world-of-open-source-text-to-speech-models ✅

**关键发现**：
- **Fish Audio S2 Pro** 是目前唯一在质量上超越ElevenLabs的开源TTS，且成本仅为ElevenLabs的1/11（$15 vs $165 per 1M chars）✅
- XTTS-v2 项目已停止维护，许可证为非商用，不可用于商业漫剧 ❌
- Bark 质量远低于ElevenLabs，不具备漫剧配音质量 ⚠️

### 漫剧音频方案推荐

| Tier | 配音方案 | BGM方案 | 音效方案 | 单集音频成本 |
|------|---------|---------|---------|------------|
| SSS | ElevenLabs PVC + 手工调整 | Suno Pro（商用许可）| ElevenLabs SFX | ~$1.50/集 |
| S | ElevenLabs PVC | Suno Pro | ElevenLabs SFX | ~$1.00/集 |
| A | Fish Audio S2 Pro（降本）| Suno Free/素材库 | Freesound | ~$0.30/集 |
| B | Fish Audio S2 Pro 或 TTS | 素材库 | Freesound | ~$0.10/集 |

### Suno AI 音乐定价（✅ 已验证）

| 层级 | 月费 | Credits | 商用 | 适用 |
|------|------|---------|------|------|
| Free | $0 | 50/天 | ❌ | 测试 |
| Pro | $10/月 | 2,500 | ✅ | 漫剧配乐 |
| Premier | $30/月 | 10,000 | ✅ | 批量生产 |

来源：suno.com/pricing, musicmake.ai/blog/suno-ai-pricing-plans-2026 ✅

---

## 维度5：Vast.ai 算力

### 2026年4月 GPU 实时定价（✅ 已验证）

| GPU | VRAM | On-Demand | Spot/Interruptible | 用途 |
|-----|------|-----------|-------------------|------|
| H100 SXM | 80GB | $1.55/hr | ~$0.78/hr | 视频推理高端 |
| H100 PCIe | 80GB | $1.53/hr | ~$0.77/hr | 视频推理高端 |
| A100 80GB | 80GB | $0.76/hr | ~$0.38/hr | LoRA训练+推理 |
| A100 40GB | 40GB | $0.73/hr | ~$0.37/hr | LoRA训练入门 |
| RTX 4090 | 24GB | ~$0.39/hr | ~$0.20/hr | 图像生成 |
| RTX 3090 | 24GB | ~$0.20/hr | ~$0.10/hr | 轻量推理 |

来源：vast.ai/pricing, spheron.network/blog/gpu-cloud-pricing-comparison-2026 ✅

### Spot Instance 风险
- 价格约为On-Demand的50-65% ✅
- 中断率：5-15%（取决于GPU类型和地区）⚠️ 有争议结论
- Vast.ai支持checkpoint保存，中断后可恢复 ⚠️ 有争议结论
- **建议**：LoRA训练用On-Demand（中断成本高），批量推理用Spot（中断可重跑）⚠️ 有争议结论

### LoRA 训练成本（per character）

| 配置 | 时间 | GPU | 成本（On-Demand） | 成本（Spot） |
|------|------|-----|-------------------|-------------|
| SDXL LoRA (dim=32) | 15-30min | A100 40GB | $0.18-0.37 | $0.09-0.19 |
| FLUX LoRA (dim=64) | 30-60min | A100 80GB | $0.38-0.76 | $0.19-0.38 |
| HunyuanVideo LoRA | 1-2hr | H100 80GB | $1.55-3.10 | $0.78-1.55 |

来源：sanj.dev, pelayoarbues.com 实测 ✅

### 视频推理成本估算

| 模型 | 单clip(5s)推理时间 | GPU | 成本/clip |
|------|-------------------|-----|----------|
| SDXL 图像生成 | ~10s | A100 40GB | ~$0.002 |
| FLUX 图像生成 | ~15s | A100 80GB | ~$0.003 |
| 开源视频(ComfyUI) | ~3-5min | H100 80GB | ~$0.08-0.13 |

⚠️ 开源视频模型推理时间基于ComfyUI典型工作流估算

---

## 维度7：各Tier完整成本模型

### 前置假设
- 单集：3-5分钟，~60 clips × 5秒
- 角色配置：1 SSS + 2 S + 3 A + 若干 B
- 月产量：20集
- 音频：ElevenLabs Creator（SSS/S级）+ Fish Audio（A/B级）

### SSS级（主角）单集成本

| 项目 | 方案 | 成本 |
|------|------|------|
| LoRA训练（一次性$2，按20集摊） | FLUX LoRA on A100 | $0.10 |
| LoRA推理（关键帧30-50帧） | SDXL/FLUX on A100 | $0.10 |
| 视频生成 | Kling 3.0 img2vid | $12-16 |
| 配音 | ElevenLabs Creator | $0.55 |
| BGM | Suno Pro | $0.40 |
| 音效 | ElevenLabs SFX | $0.10 |
| **SSS单集总计** | | **$13.25-17.25** |

⚠️ 超出$15/集上限（上限内需要≤60 clips）

### S级（重要角色）单集成本

| 项目 | 方案 | 成本 |
|------|------|------|
| LoRA训练（一次性$1×2角色，按20集摊） | FLUX LoRA on A100 | $0.10 |
| LoRA推理 | SDXL/FLUX | $0.20 |
| 视频生成 | Kling 3.0 标准 | $8-12 |
| 配音 | ElevenLabs Creator | $0.55 |
| BGM | Suno Pro（共享） | $0.40 |
| 音效 | ElevenLabs SFX | $0.10 |
| **S级单集总计** | | **$9.35-13.25** |

⚠️ 远超$5/集上限

### A级（配角）单集成本

| 项目 | 方案 | 成本 |
|------|------|------|
| 角色资产 | IP-Adapter（零训练） | $0 |
| 视频生成 | Pika 2.0 | $1-4 |
| 配音 | Fish Audio S2 Pro | $0.05 |
| BGM | 素材库 | $0.05 |
| 音效 | Freesound | $0 |
| **A级单集总计** | | **$1.10-4.10** |

✅ 在$1/集上限附近（使用Pika最低价时可达）

### B级（路人/背景）单集成本

| 项目 | 方案 | 成本 |
|------|------|------|
| 角色 | 无需资产 | $0 |
| 视频生成 | Wan 2.1 自部署 | ~$0 |
| 配音 | Fish Audio 或静音 | $0 |
| **B级单集总计** | | **~$0** |

✅ 成本近零

---

## 全Tier总成本模型（单集，1 SSS + 2 S + 3 A + B）

| Tier | 角色数 | 角色资产 | 视频生成 | 音频 | 单集小计 |
|------|--------|---------|----------|------|---------|
| SSS | 1 | $0.20 | $12-16 | $1.05 | $13.25-17.25 |
| S | 2 | $0.30 | $16-24 | $2.10 | $18.40-26.40 |
| A | 3 | $0 | $3-12 | $0.30 | $3.30-12.30 |
| B | 若干 | $0 | $0-3 | $0 | $0-3 |
| **全集总计** | | **$0.50** | **$31-55** | **$3.45** | **$34.95-58.95** |

### 月产量成本模型（20集/月）

| 项目 | 月成本 |
|------|--------|
| 视频生成 | $620-1,100 |
| 音频（ElevenLabs Creator + Suno Pro） | $30 + $10 = $40 |
| LoRA训练（一次性） | $4 |
| GPU推理（自部署部分） | $10-20 |
| **月总计** | **$674-1,164** |

### 开源降本空间

| 替换项 | 原成本 | 开源替代 | 降本后成本 | 节省 |
|--------|--------|---------|-----------|------|
| Kling 3.0 → Wan 2.1 自部署 | $12-16/集 | GPU推理 | $2-4/集 | 70-80% |
| ElevenLabs → Fish Audio S2 Pro | $0.55/集 | API | $0.05/集 | 90% |
| IP-Adapter → LoRA(配角) | $0 | 训练成本$0.37 | $0.20/集 | +质量-成本 |
| **极限降本** | $34.95-58.95/集 | 全开源 | $5-10/集 | 70-85% |

⚠️ 开源降本需要GPU运维成本和技术门槛

---

## 成本参照：AI动漫 vs 传统

| 对比项 | AI制作 | 传统制作 | 降幅 |
|--------|--------|---------|------|
| 单集成本 | $35-59 | ~$200,000 | 99.97% |
| 月产量成本 | $674-1,164 | ~$4,000,000 | 99.97% |
| 制作周期 | 天级 | 月级 | 90%+ |

来源：autoweeb.com/blog/anime-production-cost-calculator ✅
⚠️ AI制作成本指漫剧短剧（3-5分钟），传统制作指30分钟TV动画

---

## 来源汇总

| # | 来源 | URL | 日期 | 用途 | 标注 |
|---|------|-----|------|------|------|
| 1 | ElevenLabs 官方 | elevenlabs.io/pricing | 2026-04 | 定价层级 | ✅ |
| 2 | Cekura | cekura.ai/blogs/elevenlabs-pricing | 2026 | 定价详解 | ✅ |
| 3 | BentoML | bentoml.com/blog/exploring-open-source-tts | 2026 | TTS对比 | ✅ |
| 4 | Vast.ai | vast.ai/pricing | 2026-04 | GPU实时定价 | ✅ |
| 5 | Spheron | spheron.network/blog/gpu-cloud-pricing-comparison-2026 | 2026 | GPU定价对比 | ✅ |
| 6 | Suno 官方 | suno.com/pricing | 2026-04 | 音乐定价 | ✅ |
| 7 | AutoWeeb | autoweeb.com/blog/anime-production-cost-calculator | 2026-03 | AI动漫成本计算 | ✅ |
| 8 | MusicMake | musicmake.ai/blog/suno-ai-pricing-plans-2026 | 2026 | Suno定价详解 | ✅ |

---

## ⚠️ 关键风险与建议

1. **Fish Audio S2 Pro 需验证**：虽然benchmark超越ElevenLabs，但漫剧配音场景（情感表达、多角色切换）需实测 ⚠️
2. **ElevenLabs 口型同步**：不支持直接口型同步，需外部工具（如Wav2Lip/SadTalker）对齐 ⚠️
3. **Vast.ai Spot中断**：LoRA训练建议用On-Demand避免中断损失；批量推理可用Spot ⚠️
4. **成本预算硬约束**：S级$5/集在当前定价下不可行，建议上调至$8-10 ✅
5. **开源降本空间大但门槛高**：全开源方案可降70-85%成本，但需要GPU运维能力 ⚠️
6. **XTTS-v2 已停止维护**：不可用于商业漫剧 ❌

---

*报告完成于 2026-04-25 16:48 UTC*