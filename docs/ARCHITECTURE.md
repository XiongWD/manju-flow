# 漫剧 Production OS — 系统架构文档

> 代号：ArcLine _(Arc + Pipeline)_
> 版本：v1.2（深度补全版）
> 定位：单人/小团队驱动的 AI 漫剧工业化生产操作系统
> 最后更新：2026-04-26 UTC

---

## 0. 架构哲学

| 原则 | 含义 | 约束 |
|---|---|---|
| 确定性优先 | LLM 是工具，不是调度器 | DAG、状态机、回退路径必须硬编码 |
| 镜头级最小替换 | 原子粒度是 Shot/Scene | 返修不允许整集重跑 |
| 数据飞轮 | 每次生产都沉淀为资产和知识 | Prompt、参数、QA、发布数据都可追溯 |

---

## 1. 产品边界与 8 大模块

ArcLine 不是单纯生成面板，而是完整的 **Production OS**。V1 主体覆盖 8 个模块：

1. **项目与配置中心**：项目、市场/题材预设、规则集、模型偏好
2. **故事与剧本中心**：Story Bible、Character Bible、Episode Outline、Scene Script
3. **生产调度中心**：流水线编排、任务队列、GPU 管理、重试/回退
4. **素材浏览器**：角色/场景/镜头/版本/证据资产统一浏览
5. **后期剪辑中心**：时间线、局部返修、字幕、混音、Version Diff
6. **QA 中心**：自动门禁 + 人工复核 + 失败归因
7. **审核与交付中心**：交付包、平台变体、发布前确认、规则报告
8. **数据分析与复盘中心**：成本、完播、失败模式、知识沉淀

### 1.1 V1 不做

- 不做多租户 SaaS 权限系统
- 不做 OpenClaw 主调度
- 不做无人值守全自动发布
- 不做泛化大而全 RAG 平台

---

## 2. 系统全景图

```text
┌──────────────────────────────────────────────────────────────────────┐
│                         ArcLine Production OS                       │
│                                                                      │
│  Web Console (唯一生产入口)                                          │
│  Dashboard / Projects / Story / Shot Editor / QA / Assets           │
│  Edit / Delivery / Analytics / Settings                             │
│                              │                                       │
│                              ▼ REST API + WebSocket                 │
│  Control Plane (FastAPI)                                            │
│  /api/projects /api/episodes /api/scenes /api/qa /api/assets        │
│  /api/publish /api/analytics /api/rules /ws/live                    │
│      │               │                │              │               │
│      ▼               ▼                ▼              ▼               │
│  Pipeline Engine   Rule Engine     Asset Store   Knowledge Base      │
│  Scheduler         QA Gate         Publish Flow  Analytics Flow      │
│      │                                                              │
│      ▼                                                              │
│  Execution Plane                                                    │
│  Script Worker / Visual Worker / Audio Worker / QA Worker           │
│  Edit Worker / Publish Worker / Local FFmpeg Worker                 │
│      │                                                              │
│      ├────────── GPU Cloud Node (Vast.ai / ComfyUI)                 │
│      ├────────── External APIs (Claude / GPT-4o / GLM /             │
│      │                     ElevenLabs / Fish / Suno / Kling)        │
│      └────────── Local CPU Tools (FFmpeg / c2patool)                │
│                                                                      │
│  Data Plane                                                          │
│  SQLite(MVP) + SQLAlchemy迁移层 + Object-like Asset Store + JSON快照 │
└──────────────────────────────────────────────────────────────────────┘
```

### 2.1 分层职责

| 层 | 职责 | 明确不做 |
|---|---|---|
| Web Console | 唯一生产入口、审核、剪辑、交付、分析 | 不直接碰 GPU/数据库 |
| Control Plane | 调度、状态、规则、API、回调 | 不做重 GPU 推理 |
| Execution Plane | 执行具体任务 | 不做产品决策 |
| GPU Cloud Node | 生图、锁脸、微动态、唇形、超分 | 不跑业务逻辑 |
| Local CPU Tools | 拼接、混音、字幕、水印、C2PA | 不做调度 |

---

## 3. Web 前端信息架构

### 3.1 一级导航

1. Dashboard
2. Projects
3. Story & Characters
4. Shot Editor / Timeline
5. Render Queue
6. QA Center
7. Asset Browser
8. Edit & Delivery
9. Analytics
10. Settings

### 3.2 核心页面职责

#### Dashboard
- 活跃项目、集数进度、失败告警、今日成本、GPU 状态
- API: `/api/projects`, `/api/pipeline/status`, `/api/analytics/cost/today`, `/api/gpu/status`

#### Projects
- 项目 CRUD、题材/平台/Tier/预算配置、剧集列表
- API: `/api/projects`, `/api/projects/{id}/episodes`

#### Story & Characters
- Story Bible、Character Bible、角色参考图、voice mapping
- API: `/api/story`, `/api/characters`

#### Shot Editor / Timeline
- Scene 列表、Scene Version、Prompt/Seed、预览、局部返修、Version Diff
- API: `/api/scenes`, `/api/scenes/{id}/versions`, `/api/scenes/{id}/regenerate`

#### Render Queue
- Job 队列、GPU 实例、任务重试/取消/优先级
- API: `/api/jobs`, `/api/gpu/*`

#### QA Center
- 自动门禁结果、人工待审、失败原因聚类、批量放行/打回
- API: `/api/qa/*`

#### Asset Browser
- 角色资产、场景资产、镜头资产、证据资产、交付资产统一浏览
- API: `/api/assets`, `/api/assets/{id}`

#### Edit & Delivery
- 时间线、字幕、混音、导出、交付包、平台变体标题/封面/文案、规则报告
- API: `/api/episodes/{id}/edit`, `/api/publish/*`, `/api/rules/report/*`

#### Analytics
- 成本、失败率、完播率、平台数据回流、知识复盘
- API: `/api/analytics/*`, `/api/knowledge/*`

---

## 4. 配置继承体系

为避免 scene 级参数爆炸，采用五级继承：

```text
全局默认
  ↓
市场预设（US / UK / SEA）
  ↓
题材预设（Revenge / Werewolf / Mafia / CEO）
  ↓
项目级覆盖
  ↓
剧集 / Scene 局部覆盖
```

### 4.1 可继承配置范围
- 模型路由偏好
- Prompt 风格预设
- QA 阈值
- 平台规则集
- 音频默认参数
- 导出模板

---

## 5. Pipeline Engine 与状态机

### 5.1 核心思想
- 以 **Scene** 为生产单元
- 以 **Scene Version** 为变更单元
- 以 **Job / Job Step** 为执行单元
- 以 **QA Gate** 为回退单元

### 5.2 标准 DAG

```text
Script
 → Compliance
 → PromptGen
 → ImageGen
 → Face/Composition QA
 → VideoGen
 → Motion QA
 → LipSync
 → LipSync QA
 → AudioGen
 → Audio QA
 → Mix
 → Mix QA
 → Export
 → Platform Rules QA
 → Human Final Review
```

### 5.3 Scene 状态机

```text
DRAFT
→ SCRIPT_READY
→ PROMPT_READY
→ IMAGE_READY
→ VIDEO_READY
→ AUDIO_READY
→ QA_PENDING
→ QA_FAILED / QA_PASSED
→ EDITING
→ LOCKED
→ EXPORTED
→ DELIVERED
```

### 5.4 Episode 状态机

```text
DRAFTING
→ IN_PRODUCTION
→ IN_REVIEW
→ READY_FOR_DELIVERY
→ DELIVERED
→ PUBLISHED(optional)
→ ARCHIVED
```

---

## 6. QA Gate System（节点绑定式）

### 6.1 总原则
- 自动层先跑，人工层后兜底
- 每道门都必须绑定：**触发节点 / 阈值 / fail 回退 / 状态变更**
- 自动重试最多 3 次，仍失败进入 `NEEDS_REVIEW`

### 6.2 Gate 明细

| Gate | 触发节点 | 检测方式 | 阈值 | 失败回退 | 执行方 |
|---|---|---|---|---|---|
| G1a 大纲结构 | Script | 节拍检查 | 全覆盖 | 重写大纲 | 自动 |
| G1b 合规红线 | Compliance | 正则+LLM | 100%通过 | 重写剧本 | 自动 |
| G1c JSON 格式 | PromptGen 前 | jsonschema | 字段完整 | 自动补全 | 自动 |
| G1d Prompt 安全 | PromptGen 后 | 敏感词/语义审计 | 无违规 | 重写 Prompt | 自动 |
| G2 人脸完整性 | ImageGen 后 | InsightFace/CV | 无崩脸/多指/多脸 | 回退 ImageGen | 自动 |
| G3 角色一致性 | ImageGen 后 | cosine similarity | ≥0.72 | 调 IP-Adapter 重跑 | 自动 |
| G4 构图安全区 | ImageGen 后 | CV 检测 | 满足 safe zone | 调构图重跑 | 自动 |
| G5 图像综合质量 | ImageGen 后 | GPT-4o Vision | ≥85/100 | 换 Seed 重跑 | 自动→人工 |
| G6 动态质量 | VideoGen 后 | FFprobe/帧检测 | 无黑帧/花屏/帧率正确 | 回退 VideoGen | 自动 |
| G7 唇形同步质量 | LipSync 后 | 自动初筛 + 人工抽检 | 自然无伪影 | 回退 LipSync 或跳过 | 自动→人工 |
| G8 配音时长匹配 | AudioGen 后 | FFprobe | 误差 ≤0.3s | 回退 AudioGen | 自动 |
| G9 爆音/响度 | AudioGen/Mix 后 | loudnorm / EBU R128 | 达标 | 回退 Mix | 自动 |
| G10 成片终检 | Export 后 | 分辨率/编码/大小/水印/C2PA | 全通过 | 回退 Export | 自动 |
| G11 平台规则校验 | Delivery 前 | rules.json | 硬规则全过 | 阻塞交付 | 自动 |
| G12 人工终审 | Delivery 前 | Web 预览 | 主观达标 | 定位问题 scene 返修 | 人工 |

### 6.3 自动层与人工层
- 自动层：G1a-G6, G8-G11
- 人工层：G5 超限、G7、G12

---

## 7. GPU 云节点职责

## 7. GPU 云节点部署手册

### 7.1 Vast.ai 实例部署步骤

#### Step 1：选镜像
推荐镜像：`PyTorch 2.1 + CUDA 12.1` 或 `Paperspace Ubuntu 22.04`
- 确认 Python 3.11+
- 确认 CUDA 12.x + cuDNN 8.x
- 磁盘预留 150GB+（模型体量）

#### Step 2：初始化环境
```bash
# 系统依赖
apt update && apt install -y git wget curl libgl1 libglib2.0-0

# Python 环境（建议 conda）
conda create -n comfyui python=3.11
conda activate comfyui

# ComfyUI 本体
cd /opt
git clone https://github.com/comfyanonymous/ComfyUI.git
cd ComfyUI
pip install -r requirements.txt
```

#### Step 3：安装自定义节点
```bash
# ComfyUI Manager（必须）
cd /opt/ComfyUI/custom_nodes
git clone https://github.com/ComfyUI-Manager/ComfyUI-Manager

# IP-Adapter Plus（必须）
git clone https://github.com/cubiq/ComfyUI_IPAdapter_plus

# 辅助节点（建议）
git clone https://github.com/WASasquash/was-node-suite-comfyui
```

#### Step 4：模型文件落地
```
# 目录结构
/models/
├── flux/                    # ~20GB
│   ├── flux1-dev-fp8.safetensors
│   └── flux1-schnell-fp8.safetensors
├── ipadapter/              # ~4GB
│   ├── ipadapter-plus_vit_h.safetensors
│   └── ipadapter_model.safetensors
├── liveportrait/           # ~2GB
│   └── liveportrait_model.pth
├── musetalk/               # ~1GB
│   └── musetalk_model.onnx
└── esrgan/                 # ~500MB
    └── RealESRGAN_x4plus.pth
```

#### Step 5：启动 + API 鉴权配置

**方案 A（Nginx 反代 + Basic Auth，推荐生产环境）**：
```nginx
# /etc/nginx/sites-available/comfyui
server {
    listen 8188;
    location / {
        proxy_pass http://127.0.0.1:8188;
        auth_basic "ArcLine ComfyUI";
        auth_basic_user_file /etc/nginx/.htpasswd;
    }
}
```
```bash
# 生成密码
htpasswd -bc /etc/nginx/.htpasswd admin YOUR_PASSWORD
```

**方案 B（仅 IP 白名单，适合 Vast.ai 独享实例）**：
在 ComfyUI 的 `extra_network_config.yaml` 设置允许的 IP。

#### Step 6：健康检查 heartbeat

GPU 实例必须实现 heartbeat，防止失联后任务挂死：

```python
# backend/services/gpu/heartbeat.py
class GPUInstanceMonitor:
    def __init__(self, instance_id: str, vastai_api_key: str):
        self.instance_id = instance_id
        self.vastai_api = VastAIAPI(api_key=vastai_api_key)
        self.last_heartbeat = datetime.utcnow()
        self.timeout_seconds = 300  # 5分钟无响应视为离线

    def ping(self) -> bool:
        """检查 ComfyUI API 是否响应"""
        try:
            r = httpx.get(f"http://{self.instance_ip}:8188/system_stats", timeout=10)
            return r.status_code == 200
        except:
            return False

    def is_alive(self) -> bool:
        elapsed = (datetime.utcnow() - self.last_heartbeat).seconds
        return elapsed < self.timeout_seconds and self.ping()

    def health_check_loop(self):
        while True:
            if not self.ping():
                # 标记实例为 degraded，触发任务重调度
                mark_instance_degraded(self.instance_id)
                # 尝试重启实例
                self.vastai_api.restart_instance(self.instance_id)
            else:
                self.last_heartbeat = datetime.utcnow()
            time.sleep(60)  # 每分钟检查一次
```

#### Step 7：任务超时配置

| 任务类型 | 超时时间 | 超过后动作 |
|---|---|---|
| 生图（Flux fp8） | 120 秒 | 标记失败，重跑 |
| 视频（Kling API） | 300 秒 | 轮询结果，超时标记 |
| 唇形同步（MuseTalk） | 180 秒 | 标记失败，可跳过 |
| 放大（ESRGAN） | 120 秒 | 标记失败，重跑 |

---

### 7.2 ComfyUI Worker 配置

```yaml
# backend/config/comfyui_worker.yaml
comfyui:
  base_url: "http://{GPU_INSTANCE_IP}:8188"
  auth:
    type: "basic"  # basic / ip_whitelist / none
    username: "admin"
    password: "{COMFYUI_PASSWORD}"
  concurrency:
    max_concurrent_jobs: 1  # RTX 4090 单卡建议串行
    queue_size: 20
  timeouts:
    image_generation: 120
    video_generation: 300
    lipsync: 180
    upscaling: 120
  retry:
    max_retries: 3
    backoff_seconds: 10
  model_loading:
    # 哪些模型常驻 GPU（减少重复加载）
    always_loaded:
      - flux1-dev-fp8
      - ipadapter-plus_vit_h
    # 按需加载（每次任务前加载，结束后卸载）
    on_demand:
      - liveportrait_model
      - musetalk_model
      - RealESRGAN_x4plus
```

---

### 7.3 GPU 节点职责边界

**允许运行**：
- ComfyUI + Flux（生图）
- IP-Adapter / InstantID（角色一致性）
- LivePortrait（表情动作）
- MuseTalk / Wav2Lip（唇形同步）
- Real-ESRGAN（超分）
- InsightFace / CV 检测

**禁止运行**：
- 业务逻辑（判断是否通过 QA、是否应该降级）
- 数据库写入（所有 assets/qa_runs 由后端写）
- 发布逻辑（publish_jobs 由后端写）
- 最终状态决策（所有状态机由后端控制）

**通信协议**：
- 入：后端通过 REST API 提交任务
- 出：GPU 节点通过 REST API 回调结果
- 监控：后端 heartbeat 轮询 GPU 实例健康状态

---

### 7.4 显存管理与 OOM 防护

**VRAM 分配规则**：
1. Flux + IP-Adapter 常驻显存（~18GB）
2. LivePortrait/MuseTalk 按需加载，用完释放
3. ESRGAN 最后执行，执行完释放
4. 单卡并发任务数：1（RTX 4090），不要同时跑两个生图任务

**OOM 降级策略**：
- 检测到 CUDA OOM → 自动降低图片分辨率（从 1024→768）
- 连续 OOM → 切换到更小的模型（Flux Schnell 替代 Flux Dev）
- 降级后仍失败 → 标记 NEEDS_REVIEW，人工介入

---

### 7.5 GPU 实例选型参考

| 场景 | 最低规格 | 推荐规格 | 预算 |
|---|---|---|---|
| A 级生图 + IP-Adapter | RTX 4090 24GB | RTX 4090 24GB | $0.35-0.60/h |
| A 级 + 唇形同步 | RTX 4090 24GB | RTX 4090 24GB | $0.35-0.60/h |
| SSS 级（LoRA 训练） | A40 48GB | A40 48GB | $0.60-1.10/h |
| 并发多任务 | 双 RTX 4090 | A5000 × 2 | $0.80-1.50/h |

---

## 8. Execution Plane / Worker 模型

### 8.1 Worker 分类
- Script Worker
- Visual Worker
- Audio Worker
- QA Worker
- Edit Worker
- Publish Worker
- Local FFmpeg Worker

### 8.2 Worker 状态
- `idle`
- `busy`
- `degraded`
- `offline`

### 8.3 Job 分层
- **Job**：业务任务（如 regenerate_scene）
- **Job Step**：执行细步（build_prompt / invoke_comfyui / upload_asset）

这样失败定位不会退化成一坨日志。

---

## 8B. Pipeline → 数据模型映射（Section 5 × Section 10 对照）

> 本节打通 Pipeline Engine（Section 5）和数据模型（Section 10）。
> 每个 Pipeline 步骤完成后，具体要写哪些表/字段，一目了然。

### 8B.1 步骤与数据写入对照表

**强制规则**：
- `scene_versions` 只记录版本状态、参数、模型包、分数快照、决策结果，不直接承载大文件本体。
- `assets` 只记录物理资产本体（图 / 视频 / 音频 / 字幕 / 规则报告 / C2PA 证明 / QA 证据）。
- `asset_links` 负责把资产绑定到 `scene / scene_version / qa_run / episode / publish_job` 等业务对象。
- 所有 QA 证据必须资产化，禁止只把截图、检测 JSON、对比图留在临时目录。

| Pipeline 步骤 | 主要写入对象 | 关键字段 | QA Gate |
|---|---|---|---|
| **Script** | `story_bibles`（新建） | `id`, `project_id`, `content`, `beat_sheet` | G1a |
| **Compliance** | `qa_runs` + `qa_issues` | `gate_code='G1b'`, `hard_fail=true/false` | G1b |
| **PromptGen** | `scenes`（新建）+ `scene_versions`（v1） | `scene_no`, `prompt_bundle`, `version_no=1` | G1c, G1d |
| **ImageGen（角色）** | `assets` + `asset_links` + `scene_versions`（v2） | `uri`, `type='character_ref'`, `owner_type='scene_version'`, `version_no=2` | — |
| **ImageGen（场景）** | `assets` + `asset_links` | `uri`, `type='scene_bg'`, `owner_type='scene'` | — |
| **FaceQA** | `qa_runs` + `qa_issues` + `asset_links` | `gate_code='G2'`, `score_json`, `status`, `link_role='qa_evidence'` | G2 |
| **CompositionQA** | `qa_runs` + `qa_issues` + `asset_links` | `gate_code='G4'`, `score_json`, `link_role='qa_evidence'` | G4 |
| **ImageQualityQA** | `qa_runs` + `qa_issues` + `asset_links` | `gate_code='G5'`, `status='NEEDS_REVIEW'`, `link_role='qa_report'` | G5 |
| **VideoGen** | `assets` + `asset_links` + `scene_versions`（新建 vN） | `uri`, `type='video'`, `owner_type='scene_version'`, `parent_version_id` | — |
| **MotionQA** | `qa_runs` + `qa_issues` + `asset_links` | `gate_code='G6'`, `score_json`, `link_role='qa_evidence'` | G6 |
| **LipSync** | `assets` + `asset_links` + `scene_versions`（新建） | `uri`, `type='lipsync'`, `owner_type='scene_version'` | — |
| **LipSyncQA** | `qa_runs` + `qa_issues` + `asset_links` | `gate_code='G7'`, `status='NEEDS_REVIEW'`, `link_role='qa_evidence'` | G7 |
| **AudioGen（TTS）** | `assets` + `asset_links` | `uri`, `type='audio'`, `owner_type='scene_version'` | G8 |
| **Mix** | `assets` + `asset_links` + `scene_versions`（新建） | `uri`, `type='mixed_audio'`, `owner_type='scene_version'` | — |
| **MixQA** | `qa_runs` + `qa_issues` + `asset_links` | `gate_code='G9'`, `score_json`, `link_role='qa_report'` | G9 |
| **Export** | `assets` + `asset_links` + `scene_versions`（更新 status） | `uri`, `type='final'`, `status`, `owner_type='episode'` | G10 |
| **C2PA** | `assets` + `asset_links` | `type='c2pa_manifest'`, `metadata`（C2PA JSON） | — |
| **PlatformRules** | `qa_runs` + `qa_issues` + `asset_links` | `gate_code='G11'`, `hard_fail=true/false`, `link_role='qa_report'` | G11 |
| **HumanFinalReview** | `scene_versions`（更新 status=LOCKED） | `status='LOCKED'` | G12 |
| **Publish** | `publish_jobs` + `publish_variants` | `status`, `platform`, `external_post_id` | — |
| **AnalyticsBackfill** | `analytics_snapshots` | `views`, `completion_rate`, `watch_time` | — |

### 8B.2 QA ↔ Asset 字段级绑定规则

为避免 `qa_runs / qa_issues` 与 `assets / asset_links` 只停留在概念关联，V1 先按以下字段约束落地：

- `qa_runs.subject_type`：`scene` / `scene_version` / `episode` / `asset`
- `qa_runs.subject_id`：被检查对象 ID
- `qa_runs.input_asset_id`：本次检测直接输入资产（如待审视频、待审音频）
- `qa_runs.evidence_asset_id`：主证据资产（如热力图、对比图、审核截图、检测 JSON）
- `qa_runs.gate_code`：如 `G2/G3/G6/G9/G11`
- `qa_runs.step_key`：如 `image_gen` / `video_gen` / `mix` / `export`
- `qa_issues.qa_run_id`：归属 QA Run
- `qa_issues.related_asset_id`：问题直接关联资产
- `qa_issues.related_scene_version_id`：问题归属版本
- `asset_links.owner_type='qa_run'`：用于挂多份证据资产
- `asset_links.link_role='qa_input' | 'qa_evidence' | 'qa_report'`：区分输入、证据、报告

这套规则的目标，是让 QA Center、Asset Browser、规则报告页都能反查到同一份证据。

### 8B.3 降级链的版本记录方式

| 降级事件 | 版本行为 | jobs 记录 |
|---|---|---|
| IP-Adapter G3 失败 → 调整权重重跑 | 新建 `scene_versions`，`parent_version_id` 指向前一版 | `job_steps` 记录 `fallback_adjusted` |
| Kling API 超时 → 切换到备用 API | 不新建 scene_version，记录在 `jobs.retry_count` | `job_steps` 记录 `api_fallback` |
| 降级到 A 级兜底（Phase 2） | 新建 `scene_versions`，`model_bundle='A_FALLBACK'` | `jobs` 记录 `fallback_path='A_FALLBACK'` |
| 角色一致性崩溃（3次重试失败） | `scene_versions.status=NEEDS_REVIEW`，`qa_issues` 高优先级 | `job_steps` 记录 `human_review_required` |

### 8B.4 jobs / job_steps 记录时机

| 时机 | jobs 状态 | job_steps 记录 |
|---|---|---|
| 任务创建 | `status=pending` | step_key=`init` |
| 开始执行 | `status=running` | step_key=`start` + worker_id |
| 每个子步骤完成 | 不变 | step_key=具体步骤名 + output_uri |
| 步骤失败 | `status=failed`，`retry_count++` | `error_message` |
| 重试成功 | `status=running` | step_key=`retry_{N}` |
| 最终成功 | `status=completed` | final_output_uri |
| 用户取消 | `status=cancelled` | step_key=`cancelled` |

### 8B.4 scene_versions 状态机（与 Pipeline 联动）

```
scene_versions.status 流转：

GENERATING（Pipeline 执行中）
  ↓
QA_PASSED（G1-G11 自动门全通过）
  ↓
NEEDS_REVIEW（G5 超限 / G7 超限 / 3次重试失败）
  ↓
MANUAL_APPROVED（人工强制通过）
  ↓
LOCKED（G12 人工终审通过）
  ↓
DELIVERED（发布完成）
```

---


## 9. Asset Store（对象关系化）

### 9.1 资产类型
- 角色资产：reference / side / expressions / embedding
- 场景资产：background / establishing / keyframe
- 道具资产：props / held items
- 镜头资产：image / video / audio / subtitle / qa evidence
- 交付资产：final cut / cover / publish package / rules report
- 知识资产：prompt templates / failure cases / beat patterns

### 9.2 资产模型
不只用目录树，使用 **assets + asset_links**：

- `assets`：物理资产本体
- `asset_links`：资产与 scene / scene_version / qa_run / episode / publish_job 的关系

### 9.3 目录建议

```text
projects/
├── {project_id}/
│   ├── characters/
│   ├── scene-assets/
│   ├── episodes/
│   │   ├── {episode_id}/
│   │   │   ├── script/
│   │   │   ├── scenes/
│   │   │   ├── subtitles/
│   │   │   ├── mixes/
│   │   │   ├── exports/
│   │   │   └── reports/
│   ├── delivery/
│   └── knowledge/
└── shared/
    ├── sfx/
    ├── transitions/
    └── watermark/
```

---

## 10. 数据模型（V1）

### 10.1 最关键的对象

```text
Project
 ├─ Story Bible
 ├─ Character Bank
 ├─ Episode
 │   ├─ Scene
 │   │   ├─ Scene Version
 │   │   ├─ Assets
 │   │   └─ QA Runs
 │   ├─ Timeline
 │   ├─ Export
 │   └─ Publish Package
 ├─ Knowledge Items
 └─ Analytics
```

### 10.2 核心表

#### projects
项目主数据：名称、题材、市场、平台、Tier、预算、配置覆盖

#### project_configs
项目级配置覆盖：`config_key`, `config_value_json`, `version`

#### story_bibles
世界观/结构化剧情设定

#### characters
角色主数据：角色设定、voice profile、canonical asset

#### character_assets
角色资产映射：front / side / expression / reference

#### episodes
剧集主数据：outline、script、duration、status、current_cut_asset

#### scenes
镜头主数据：scene_no、duration、status、`locked_version_id`

#### scene_versions  **(必须存在)**
版本化核心：
- `scene_id`
- `parent_version_id`
- `version_no`
- `prompt_bundle`
- `model_bundle`
- `params`
- `change_reason`
- `status`
- `score_snapshot`
- `cost_actual`

#### assets
物理资产本体：uri、type、mime、size、duration、metadata

`assets.type` 最低覆盖：`character_ref`, `scene_bg`, `image`, `video`, `audio`, `mixed_audio`, `subtitle`, `cover`, `rules_report`, `c2pa_manifest`, `watermark_proof`, `qa_evidence`, `detection_json`

#### asset_links
资产与业务对象关系：`owner_type`, `owner_id`, `relation_type`

#### jobs
任务主表：job_type、target_type、target_id、worker_type、retry_count、cost_actual

#### job_steps
任务细步：step_key、tool_name、input/output、error_message

#### qa_runs
每次 QA 运行：gate_code、target、status、score_json、threshold_snapshot、`subject_type`、`subject_id`、`input_asset_id`、`evidence_asset_id`、`step_key`

#### qa_issues
QA 具体问题：issue_code、severity、message、evidence_asset_id、`related_asset_id`、`related_scene_version_id`、suggested_action

#### publish_jobs
交付/发布任务：platform、scheduled_at、status、external_post_id、payload

#### publish_variants
平台变体：title、caption、hashtags、cover_asset_id、is_selected

#### analytics_snapshots
平台回流：views、completion_rate、likes、comments、shares、watch_time

#### knowledge_items
知识沉淀：success/failure/hook/rule/playbook

---

## 11. 审核与交付中心

### 11.1 交付包内容
- final.mp4
- subtitle.srt
- watermark/c2pa proof
- rules report
- cover variants
- title/caption/hashtags

### 11.2 交付流程

```text
Export
→ Platform Rules Report
→ Human Final Review
→ Build Delivery Package
→ Optional Publish Job
→ Analytics Backfill
```

### 11.3 平台规则引擎
- `target_platform = tiktok | douyin`
- `tiktok.json` / `douyin.json`
- 硬规则阻塞，软规则 flag

---

## 12. Analytics 与知识复盘

### 12.1 分析维度
- 项目/集/镜头成本
- QA Gate 失败率
- 模型稳定性
- 发布表现（完播/互动）
- 题材/钩子/镜头模式表现

### 12.2 知识沉淀来源
- 高分 prompt
- 失败案例及修复路径
- 高完播节拍模式
- 平台规则变更记录

---

## 13. OpenClaw 边界定义

OpenClaw 是**辅助层**，不是主生产引擎。

### 13.1 允许
- 复盘分析
- 知识库读写建议
- 外围监控/告警
- 发布后数据总结

### 13.2 禁止
- 不直接写业务数据库
- 不直接删改资产
- 不绕过 QA 放行
- 不直接修改锁定版本
- 不直接发布成片

---

## 14. 技术栈

### 前端
- React 18
- TypeScript
- shadcn/ui
- Tailwind CSS
- Zustand

### 后端
- FastAPI
- SQLAlchemy
- SQLite（MVP）
- Alembic（预留 PostgreSQL 迁移）
- WebSocket

### 执行层
- Vast.ai + ComfyUI
- FFmpeg
- c2patool

### 外部服务
- Claude / GPT-4o / GLM
- ElevenLabs / Fish Audio / Suno
- Kling / Seedance

---

## 15. 设计规范

### 15.1 风格基准
- 现代 SaaS
- 参考 Linear / Vercel
- 功能优先，装饰最小

### 15.2 禁止模式
- 渐变紫/蓝默认配色
- 无意义装饰插图
- 纯文本堆砌表单
- 过度圆角和大阴影

### 15.3 强制要求
- 编码前先出设计稿
- 深浅主题切换
- 8px 栅格
- 状态色、骨架屏、Toast、空状态

---

## 16. 当前结论

1. Web UI 是唯一生产入口
2. Scene Version 是必须建模对象
3. Asset Store 必须对象关系化，而不是只靠目录树
4. QA Gate 必须绑定节点与回退路径
5. 发布/交付/分析/复盘是 V1 正式边界，不是二期幻想
6. OpenClaw 保持辅助层边界，不进入主调度
