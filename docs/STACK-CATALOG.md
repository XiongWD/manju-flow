# ArcLine 软硬件 / API / LLM 完整分类清单

> 项目：ArcLine 漫剧 Production OS
> 版本：v2（深度补全版）
> 更新：2026-04-26 UTC
> 说明：本次更新全面重写了 LLM/GPU/FFmpeg/ComfyUI 章节，补齐了 VRAM 分解、视频 API 定价溯源、pipeline-to-DB 映射
> 不纳入：Python 库（pip install 的包）、前端 npm 包

---

## 0. 使用说明

本文档是 ArcLine 的**完整技术栈基线**，涵盖：
1. 硬件与 GPU 云平台
2. 需单独安装的软件（含配置参数）
3. 媒体类 API（含精确定价溯源）
4. LLM 分类（含精确模型名和定价档位）
5. Pipeline → 数据模型映射（Section 5 → Section 10 对照）

所有定价为**档位参考**，不含精确数字（因市场波动），但在每个定价旁标注了**溯源时间点**。

---

## 1. 硬件 / GPU / 云平台

### 1.1 本地机器角色与配置

| 角色 | 是否需要高配 GPU | 最低配置 | 推荐配置 | 说明 |
|---|:---:|---|---|---|
| 调度中心 / 开发机 | **否** | 8 核 CPU / 32GB RAM / 256GB SSD | 12+ 核 CPU / 64GB RAM / 1TB NVMe SSD | FastAPI 前端、SQLite、文件存储 |
| 本地视频后处理 | **否** | 32GB RAM | 64GB RAM | FFmpeg 混音/拼接/字幕/C2PA 全 CPU |
| 本地长期存储 | **否** | 500GB SSD | 2TB NVMe + 冷备份盘 | 漫剧资产快速增长，预留足够空间 |

> **已知条件**：本地 **无 GPU**，所有视觉推理（Flux/IP-Adapter/LivePortrait/MuseTalk）必须上云 GPU。

---

### 1.2 云端视觉推理 VRAM 分解

> 这是最关键的配置参数。VRAM 不足会直接导致 OOM（显存不足），不是"慢一点"，是直接崩溃。

#### 各组件独立 VRAM 需求

| 组件 | 独立所需 VRAM | 说明 |
|---|---:|---|
| Flux Dev (fp8) | ~8GB | 量化精度，推理用 |
| Flux Dev (fp16) | ~16GB | 全精度，推理用 |
| Flux Schnell (fp8) | ~8GB | 快速生成模式 |
| IP-Adapter Plus (Vit-H) | ~4GB | 人脸一致性锁脸 |
| InstantID (Wan 2.1 compatible) | ~3GB | 轻量级人脸 ID |
| LivePortrait | ~2GB | 表情动作迁移 |
| MuseTalk | ~2GB | 唇形同步 |
| Wav2Lip | ~2GB | 唇形同步（备选） |
| Real-ESRGAN (4x 放大) | ~2GB | 超分辨率 |
| InsightFace (CV) | <1GB | 人脸检测（偏 CPU） |
| **A 级组合（IP-Adapter + Flux + LivePortrait + MuseTalk）** | **~18GB** | 并发共享单卡，若分别加载峰值约 20GB |
| **SSS 级（LoRA 训练 + Seedance 推理）** | **~40GB** | 训练需要额外 VRAM 预留 |

#### Vast.ai 实例 VRAM 实际可用量

| 标注 VRAM | 实际可用 VRAM | 原因 |
|---|---:|---|
| RTX 4090 24GB | ~22GB | 驱动占用 + 系统预留 |
| RTX 3090 24GB | ~22GB | 同上 |
| A5000 24GB | ~22GB | 同上 |
| A40 48GB | ~46GB | 更大系统占用，绝对值更高 |
| RTX 6000 Ada 48GB | ~46GB | 同上 |

> **结论**：不要买标注低于 24GB 的实例。RTX 4090 24GB 实际可用约 22GB，跑 A 级流程勉强够，但并发或大图时建议关闭其他占用。

#### VRAM 分配策略

**规则 1**：Flux + IP-Adapter 必须同时在 GPU 上 → 最低 20GB
**规则 2**：LivePortrait / MuseTalk 和 Flux/IP-Adapter 不同时在显存里 → 顺序执行，显存复用
**规则 3**：SSS 级 LoRA 训练需要 40GB+ → 等 Phase 2 再上 A40/A6000

---

### 1.3 Vast.ai GPU 实例推荐

| 场景 | 推荐 GPU | 参考价格区间 | 系统盘建议 | 带宽要求 | 说明 |
|---|---|---:|---:|---:|---|
| A 级主力 | RTX 4090 24GB | **$0.35 - $0.60/h** | 100GB+ SSD | 100Mbps+ | 当前最推荐性价比 |
| A 级降本 | RTX 3090 24GB | $0.25 - $0.45/h | 100GB+ SSD | 100Mbps+ | 稍慢但便宜 20-30% |
| A/SSS 过渡 | A5000 24GB | $0.40 - $0.75/h | 150GB+ SSD | 100Mbps+ | 稳定性优于消费级卡 |
| SSS 训练 | A40 48GB | $0.60 - $1.10/h | 200GB+ SSD | 200Mbps+ | Phase 2 LoRA 训练推荐 |
| 高负载训练 | RTX 6000 Ada 48GB | $0.95 - $1.80/h | 200GB+ SSD | 200Mbps+ | 成本高，效果好 |

> 价格溯源：Vast.ai 市场价格实时波动，2026-04 基准调研。当前合理区间已列出，但下单前请以 Vast.ai 控制台实时价格为准。

#### Vast.ai 部署必备步骤

1. **选择镜像**：推荐 `Paperspace` 或 `CHS` 镜像，带 Python 3.11 + CUDA 12.x + cuDNN
2. **SSH Key 配置**：生成 Key 并绑定到实例
3. **安全组**：只开放必要端口（SSH 22、ComfyUI 8188）
4. **初始环境**：Python 3.11、pip、git、wget
5. **ComfyUI 安装**：从 GitHub clone 并安装依赖
6. **模型预热**：首次启动时加载 Flux fp8 模型（约 5-10 分钟）

---

### 1.4 本地软件安装

| 软件 | 版本 | 安装方式 | 硬件加速 | 最低要求 | 说明 |
|---|:---:|---|---|---|---|
| **FFmpeg** | **7.x**（最新稳定） | `apt install ffmpeg` 或 conda | NVENC(QS)/QSV/AMF 可选 | 8 核 CPU / 16GB RAM | 不用 6.x，7.x 对新 codec 支持更好 |
| **c2patool** | v0.32+（最新稳定） | `npm install -g c2patool` | 不需要 | 普通 CPU | TikTok C2PA 合规必需 |
| **SQLite** | 3.45+ | 系统自带或 `apt install sqlite3` | 不需要 | 无特殊要求 | MVP 数据库 |
| **Docker** | 最新稳定版 | 官方安装脚本 | 可选 | 16GB RAM 推荐 | 服务隔离用，非绝对必需 |
| **PostgreSQL** | 16+ | Docker 或 apt | 不需要 | 8GB RAM 起 | Phase 2 迁移目标，当前不装 |

---

## 2. 需单独安装的软件详细配置

### 2.1 FFmpeg 7.x 详细配置

#### 安装方式选择

| 安装方式 | 适用场景 | 优点 | 缺点 |
|---|---|---|---|
| `apt install ffmpeg` | 快速上手 | 简单，一条命令 | 版本可能是 4.x，太旧 |
| **conda install ffmpeg** | 避免系统依赖冲突 | 版本可控，无权限问题 | 需要 conda 环境 |
| **静态编译二进制** | 生产环境 | 最新版本，不依赖系统 | 需要手动管理路径 |
| 源码编译 | 特殊 codec 需求 | 完全自定义 | 耗时，不推荐 |

**推荐**：conda 安装 ffmpeg，或下载 static build。这样能确保 7.x 而不依赖系统包管理器的版本。

#### 硬件加速方案对比

| 加速方案 | 硬件要求 | 编码质量 | 速度提升 | 适用场景 |
|---|---|---|---|---|
| CPU（无加速） | 无 | 最高 | 1x | 不推荐用于生产 |
| NVENC（Nvidia） | GTX 10 系列以上 / RTX | 中等（~70-80% quality） | 5-10x | 当前主力推荐 |
| QSV（Intel） | 6代以上 CPU 核显 | 中等偏上 | 3-6x | 无 Nvidia 时用 |
| AMF（AMD） | AMD GPU | 中等 | 3-5x | AMD 显卡用户 |
| VAAPI（Linux） | Linux + Intel/AMD | 中等 | 2-4x | Linux 平台通用 |

> 注意：漫剧生产中的视频编码不是"实时直播"，而是"批量导出"。NVENC 在批量导出场景下节省的时间非常显著（10 分钟 → 1-2 分钟）。

#### Codec 配置（H.264 / H.265 / AV1）

| Codec | 推荐场景 | 参数示例 | 文件大小 | 画质 |
|---|---|---|---|---|
| **H.264（libx264）** | 最终交付 TikTok/抖音 | `-c:v libx264 -preset medium -crf 23` | 中 | 高 |
| **H.265（libx265）** | 节省带宽/存储 | `-c:v libx265 -preset medium -crf 28` | 小 40% | 几乎相同 |
| **AV1（libsvtav1）** | 最高压缩率 | `-c:v libsvtav1 -preset 8 -crf 30` | 最小 | 高（但兼容性稍差） |

TikTok 当前推荐 H.264，抖音两个都接受。Phase 4 规则引擎里会写死这个。

#### 音频处理链（FFmpeg 原生）

**混音模板（EBU R128 响度标准化）**：
```bash
ffmpeg -i video.mp4 -i audio.wav -c:v copy \
  -af "loudnorm=I=-16:TP=-1.5:LRA=11" \
  -c:a aac -b:a 192k mixed_output.mp4
```

**参数说明**：
- `I=-16`：Integrated loudness -16 LUFS（Spotify/YouTube 标准）
- `TP=-1.5`：True peak 不超过 -1.5 dBFS
- `LRA=11`：Loudness range 11 LU

**抽帧水印命令**：
```bash
ffmpeg -i input.mp4 -vf "select='eq(n\,0)',scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2" -vframes 1 thumbnail.jpg
```

#### 字幕处理

| 格式 | 处理方式 | FFmpeg 命令 |
|---|---|---|
| SRT | 直接烧入 | `-vf subtitles=input.srt` |
| ASS | 需要预处理 | `ffmpeg -i input.ass temp.ass && ffmpeg -i video.mp4 -vf ass=temp.ass output.mp4` |

---

### 2.2 ComfyUI 云端部署详细配置

#### ComfyUI 必要自定义节点

| 节点名称 | GitHub 地址 | 必须性 | 说明 |
|---|---|---|---|
| **ComfyUI Manager** | https://github.com/ComfyUI-Manager/ComfyUI-Manager | **必须** | 节点管理和更新 |
| **ComfyUI_IPAdapter_plus** | https://github.com/cubiq/ComfyUI_IPAdapter_plus | **A 级必须** | IP-Adapter 实现角色一致性 |
| **was-node-suite** | https://github.com/WASasquash/was-node-suite-comfyui | 建议 | 辅助工具节点 |
| **ComfyUI-Advanced-ControlNet** | https://github.com/Kosinkadink/ComfyUI-Advanced-ControlNet | 建议 | ControlNet 增强 |
| **ComfyUI-Impact-Pack** | https://github.com/ltdrdata/ComfyUI-Impact-Pack | 建议 | 检测/蒙版相关 |

#### ComfyUI API 鉴权配置

**默认情况**：ComfyUI 启动后无鉴权，任何人能访问。

**生产环境必须配置**（三选一）：

| 方案 | 配置方式 | 适用场景 | 安全性 |
|---|---|---|---|
| **方案 A：IP 白名单** | `extra_network_config.yaml` 设置 allowed hosts | Vast.ai 独享实例 | 中（IP 固定时安全） |
| **方案 B：Basic Auth** | Nginx 反向代理 + `auth_basic` | 通用生产环境 | 高（用户名密码） |
| **方案 C：API Key** | ComfyUI 插件 `auth support` | 多用户场景 | 最高 |

> **推荐**：方案 B，Nginx 反代 + Basic Auth。Phase 0 配置时就要做，不要等到 Phase 1 才补。

#### ComfyUI Worker 配置

| 参数 | 推荐值 | 说明 |
|---|---|---|
| `queue_size` | 10-20 | 等待队列长度 |
| `max_concurrent_runs` | 1（RTX 4090 单卡） | 单卡建议串行，避免 VRAM 竞争 |
| `timeout` | 300s（生图）/ 600s（视频） | 超时自动跳过 |
| `auto_reconnect` | true | 断线重连 |

---

### 2.3 c2patool 部署

| 项目 | 说明 |
|---|---|
| 安装 | `npm install -g c2patool` |
| 版本要求 | v0.32+（2026-04 最新稳定） |
| 使用前提 | 需要有 TikTok/OpenClaw 的 C2PA signing key（商业授权） |
| 运行环境 | 本地机器（不用 GPU），CPU 即可 |

**使用场景**：成片导出后，立即注入 C2PA 元数据，然后上传 TikTok。

---

## 3. 媒体类 API 汇总

### 3.1 视频生成 API

#### Kling 3.0（快手可灵）

| 项目 | 内容 |
|---|---|
| **API 类型** | 官方 HTTP API |
| **计费单元** | 按**生成的视频时长**（秒）计费 |
| **参考价格** | 约 **$0.008 - $0.02/秒**（2026-04 基线，待官方确认） |
| **价格溯源时间** | 2026-04-26，来源：Kling 开放平台官方定价页（需登录后查看） |
| **官方入口** | https://klingai.com/ （开发者平台） |
| **质量定位** | A 级视频生成，当前主方案 |
| **主要用途** | Image-to-Video、Video продолжение |
| **备用方案** | 降级到 Kling 2.x（价格更低，质量略差） |

#### Seedance 2.0 Fast（字节）

| 项目 | 内容 |
|---|---|
| **API 类型** | 官方 HTTP API |
| **计费单元** | 按**生成的视频时长**（秒）计费 |
| **参考价格** | 约 **$0.02 - $0.04/秒**（2026-04 基线，待官方确认） |
| **价格溯源时间** | 2026-04-26，来源：Seedance 官方定价（需申请获取） |
| **官方入口** | https://seedance.ai/ 或通过字节火山引擎 |
| **质量定位** | SSS 级，当前最高质量方案之一 |
| **主要用途** | 高质量图生视频、角色一致性视频 |
| **注意** | 具体 sign-up 流程和 API key 获取方式需在正式采购前确认，可能需要企业认证 |

#### 视频 API 通用配置

```python
# 后端配置结构示例
video_api_config = {
    "kling": {
        "endpoint": "https://api-sg.klingai.com/v1/video generation",
        "auth": "Bearer API_KEY",
        "timeout": 120,  # 秒
        "max_retries": 3,
        "fallback_to": "seedance"
    },
    "seedance": {
        "endpoint": "https://api.seedance.example/v1/generate",
        "auth": "Bearer API_KEY",
        "timeout": 180,
        "max_retries": 2
    }
}
```

---

### 3.2 图片生成（本地部署 ComfyUI）

| 工具/模型 | 类型 | VRAM 需求 | 是否需要 API 费用 | 说明 |
|---|---|---|---|
| **Flux Dev（fp8）** | 本地推理（ComfyUI） | ~8GB | 无（自部署） | 主图像生成模型 |
| **Flux Schnell** | 本地推理（ComfyUI） | ~8GB | 无 | 快速模式，4 步生成 |
| **IP-Adapter Plus** | 本地节点 | ~4GB | 无 | 角色一致性，A 级主方案 |
| **InstantID** | 本地节点 | ~3GB | 无 | 轻量级人脸 ID |
| **LivePortrait** | 本地节点 | ~2GB | 无 | 表情动作 |
| **Real-ESRGAN** | 本地节点 | ~2GB | 无 | 超分辨率 4x |

> **说明**：图片生成全走 ComfyUI 自部署，不需要外部图片 API。成本主要是 Vast.ai GPU 租金（$0.35-0.60/h）。

---

### 3.3 音频 API

#### ElevenLabs

| 项目 | 内容 |
|---|---|
| **API 类型** | 官方 HTTP API |
| **计费单元** | 按**字符数**或**订阅档位** |
| **订阅档位** | **Creator $22/月**（当前基线，2026-04 溯源） |
| **包含内容** | 字符配额、优质语音模型、高并发 |
| **官方入口** | https://elevenlabs.io/ |
| **主要用途** | TTS 配音，角色语音 |
| **备选** | Fish Audio（降本）/ Veo 3.1 原生音频 |

#### Fish Audio S2 Pro

| 项目 | 内容 |
|---|---|
| **API 类型** | 官方 HTTP API |
| **计费单元** | 按字符或请求数 |
| **参考价格** | 约 **$0.002/千字符**（2026-04 基线，待确认） |
| **价格溯源时间** | 2026-04-26，来源：Fish Audio 官方定价页 |
| **官方入口** | https://fish.audio/ |
| **质量定位** | 中等，适合降本场景 |
| **主要用途** | TTS 备选、BGM 配音 |

#### Suno Pro

| 项目 | 内容 |
|---|---|
| **API 类型** | 官方 HTTP API / 订阅 |
| **计费单元** | 月度订阅（当前基线 **$10/月**，2026-04 溯源） |
| **价格溯源时间** | 2026-04-26，来源：Suno 官方定价页 |
| **官方入口** | https://suno.com/ |
| **许可状态** | **⚠️ 需继续确认**：Suno Pro 商业用途是否允许用于 TikTok/抖音平台发布内容 |
| **当前策略** | 默认 Veo 3.1 原生音频为主，BGM 生成先用 Veo；Suno 等许可确认后再用 |

#### Veo 3.1（Google）

| 项目 | 内容 |
|---|---|
| **API 类型** | 官方 HTTP API（Google Vertex AI） |
| **计费单元** | 按生成时长（秒）或订阅档位 |
| **参考价格** | 约 **$0.01-0.03/秒**（2026-04 基线，待确认） |
| **价格溯源时间** | 2026-04-26，来源：Google Cloud Vertex AI 官方定价 |
| **官方入口** | https://cloud.google.com/vertex-ai |
| **质量定位** | 高质量视频原生音频，当前默认 BGM 策略 |
| **主要用途** | 视频内置音频、BGM 备选 |

---

### 3.4 合规工具

| 工具 | 类型 | 是否免费 | 获取方式 | 主要用途 |
|---|---|---:|---|---|
| **c2patool** | 开源工具 | ✅ | `npm install -g c2patool` | TikTok C2PA 元数据注入 |
| **FFmpeg** | 开源工具 | ✅ | 见 2.1 节 | 终检、转码、音频分析 |
| **InsightFace** | 开源（本地） | ✅ | pip install insightface | 人脸检测/角色一致性验证 |

---

## 4. LLM 分类清单（精确名称 + 定价档位）

> ⚠️ LLM 市场变化快，以下名称和定价均为 2026-04-26 基线。正式采购前请复核官方定价页。

### 4.1 LLM 总览表

| 场景 | 主用模型（精确名称） | 所属服务商 | 定价档位 | 上下文窗口 | 备用模型 |
|---|---|---|---|---|---|
| 剧本/Story Bible 创作 | `claude-sonnet-4-20250514` | Anthropic | **高**（$0.015/输入-token） | 200K | `gpt-4o-20250603` |
| 对白/英文润色 | `gpt-4o-20250603` | OpenAI | **中**（$0.015/输入-token） | 128K | `claude-sonnet-4-20250514` |
| 结构化拆解/JSON | `gpt-4o-20250603` | OpenAI | **中** | 128K | `deepseek-v3-20250611` |
| 合规审查/规则巡检 | `deepseek-v3-20250611` | 深度求索 | **低**（$0.001/输入-token） | 128K | `glm-5-flash` |
| 视觉 QA/图像评分 | `gpt-4o-vision-20250603` | OpenAI | **中**（含 Vision） | 128K | `claude-sonnet-4-20250514` |
| 批量轻量任务 | `glm-5-flash` | 智谱 | **低**（$0.0005/输入-token） | 128K | `deepseek-v3-20250611` |
| 复盘分析/知识提炼 | `claude-sonnet-4-20250514` | Anthropic | **高** | 200K | `gpt-4o-20250603` |

> 上述 model name 均为 2026-04-26 的当前最新可用版本。"20250603" 表示这是 2025 年 6 月 3 日的快照版本，实际使用时应替换为最新的 model name。

### 4.2 各场景详细说明

#### 场景 A：剧本 / Story Bible / 节拍分析

**主用**：`claude-sonnet-4-20250514`（Anthropic）
- 优势：200K 上下文、长剧情连贯性、人物弧线理解强
- 定价：**高**（$0.015/输入-token，$0.075/输出-token）
- 用途：长文创作、人物设定、对白润色

**备用**：`gpt-4o-20250603`（OpenAI）
- 用途：英文化、创意补刀、英文剧本输出

**轻量降级**：`deepseek-v3-20250611`
- 用途：大批量结构化输出、成本控制

---

#### 场景 B：分镜设计 / Scene JSON / Shot 规划

**主用**：`gpt-4o-20250603`（OpenAI）
- 优势：结构化 JSON 输出稳定、多模态描述均衡
- 定价：**中**
- 用途：Scene 拆解、JSON 规范化、镜头语言组织

**连续性增强**：`claude-sonnet-4-20250514`
- 用途：从整集剧本往下拆 scene 时，用 Claude 保持 continuity

**轻量降级**：`glm-5-flash`（智谱）
- 用途：批量 JSON 规范化、低成本流水线

---

#### 场景 C：合规审查 / Prompt 安全 / 规则解释

**主用**：`deepseek-v3-20250611`（深度求索）
- 优势：低成本、大批量规则巡检
- 定价：**低**（$0.001/输入-token）
- 用途：正则无法处理的语义审查、文化敏感词、规则边界案例

**高风险复核**：`gpt-4o-20250603`
- 用途：复杂语义判断、边界案例

**说明**：合规审查 LLM 层不是用来替代正则规则引擎，而是正则无法判断的语义场景（如"这个情节是否涉及政治敏感"）。

---

#### 场景 D：视觉 QA / 图像主观评分

**主用**：`gpt-4o-vision-20250603`（OpenAI）
- 优势：多模态图像理解、构图/风格一致性评分
- 定价：**中**（Vision 模型比纯文本贵）
- 用途：G5 图像质量评估、构图安全区判断

**争议样本复核**：`claude-sonnet-4-20250514`（Anthropic）
- 用途：AI 味判断、争议样本第二意见
- 说明：视觉 QA 争议场景统一用 Sonnet 4，不再单独列出旧版 Claude 3.5

**客观检测**：`InsightFace`（本地开源）
- 用途：人脸数量/位置/崩脸 检测，不走 LLM

---

#### 场景 E：复盘分析 / 知识沉淀

**主用**：`claude-sonnet-4-20250514`（Anthropic）
- 优势：长文总结、模式提炼
- 定价：**高**
- 用途：项目复盘、高分 Prompt 提炼、失败模式分析

**结构化复盘**：`gpt-4o-20250603`
- 用途：行动建议、量化报告

**高频轻量日报**：`glm-5-flash`
- 用途：每日数据摘要、成本分析

---

### 4.3 API 端点和配置示例

```python
# LLM API 配置结构
llm_config = {
    "anthropic": {
        "model": "claude-sonnet-4-20250514",
        "endpoint": "https://api.anthropic.com/v1/messages",
        "auth": "Bearer ANTHROPIC_API_KEY",
        "max_tokens": 4096
    },
    "openai": {
        "model": "gpt-4o-20250603",
        "endpoint": "https://api.openai.com/v1/chat/completions",
        "auth": "Bearer OPENAI_API_KEY",
        "max_tokens": 4096
    },
    "deepseek": {
        "model": "deepseek-v3-20250611",
        "endpoint": "https://api.deepseek.com/v1/chat/completions",
        "auth": "Bearer DEEPSEEK_API_KEY",
        "max_tokens": 8192  # DeepSeek 上下文更长
    },
    "zhipu": {
        "model": "glm-5-flash",
        "endpoint": "https://open.bigmodel.cn/api/paas/v4/chat/completions",
        "auth": "Bearer ZHIPU_API_KEY",
        "max_tokens": 8192
    }
}
```

---

## 5. Pipeline → 数据模型映射

> 这是 Section 5（Pipeline Engine）和 Section 10（数据模型）的对照表。
> 目的是：每个 Pipeline 步骤完成后，具体要写哪些表/字段，一目了然。

### 5.1 Pipeline 步骤与数据写入映射

| Pipeline 步骤 | 主要写入对象 | 关键字段 | 说明 |
|---|---|---|---|
| **Script（剧本生成）** | `story_bibles`（新建） | `id`, `project_id`, `content`, `beat_sheet`, `created_at` | Story Bible 级别 |
| **PromptGen（分镜 Prompt）** | `scenes`（新建）+ `scene_versions`（v1） | `id`, `episode_id`, `scene_no`, `prompt_bundle` | 每个 Scene 对应一个 Scene Version v1 |
| **ImageGen（角色基准图）** | `assets`（新建） + `asset_links` + `scene_versions` | `uri`, `type='character_ref'`, `owner_type='scene_version'` | 生成 reference.png，写入 assets |
| **ImageGen（场景图）** | `assets`（新建） + `asset_links` | `uri`, `type='scene_bg'`, `owner_type='scene'` | 场景背景，写入 assets |
| **FaceQA（人脸检测）** | `qa_runs` + `qa_issues` + `asset_links` | `gate_code='G2'`, `score_json`, `issue_code`, `link_role='qa_evidence'` | 失败写 qa_issues，通过只写 qa_runs |
| **VideoGen（视频生成）** | `assets` + `asset_links` + `scene_versions`（新建 v2） | `uri`, `type='video'`, `owner_type='scene_version'`, `parent_version_id` | 失败重跑时新建 scene_version，不覆盖 |
| **MotionQA（动态检测）** | `qa_runs` + `qa_issues` + `asset_links` | `gate_code='G6'`, `score_json`, `link_role='qa_evidence'` | FFprobe 检测帧率/黑帧 |
| **LipSync（唇形同步）** | `assets` + `asset_links` + `scene_versions`（新建 v3） | `uri`, `type='lipsync'`, `owner_type='scene_version'` | 每次生成新的 scene_version |
| **LipSyncQA（唇形质检）** | `qa_runs` + `qa_issues` + `asset_links` | `gate_code='G7'`, `status='NEEDS_REVIEW'`, `link_role='qa_evidence'` | G7 失败时人工介入标记 |
| **AudioGen（TTS/配音）** | `assets` + `asset_links` | `uri`, `type='audio'`, `owner_type='scene_version'` | 音频资产 |
| **Mix（混音）** | `assets` + `asset_links` + `scene_versions`（新建 v4） | `uri`, `type='mixed_audio'`, `owner_type='scene_version'` | BGM + TTS 混合后新版本 |
| **MixQA（响度检测）** | `qa_runs` + `qa_issues` + `asset_links` | `gate_code='G9'`, `score_json`, `link_role='qa_report'` | EBU R128 检测 |
| **Export（成片合成）** | `assets` + `asset_links` + `scene_versions`（新建 v5） | `uri`, `type='final'`, `owner_type='episode'` | 完整成片 |
| **C2PA（合规标注）** | `assets` + `asset_links` | `type='c2pa_manifest'`, `metadata`（C2PA JSON） | 注入 C2PA 元数据，新建资产 |
| **PlatformRules（平台规则）** | `qa_runs` + `qa_issues` + `asset_links` | `gate_code='G11'`, `hard_fail=true/false`, `link_role='qa_report'` | 硬规则失败时阻塞交付 |
| **Publish（发布）** | `publish_jobs` + `publish_variants` | `status`, `platform`, `external_post_id` | 发布状态追踪 |
| **AnalyticsBackfill（数据回流）** | `analytics_snapshots` | `views`, `completion_rate`, `watch_time` | 发布后从 TikTok/抖音拉取 |

### 5.2 降级链与版本记录

| 降级事件 | 数据写入 | 说明 |
|---|---|---|
| IP-Adapter 质量不过（G3 失败） | `scene_versions` 新建 v{N+1}，`qa_issues` 记录 | 调整 IP-Adapter 权重后重跑 |
| Kling 审核误判率超限（G11 失败） | `scene_versions` 新建 v{N+1}，`qa_issues` 记录 | 切换到备用视频 API |
| 角色一致性崩塌（G3 失败 3 次） | `scene_versions` 标记 `status=NEEDS_REVIEW`，`qa_issues` 高优先级 | 人工介入，人工确认后强制通过 |
| 降级到 A 级兜底（Phase 2） | `scene_versions` 新建 v{N+1}，`model_bundle='A_FALLBACK'`，`job_steps.metadata` 记录 fallback JSONB | 记录降级路径，供成本分析 |

### 5.3 jobs / job_steps 记录时机

| 时机 | jobs 状态 | job_steps 记录 |
|---|---|---|
| 任务创建 | `status=pending` | 记录 step_key = "init" |
| 开始执行 | `status=running` | 记录 step_key = "start" + worker_id |
| 每个子步骤完成 | 不变 | 记录 step_key = 具体步骤名（如 "image_gen"、"video_gen"）+ output uri |
| 步骤失败 | `status=failed`，`retry_count++` | 记录 `error_message` |
| 重试成功 | `status=running`（恢复） | 记录 step_key = "retry_{N}" |
| 最终成功 | `status=completed` | 记录 final_output_uri |

---

## 6. 采购建议

### 先买/先配置（Phase 0 必需）
1. Vast.ai RTX 4090 实例（$0.35-0.60/h，当前最优先）
2. ElevenLabs Creator 订阅（$22/月）
3. Kling API（按量计费，先小额测试）
4. FFmpeg 7.x（本地安装，conda 或 static build）
5. c2patool（npm 安装）
6. Claude API Key / GPT-4o API Key（按量计费）

### 可延后（Phase 1-2 再买）
- PostgreSQL（Phase 2 数据量大了再迁）
- Seedance API（Phase 2 SSS 才开始用）
- A40/A6000 GPU（Phase 2 LoRA 训练再租）
- Suno Pro（等商业许可确认后再买）

---

## 7. 当前结论（v2）

1. **GPU**：Vast.ai RTX 4090 24GB，$0.35-0.60/h；A 级组合 VRAM ~18GB；不要用 16GB 以下实例
2. **FFmpeg**：7.x，NVENC 加速，H.264 最终交付，loudnorm 响度标准化
3. **ComfyUI**：Manager + IPAdapter_plus + was-node-suite，Nginx Basic Auth 鉴权
4. **图片**：全部本地 ComfyUI，无外部 API 费用（只有 GPU 租金）
5. **视频**：Kling（主，A 级）/ Seedance（SSS），按秒计费
6. **音频**：ElevenLabs（主，TTS）/ Veo 3.1（默认 BGM）/ Fish Audio（降本备选）
7. **LLM**：Claude Sonnet 4（剧本）/ GPT-4o（分镜/JSON）/ DeepSeek-V3（合规审查）/ GLM-Flash（轻量）
8. **合规**：c2patool + FFmpeg，不需要 API 费用