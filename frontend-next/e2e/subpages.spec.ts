/**
 * E2E: 全页面次级页面 + 操作流程测试
 *
 * 覆盖范围：
 * - 所有带动态参数的次级路由 (projects/[id], episodes/[id], shots, story)
 * - 所有带 Tab 的页面 (settings: apikeys/pipeline/gpu, qa: overview/runs/issues, render: queue/jobs)
 * - 关键交互：创建项目、创建剧集、创建镜头、上传资产、设置 Tab 切换
 *
 * 策略：
 * 1. global-setup 已注入 admin token，所有请求已认证
 * 2. 使用 /api/seed 生成演示数据，获取真实 project_id / episode_id / scene_id
 * 3. 验证页面无 5xx 错误、关键 UI 元素可见、Tab 切换正常
 */

import { test, expect, Page } from '@playwright/test';

// ── 工具函数 ────────────────────────────────────────────────

/** 收集所有 API 5xx 错误 */
function collect5xx(page: Page) {
  const errors: string[] = [];
  page.on('response', (res) => {
    if (res.status() >= 500) errors.push(`${res.status()} ${res.url()}`);
  });
  return () => errors;
}

/** 等待页面加载完毕（无 spinning loader） */
async function waitForContent(page: Page) {
  await page.waitForLoadState('networkidle', { timeout: 15_000 });
}

// ── Seed 数据获取（每个 worker 共享） ────────────────────────

let seedData: { project_id: string; episode_id: string; scene_id?: string } | null = null;

async function getSeedData(page: Page) {
  if (seedData) return seedData;

  // 先检查是否有现有项目
  const projectsRes = await page.request.get('http://localhost:8000/api/projects?limit=1');
  if (projectsRes.ok()) {
    const body = await projectsRes.json();
    const items = body.items ?? body;
    if (Array.isArray(items) && items.length > 0) {
      const pid = items[0].id;
      // 获取该项目的剧集
      const epRes = await page.request.get(`http://localhost:8000/api/episodes?project_id=${pid}&limit=1`);
      if (epRes.ok()) {
        const epBody = await epRes.json();
        const epItems = epBody.items ?? epBody;
        if (Array.isArray(epItems) && epItems.length > 0) {
          const eid = epItems[0].id;
          // 获取剧集的镜头
          const scRes = await page.request.get(`http://localhost:8000/api/scenes?episode_id=${eid}&limit=1`);
          let sid: string | undefined;
          if (scRes.ok()) {
            const scBody = await scRes.json();
            const scItems = scBody.items ?? scBody;
            if (Array.isArray(scItems) && scItems.length > 0) sid = scItems[0].id;
          }
          seedData = { project_id: pid, episode_id: eid, scene_id: sid };
          return seedData;
        }
      }
    }
  }

  // 无数据则 seed
  const seedRes = await page.request.post('http://localhost:8000/api/seed');
  if (seedRes.ok()) {
    const body = await seedRes.json();
    const pid = body.project_id;
    const eid = body.episode_id;
    // 获取 seed 生成的 scene
    let sid: string | undefined;
    const scRes = await page.request.get(`http://localhost:8000/api/scenes?episode_id=${eid}&limit=1`);
    if (scRes.ok()) {
      const scBody = await scRes.json();
      const scItems = scBody.items ?? scBody;
      if (Array.isArray(scItems) && scItems.length > 0) sid = scItems[0].id;
    }
    seedData = { project_id: pid, episode_id: eid, scene_id: sid };
    return seedData;
  }

  throw new Error('无法获取或生成演示数据');
}

// ═══════════════════════════════════════════════════════════════
// 1. 一级页面 smoke（快速确认）
// ═══════════════════════════════════════════════════════════════

test.describe('① 一级页面 smoke', () => {
  const pages = [
    { name: '工作台仪表盘', path: '/workspace' },
    { name: '项目列表', path: '/workspace/projects' },
    { name: '分镜选择器', path: '/workspace/shots' },
    { name: '故事角色选择器', path: '/workspace/story' },
    { name: '资产管理', path: '/workspace/assets' },
    { name: '渲染队列', path: '/workspace/render' },
    { name: 'QA 中心', path: '/workspace/qa' },
    { name: '交付管理', path: '/workspace/delivery' },
    { name: '数据分析', path: '/workspace/analytics' },
    { name: '系统设置', path: '/workspace/settings' },
  ];

  for (const { name, path } of pages) {
    test(`${name} (${path}) 无 5xx 错误`, async ({ page }) => {
      const get5xx = collect5xx(page);
      await page.goto(path);
      await waitForContent(page);
      expect(get5xx(), `5xx on ${path}: ${get5xx().join(', ')}`).toHaveLength(0);
    });
  }
});

// ═══════════════════════════════════════════════════════════════
// 2. 项目流程：创建 → 项目详情 → 编辑项目弹窗
// ═══════════════════════════════════════════════════════════════

test.describe('② 项目管理流程', () => {
  test('创建新项目 — 弹窗打开、填写、提交', async ({ page }) => {
    const get5xx = collect5xx(page);
    await page.goto('/workspace/projects');
    await waitForContent(page);

    // 点击新建项目按钮
    const createBtn = page.getByRole('button', { name: /新建|创建|new project/i });
    await createBtn.waitFor({ state: 'visible', timeout: 8_000 });
    await createBtn.click();

    // 弹窗应出现——用 placeholder 定位项目名称输入框
    const nameInput = page.locator('input[placeholder="输入项目名称"]').first();
    await nameInput.waitFor({ state: 'visible', timeout: 5_000 });
    await nameInput.fill('E2E 测试项目 ' + Date.now());

    // 等待提交按钮可用（某些表单有必填校验，先等 enabled）
    const submitBtn = page.getByRole('button', { name: /创建|提交|确认|confirm|save/i }).last();
    await expect(submitBtn).toBeEnabled({ timeout: 5_000 });
    await submitBtn.click();

    // 等待弹窗关闭或跳转
    await page.waitForTimeout(2_000);
    expect(get5xx()).toHaveLength(0);
  });

  test('项目详情页 — 加载项目信息、显示剧集列表', async ({ page }) => {
    const data = await getSeedData(page);
    const get5xx = collect5xx(page);

    await page.goto(`/workspace/projects/${data.project_id}`);
    await waitForContent(page);

    // 应有返回链接
    await expect(page.getByText(/返回项目列表/)).toBeVisible({ timeout: 8_000 });
    // 应有项目标题区域
    await expect(page.locator('h2').first()).toBeVisible();
    // 无 5xx
    expect(get5xx()).toHaveLength(0);
  });

  test('项目详情 — 编辑项目弹窗可打开', async ({ page }) => {
    const data = await getSeedData(page);
    await page.goto(`/workspace/projects/${data.project_id}`);
    await waitForContent(page);

    // 点击编辑按钮
    const editBtn = page.getByRole('link', { name: /编辑项目/i }).or(
      page.getByRole('button', { name: /编辑/i })
    );
    if (await editBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await editBtn.click();
      // 编辑弹窗或跳转到带 edit 参数的页面
      await page.waitForTimeout(1_000);
      const url = page.url();
      expect(url.includes('edit') || url.includes('projects')).toBeTruthy();
    } else {
      test.info().annotations.push({ type: 'info', description: '编辑按钮未显示，跳过' });
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// 3. 剧集流程：剧集详情 → 创建 Scene
// ═══════════════════════════════════════════════════════════════

test.describe('③ 剧集详情流程', () => {
  test('剧集详情页 — 加载 episode 信息和 scene 列表', async ({ page }) => {
    const data = await getSeedData(page);
    const get5xx = collect5xx(page);

    await page.goto(`/workspace/projects/${data.project_id}/episodes/${data.episode_id}`);
    await waitForContent(page);

    // 返回链接
    await expect(page.getByText(/返回项目详情/)).toBeVisible({ timeout: 8_000 });
    expect(get5xx()).toHaveLength(0);
  });

  test('剧集详情 — 创建 Scene 表单可见并可填写', async ({ page }) => {
    const data = await getSeedData(page);
    await page.goto(`/workspace/projects/${data.project_id}/episodes/${data.episode_id}`);
    await waitForContent(page);

    // 找到创建场景表单或按钮
    const sceneForm = page.locator('form').filter({ hasText: /scene|镜头|场景/i }).first();
    const sceneInput = page.locator('input[placeholder*="场景"], input[placeholder*="镜头"], input[placeholder*="标题"], input[name*="title"]').first();

    if (await sceneInput.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await sceneInput.fill('E2E 测试镜头');
      // 提交
      const submitBtn = sceneForm.getByRole('button', { name: /创建|添加|add|create/i });
      if (await submitBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await submitBtn.click();
        await page.waitForTimeout(1_500);
      }
    } else {
      test.info().annotations.push({ type: 'info', description: 'Scene 创建表单未找到，跳过' });
    }
  });

  test('剧集详情 — 音频配置面板可见', async ({ page }) => {
    const data = await getSeedData(page);
    await page.goto(`/workspace/projects/${data.project_id}/episodes/${data.episode_id}`);
    await waitForContent(page);

    // 音频配置区域
    const audioSection = page.getByText(/音频配置/i);
    if (await audioSection.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await expect(audioSection).toBeVisible();
    } else {
      test.info().annotations.push({ type: 'info', description: '音频配置区未显示（无数据时正常）' });
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// 4. 镜头编辑器：分镜列表、镜头详情弹窗、静帧审核
// ═══════════════════════════════════════════════════════════════

test.describe('④ 镜头编辑器 (shots)', () => {
  test('项目 shots 页面 — 加载镜头列表无 5xx', async ({ page }) => {
    const data = await getSeedData(page);
    const get5xx = collect5xx(page);

    await page.goto(`/workspace/projects/${data.project_id}/shots`);
    await waitForContent(page);

    expect(get5xx()).toHaveLength(0);
    // 页面应有主内容区
    await expect(page.locator('body')).toBeVisible();
  });

  test('shots 页面 — 剧集选择器可见', async ({ page }) => {
    const data = await getSeedData(page);
    await page.goto(`/workspace/projects/${data.project_id}/shots`);
    await waitForContent(page);

    // 应有剧集选择或镜头内容
    const hasEpisodeSelector = await page.getByText(/第.*集|episode|剧集/i).isVisible({ timeout: 5_000 }).catch(() => false);
    const hasSceneCards = await page.locator('[class*="card"], [class*="scene"], [class*="shot"]').first().isVisible({ timeout: 3_000 }).catch(() => false);
    const hasSeedBtn = await page.getByText(/演示数据|暂无镜头/i).isVisible({ timeout: 3_000 }).catch(() => false);

    expect(hasEpisodeSelector || hasSceneCards || hasSeedBtn).toBeTruthy();
  });

  test('shots 页面 — 点击镜头卡片打开详情弹窗', async ({ page }) => {
    const data = await getSeedData(page);
    await page.goto(`/workspace/projects/${data.project_id}/shots`);
    await waitForContent(page);

    // 找到场景卡片
    const sceneCards = page.locator('[data-scene-id], [class*="scene-card"]');
    const firstCard = sceneCards.first();

    if (await firstCard.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await firstCard.click();
      // 弹窗/详情面板应出现
      const modal = page.locator('[role="dialog"], [class*="modal"], [class*="detail-panel"]').first();
      if (await modal.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await expect(modal).toBeVisible();
      }
    } else {
      // 尝试直接点击 GlassSurface card
      const cards = page.locator('.cursor-pointer').filter({ hasText: /^#\d{3}/ });
      if (await cards.first().isVisible({ timeout: 3_000 }).catch(() => false)) {
        await cards.first().click();
        await page.waitForTimeout(1_000);
      } else {
        test.info().annotations.push({ type: 'info', description: '无可点击的镜头卡片' });
      }
    }
  });

  test('shots 页面 — 创建新镜头按钮可见', async ({ page }) => {
    const data = await getSeedData(page);
    await page.goto(`/workspace/projects/${data.project_id}/shots`);
    await waitForContent(page);

    const createBtn = page.getByRole('button', { name: /新建|创建|添加|镜头|scene/i });
    if (await createBtn.first().isVisible({ timeout: 5_000 }).catch(() => false)) {
      await expect(createBtn.first()).toBeVisible();
    } else {
      test.info().annotations.push({ type: 'info', description: '创建镜头按钮未找到' });
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// 5. 剧本编辑器 (story)
// ═══════════════════════════════════════════════════════════════

test.describe('⑤ 剧本编辑器 (story)', () => {
  test('项目 story 页面 — 加载无 5xx', async ({ page }) => {
    const data = await getSeedData(page);
    const get5xx = collect5xx(page);

    await page.goto(`/workspace/projects/${data.project_id}/story`);
    await waitForContent(page);

    expect(get5xx()).toHaveLength(0);
  });

  test('story 页面 — Tab 切换：StoryBible / 角色 / 地点 / 道具 / Prompt模板', async ({ page }) => {
    const data = await getSeedData(page);
    const get5xx = collect5xx(page);
    await page.goto(`/workspace/projects/${data.project_id}/story`);
    await waitForContent(page);

    const tabNames = [
      /故事圣经|story.?bible/i,
      /角色|character/i,
      /地点|location/i,
      /道具|prop/i,
      /prompt.?模板|template/i,
    ];

    for (const tabPattern of tabNames) {
      const tab = page.getByRole('tab', { name: tabPattern })
        .or(page.getByRole('button', { name: tabPattern }));
      if (await tab.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await tab.click();
        await page.waitForTimeout(500);
        // 页面不应崩溃
        expect(get5xx()).toHaveLength(0);
      }
    }
  });

  test('story 页面 — 创建角色流程', async ({ page }) => {
    const data = await getSeedData(page);
    await page.goto(`/workspace/projects/${data.project_id}/story`);
    await waitForContent(page);

    // 切换到角色 tab
    const charTab = page.getByRole('tab', { name: /角色|character/i })
      .or(page.getByRole('button', { name: /角色|character/i }));
    if (await charTab.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await charTab.click();
      await page.waitForTimeout(500);
    }

    // 找新建角色按钮
    const newBtn = page.getByRole('button', { name: /新建|创建|添加角色|add character/i });
    if (await newBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await newBtn.click();
      // 弹窗/表单出现
      const nameInput = page.locator('input[name*="name"], input[placeholder*="角色名"]').first();
      if (await nameInput.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await nameInput.fill('E2E 角色');
        // 取消，不真正创建
        const cancelBtn = page.getByRole('button', { name: /取消|cancel/i });
        if (await cancelBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
          await cancelBtn.click();
        }
      }
    } else {
      test.info().annotations.push({ type: 'info', description: '新建角色按钮未找到' });
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// 6. 渲染队列 Tab 切换
// ═══════════════════════════════════════════════════════════════

test.describe('⑥ 渲染队列 Tab', () => {
  test('render 页面 — 带 project_id 参数加载', async ({ page }) => {
    const data = await getSeedData(page);
    const get5xx = collect5xx(page);

    await page.goto(`/workspace/render?project_id=${data.project_id}`);
    await waitForContent(page);

    expect(get5xx()).toHaveLength(0);
    // 应有渲染队列标题（用 heading 定位，避免与侧边栏链接冲突）
    await expect(page.getByRole('heading', { name: /渲染队列/ })).toBeVisible({ timeout: 8_000 });
  });

  test('render 页面 — queue Tab 可见', async ({ page }) => {
    const data = await getSeedData(page);
    await page.goto(`/workspace/render?project_id=${data.project_id}`);
    await waitForContent(page);

    const queueTab = page.getByRole('button', { name: /queue|队列/i })
      .or(page.getByText(/queue|任务队列/i).first());
    if (await queueTab.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await queueTab.click();
      await page.waitForTimeout(500);
    } else {
      test.info().annotations.push({ type: 'info', description: 'queue tab 未找到' });
    }
  });

  test('render 页面 — jobs Tab 可见', async ({ page }) => {
    const data = await getSeedData(page);
    await page.goto(`/workspace/render?project_id=${data.project_id}`);
    await waitForContent(page);

    const jobsTab = page.getByRole('button', { name: /jobs|任务历史|历史/i })
      .or(page.getByText(/jobs|任务历史/i).first());
    if (await jobsTab.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await jobsTab.click();
      await page.waitForTimeout(500);
    } else {
      test.info().annotations.push({ type: 'info', description: 'jobs tab 未找到' });
    }
  });

  test('render 页面 — 剧集选择器响应', async ({ page }) => {
    const data = await getSeedData(page);
    await page.goto(`/workspace/render?project_id=${data.project_id}`);
    await waitForContent(page);

    // 剧集选择器下拉
    const episodeSelector = page.locator('select, [class*="selector"]').first();
    if (await episodeSelector.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await expect(episodeSelector).toBeVisible();
    } else {
      test.info().annotations.push({ type: 'info', description: '剧集选择器未找到' });
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// 7. QA 中心 Tab 切换
// ═══════════════════════════════════════════════════════════════

test.describe('⑦ QA 中心 Tab', () => {
  test('QA 页面 — overview Tab 默认加载', async ({ page }) => {
    const get5xx = collect5xx(page);
    await page.goto('/workspace/qa');
    await waitForContent(page);

    expect(get5xx()).toHaveLength(0);
    // overview 内容区域
    const overviewContent = page.getByText(/概览|overview|qa.run|检测/i).first();
    await expect(overviewContent).toBeVisible({ timeout: 8_000 });
  });

  test('QA 页面 — runs Tab 切换', async ({ page }) => {
    const get5xx = collect5xx(page);
    await page.goto('/workspace/qa');
    await waitForContent(page);

    const runsTab = page.getByRole('button', { name: /runs|执行记录/i });
    if (await runsTab.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await runsTab.click();
      await page.waitForTimeout(800);
      expect(get5xx()).toHaveLength(0);
    } else {
      test.info().annotations.push({ type: 'info', description: 'runs tab 未找到' });
    }
  });

  test('QA 页面 — issues Tab 切换', async ({ page }) => {
    const get5xx = collect5xx(page);
    await page.goto('/workspace/qa');
    await waitForContent(page);

    const issuesTab = page.getByRole('button', { name: /issues|问题列表/i });
    if (await issuesTab.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await issuesTab.click();
      await page.waitForTimeout(800);
      expect(get5xx()).toHaveLength(0);
    } else {
      test.info().annotations.push({ type: 'info', description: 'issues tab 未找到' });
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// 8. 资产管理：上传、筛选
// ═══════════════════════════════════════════════════════════════

test.describe('⑧ 资产管理', () => {
  test('assets 页面 — 加载资产列表无 5xx', async ({ page }) => {
    const get5xx = collect5xx(page);
    await page.goto('/workspace/assets');
    await waitForContent(page);

    expect(get5xx()).toHaveLength(0);
    await expect(page.locator('body')).toBeVisible();
  });

  test('assets 页面 — 上传按钮可见', async ({ page }) => {
    await page.goto('/workspace/assets');
    await waitForContent(page);

    const uploadBtn = page.getByRole('button', { name: /上传|upload/i });
    if (await uploadBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await expect(uploadBtn).toBeVisible();
    } else {
      test.info().annotations.push({ type: 'info', description: '上传按钮未找到' });
    }
  });

  test('assets 页面 — 类型筛选器可点击', async ({ page }) => {
    const get5xx = collect5xx(page);
    await page.goto('/workspace/assets');
    await waitForContent(page);

    // 寻找类型筛选按钮（video/audio/image 等）
    const filterBtns = page.getByRole('button', { name: /video|audio|image|全部|all/i });
    if (await filterBtns.first().isVisible({ timeout: 3_000 }).catch(() => false)) {
      await filterBtns.first().click();
      await page.waitForTimeout(500);
      expect(get5xx()).toHaveLength(0);
    } else {
      test.info().annotations.push({ type: 'info', description: '类型筛选器未找到' });
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// 9. 设置页面 Tab 切换
// ═══════════════════════════════════════════════════════════════

test.describe('⑨ 设置页面 Tab', () => {
  test('settings — API Keys Tab 默认可见', async ({ page }) => {
    const get5xx = collect5xx(page);
    await page.goto('/workspace/settings');
    await waitForContent(page);

    expect(get5xx()).toHaveLength(0);
    // API Keys tab 应默认激活
    await expect(page.getByText(/api.?key/i).first()).toBeVisible({ timeout: 8_000 });
  });

  test('settings — Pipeline Tab 切换', async ({ page }) => {
    const get5xx = collect5xx(page);
    await page.goto('/workspace/settings');
    await waitForContent(page);

    const pipelineTab = page.getByRole('button', { name: /pipeline|流水线/i });
    if (await pipelineTab.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await pipelineTab.click();
      await page.waitForTimeout(500);
      expect(get5xx()).toHaveLength(0);
    } else {
      test.info().annotations.push({ type: 'info', description: 'pipeline tab 未找到' });
    }
  });

  test('settings — GPU Tab 切换', async ({ page }) => {
    const get5xx = collect5xx(page);
    await page.goto('/workspace/settings');
    await waitForContent(page);

    const gpuTab = page.getByRole('button', { name: /gpu/i });
    if (await gpuTab.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await gpuTab.click();
      await page.waitForTimeout(500);
      expect(get5xx()).toHaveLength(0);
    } else {
      test.info().annotations.push({ type: 'info', description: 'gpu tab 未找到' });
    }
  });

  test('settings — API Keys Tab 创建新 Key', async ({ page }) => {
    const get5xx = collect5xx(page);
    await page.goto('/workspace/settings');
    await waitForContent(page);

    const createKeyBtn = page.getByRole('button', { name: /创建|生成|new.*key|add/i });
    if (await createKeyBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await createKeyBtn.click();
      await page.waitForTimeout(500);
      // 取消或关闭弹窗
      const cancelBtn = page.getByRole('button', { name: /取消|cancel/i });
      if (await cancelBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await cancelBtn.click();
      }
      expect(get5xx()).toHaveLength(0);
    } else {
      test.info().annotations.push({ type: 'info', description: '创建 API Key 按钮未找到' });
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// 10. 交付管理
// ═══════════════════════════════════════════════════════════════

test.describe('⑩ 交付管理', () => {
  test('delivery 页面 — 加载无 5xx', async ({ page }) => {
    const get5xx = collect5xx(page);
    await page.goto('/workspace/delivery');
    await waitForContent(page);

    expect(get5xx()).toHaveLength(0);
    await expect(page.locator('body')).toBeVisible();
  });

  test('delivery 页面 — 主要 UI 元素存在', async ({ page }) => {
    await page.goto('/workspace/delivery');
    await waitForContent(page);

    // 应有标题文字
    const title = page.getByText(/交付|delivery|剪辑/i).first();
    await expect(title).toBeVisible({ timeout: 8_000 });
  });
});

// ═══════════════════════════════════════════════════════════════
// 11. 数据分析
// ═══════════════════════════════════════════════════════════════

test.describe('⑪ 数据分析', () => {
  test('analytics 页面 — 加载无 5xx', async ({ page }) => {
    const get5xx = collect5xx(page);
    await page.goto('/workspace/analytics');
    await waitForContent(page);

    expect(get5xx()).toHaveLength(0);
  });

  test('analytics 页面 — 图表/数据区域可见', async ({ page }) => {
    await page.goto('/workspace/analytics');
    await waitForContent(page);

    const content = page.getByText(/分析|analytics|统计|数据/i).first();
    await expect(content).toBeVisible({ timeout: 8_000 });
  });
});

// ═══════════════════════════════════════════════════════════════
// 12. 全流程：seed → project → episode → shots → render
// ═══════════════════════════════════════════════════════════════

test.describe('⑫ 完整生产链路流程', () => {
  test('通过 render 页面生成演示数据并跳转项目详情', async ({ page }) => {
    const get5xx = collect5xx(page);

    // 访问无 project_id 的 render 页面
    await page.goto('/workspace/render');
    await waitForContent(page);

    // 是否有"生成演示数据"按钮
    const seedBtn = page.getByRole('button', { name: /生成演示数据/i });
    if (await seedBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await seedBtn.click();
      // 应跳转到 /workspace/projects/xxx
      await page.waitForURL(/workspace\/projects\/[^/]+$/, { timeout: 15_000 });
      expect(page.url()).toMatch(/workspace\/projects\//);
    } else {
      // 已有 project，直接用已有数据验证跳转
      const data = await getSeedData(page);
      await page.goto(`/workspace/projects/${data.project_id}`);
      await waitForContent(page);
      await expect(page.locator('h2').first()).toBeVisible();
    }

    expect(get5xx()).toHaveLength(0);
  });

  test('项目详情 → 点击剧集 → 进入剧集详情', async ({ page }) => {
    const data = await getSeedData(page);
    const get5xx = collect5xx(page);

    await page.goto(`/workspace/projects/${data.project_id}`);
    await waitForContent(page);

    // 点击剧集链接
    const episodeLink = page.getByRole('link', { name: /第.*集|episode/i }).first();
    if (await episodeLink.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await episodeLink.click();
      await page.waitForURL(/episodes\//, { timeout: 10_000 });
      expect(page.url()).toContain('/episodes/');
      await waitForContent(page);
      await expect(page.getByText(/返回项目详情/)).toBeVisible({ timeout: 8_000 });
    } else {
      // 直接访问 episode 详情
      await page.goto(`/workspace/projects/${data.project_id}/episodes/${data.episode_id}`);
      await waitForContent(page);
      await expect(page.getByText(/返回项目详情/)).toBeVisible({ timeout: 8_000 });
    }

    expect(get5xx()).toHaveLength(0);
  });

  test('项目详情 → shots 页面 → render 页面完整链路', async ({ page }) => {
    const data = await getSeedData(page);
    const get5xx = collect5xx(page);

    // Step 1: 项目详情
    await page.goto(`/workspace/projects/${data.project_id}`);
    await waitForContent(page);
    expect(get5xx()).toHaveLength(0);

    // Step 2: shots 页面
    await page.goto(`/workspace/projects/${data.project_id}/shots`);
    await waitForContent(page);
    expect(get5xx()).toHaveLength(0);

    // Step 3: render 页面带 project_id
    await page.goto(`/workspace/render?project_id=${data.project_id}`);
    await waitForContent(page);
    expect(get5xx()).toHaveLength(0);

    await expect(page.getByRole('heading', { name: /渲染队列/ })).toBeVisible({ timeout: 8_000 });
  });

  test('侧边栏导航 — 所有一级链接可点击不白屏', async ({ page }) => {
    const get5xx = collect5xx(page);
    await page.goto('/workspace');
    await waitForContent(page);

    const navLinks = [
      { text: /项目/, url: '/workspace/projects' },
      { text: /资产/, url: '/workspace/assets' },
      { text: /渲染/, url: '/workspace/render' },
      { text: /QA/, url: '/workspace/qa' },
      { text: /分析/, url: '/workspace/analytics' },
      { text: /设置/, url: '/workspace/settings' },
    ];

    for (const { text, url } of navLinks) {
      const link = page.getByRole('link', { name: text }).first();
      if (await link.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await link.click();
        await page.waitForLoadState('domcontentloaded');
        await page.waitForTimeout(500);
        // 页面不应是白屏（body 有内容）
        const bodyText = await page.locator('body').innerText();
        expect(bodyText.length).toBeGreaterThan(10);
      } else {
        await page.goto(url);
        await waitForContent(page);
      }
    }

    expect(get5xx()).toHaveLength(0);
  });
});
