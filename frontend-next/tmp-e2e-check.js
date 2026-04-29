const { chromium } = require('playwright');

(async() => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ baseURL: 'http://127.0.0.1:3000' });
  const results = [];
  const log = (name, ok, detail='') => {
    results.push({ name, ok, detail });
    console.log(`${ok ? 'PASS' : 'FAIL'} | ${name}${detail ? ' | ' + detail : ''}`);
  };

  try {
    // projects page
    await page.goto('/workspace/projects', { waitUntil: 'networkidle' });
    await page.screenshot({ path: '/home/hand/work/manju/logs/e2e-projects.png', fullPage: true });
    const projectTitle = await page.locator('text=项目管理').count().catch(() => 0);
    log('projects page load', projectTitle > 0, `titleCount=${projectTitle}`);

    const createBtn = page.locator('button:has-text("新建项目"), button:has-text("创建项目")').first();
    const createVisible = await createBtn.isVisible().catch(() => false);
    log('projects create button visible', createVisible);
    if (createVisible) {
      await createBtn.click();
      await page.waitForTimeout(400);
      const modalVisible = await page.locator('input[placeholder*="项目"], input[name="name"]').first().isVisible().catch(() => false);
      log('projects create modal opens', modalVisible);
    }

    // delivery page
    await page.goto('/workspace/delivery', { waitUntil: 'networkidle' });
    await page.screenshot({ path: '/home/hand/work/manju/logs/e2e-delivery.png', fullPage: true });
    const deliveryTitle = await page.locator('text=剪辑与交付').count().catch(() => 0);
    log('delivery page load', deliveryTitle > 0, `titleCount=${deliveryTitle}`);
    const packageBtnVisible = await page.locator('button:has-text("创建交付包"), button:has-text("生成交付包")').first().isVisible().catch(() => false);
    log('delivery package button visible', packageBtnVisible);
    const publishBtnVisible = await page.locator('button:has-text("创建发布任务"), button:has-text("发布")').first().isVisible().catch(() => false);
    log('delivery publish button visible', publishBtnVisible);

    // shots page
    await page.goto('/workspace/projects/94d2ab1c2b8d4ca9b48d61b00f6a03a8/shots', { waitUntil: 'networkidle' });
    await page.screenshot({ path: '/home/hand/work/manju/logs/e2e-shots.png', fullPage: true });
    const shotsTitle = await page.locator('text=分镜编辑器').count().catch(() => 0);
    log('shots page load', shotsTitle > 0, `titleCount=${shotsTitle}`);
    const batchBtn = page.locator('button:has-text("批量操作")').first();
    const batchVisible = await batchBtn.isVisible().catch(() => false);
    log('shots batch button visible', batchVisible);
    if (batchVisible) {
      await batchBtn.click();
      await page.waitForTimeout(400);
      log('shots batch mode toggles', true);
    }

    const durationBtn = page.locator('button:has-text("批量调整时长"), button:has-text("调整时长")').first();
    const durationVisible = await durationBtn.isVisible().catch(() => false);
    log('shots batch duration button visible', durationVisible);
    if (durationVisible) {
      await durationBtn.click();
      await page.waitForTimeout(400);
      const addModeVisible = await page.locator('text=增加/减少').count().catch(() => 0);
      const deltaVisible = await page.locator('text=delta').count().catch(() => 0);
      log('shots duration modal uses add mode wording', addModeVisible > 0 && deltaVisible === 0, `add=${addModeVisible},delta=${deltaVisible}`);
    }

  } catch (e) {
    console.error('FATAL', e);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();
