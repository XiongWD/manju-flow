const { chromium } = require('playwright');
const BASE = 'http://127.0.0.1:3001';
const PROJECT_ID = '94d2ab1c2b8d4ca9b48d61b00f6a03a8';
async function visible(locator){ try { return await locator.first().isVisible(); } catch { return false; } }
async function count(locator){ try { return await locator.count(); } catch { return 0; } }
(async() => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ baseURL: BASE });
  page.on('console', msg => { if (msg.type() === 'error') console.log(`BROWSER_ERROR | ${msg.text()}`); });
  const log = (name, ok, detail='') => console.log(`${ok ? 'PASS' : 'FAIL'} | ${name}${detail ? ' | ' + detail : ''}`);
  try {
    // projects
    await page.goto('/workspace/projects', { waitUntil: 'networkidle' });
    log('projects header', await visible(page.locator('h1:has-text("项目")')));
    log('projects create btn', await visible(page.getByRole('button', { name: '新建项目' })));
    const editBtns = page.getByRole('button', { name: /编辑/ });
    const deleteBtns = page.getByRole('button', { name: /删除/ });
    log('projects edit exists', await count(editBtns) > 0, `count=${await count(editBtns)}`);
    log('projects delete exists', await count(deleteBtns) > 0, `count=${await count(deleteBtns)}`);

    // project detail
    await page.goto(`/workspace/projects/${PROJECT_ID}`, { waitUntil: 'networkidle' });
    log('project detail loads', await visible(page.locator('h2:has-text("Test Project")')));
    log('project detail back link', await visible(page.locator('text=返回项目列表')));
    log('project detail ep manager', await visible(page.locator('text=集数管理')));

    // shots
    await page.goto(`/workspace/projects/${PROJECT_ID}/shots`, { waitUntil: 'networkidle' });
    log('shots header', await visible(page.locator('h1:has-text("分镜编辑器")')));
    log('shots create btn', await visible(page.getByRole('button', { name: /新建分镜|创建分镜/ })));
    const batchToggle = page.getByRole('button', { name: /批量操作|退出批量/ });
    log('shots batch toggle', await visible(batchToggle));
    if (await visible(batchToggle)) {
      await batchToggle.click();
      await page.waitForTimeout(400);
      const cbCount = await count(page.locator('input[type="checkbox"]'));
      log('shots checkboxes in batch', cbCount > 0, `count=${cbCount}`);
      if (cbCount > 0) {
        await page.locator('input[type="checkbox"]').nth(0).click();
        await page.waitForTimeout(300);
        log('shots batch status enabled', await page.getByRole('button', { name: /修改状态/ }).isEnabled().catch(()=>false));
        log('shots batch duration enabled', await page.getByRole('button', { name: /调整时长/ }).isEnabled().catch(()=>false));
        log('shots batch delete enabled', await page.getByRole('button', { name: /批量删除/ }).isEnabled().catch(()=>false));
        if (await visible(page.getByRole('button', { name: /调整时长/ }))) {
          await page.getByRole('button', { name: /调整时长/ }).click();
          await page.waitForTimeout(400);
          const addCount = await count(page.locator('text=增加/减少'));
          const fieldCount = await count(page.locator('text=增减量（秒，负数为减少）'));
          const deltaCount = await count(page.locator('text=delta'));
          log('shots duration add mode', addCount > 0 && fieldCount > 0 && deltaCount === 0, `add=${addCount},field=${fieldCount},delta=${deltaCount}`);
          await page.keyboard.press('Escape');
        }
      }
    }

    // story
    await page.goto(`/workspace/projects/${PROJECT_ID}/story`, { waitUntil: 'networkidle' });
    log('story header', await visible(page.locator('h1:has-text("故事")')));

    // delivery
    await page.goto('/workspace/delivery', { waitUntil: 'networkidle' });
    log('delivery header', await visible(page.locator('h1:has-text("剪辑")')));
    const selects = page.locator('select');
    const selectCount = await count(selects);
    log('delivery selectors', selectCount >= 3, `count=${selectCount}`);
    if (selectCount >= 1) {
      const opts = await count(selects.nth(0).locator('option'));
      log('delivery project options', opts > 1, `opts=${opts}`);
      if (opts > 1) {
        const v = await selects.nth(0).locator('option').nth(1).getAttribute('value');
        await selects.nth(0).selectOption(v);
        await page.waitForTimeout(800);
      }
    }
    if ((await count(page.locator('select'))) >= 2) {
      const opts2 = await count(page.locator('select').nth(1).locator('option'));
      if (opts2 > 1) {
        const v2 = await page.locator('select').nth(1).locator('option').nth(1).getAttribute('value');
        await page.locator('select').nth(1).selectOption(v2);
        await page.waitForTimeout(800);
      }
    }
    if ((await count(page.locator('select'))) >= 3) {
      const opts3 = await count(page.locator('select').nth(2).locator('option'));
      if (opts3 > 1) {
        const v3 = await page.locator('select').nth(2).locator('option').nth(1).getAttribute('value');
        await page.locator('select').nth(2).selectOption(v3);
        await page.waitForTimeout(800);
        const finalSels = await count(page.locator('select'));
        log('delivery version sel appears', finalSels >= 4, `count=${finalSels}`);
        log('delivery subtitle save', await visible(page.getByRole('button', { name: '保存字幕' })));
        log('delivery audio save', await visible(page.getByRole('button', { name: '保存混音' })));
        log('delivery package btn', await visible(page.getByRole('button', { name: /创建.*交付包|生成.*交付包/ })));
        log('delivery publish btn', await visible(page.getByRole('button', { name: /新建发布|取消/ })));
      }
    }

    // analytics
    await page.goto('/workspace/analytics', { waitUntil: 'networkidle' });
    log('analytics header', await visible(page.locator('h1:has-text("数据分析")')));
    const metricCards = await count(page.locator('text=总播放量'));
    log('analytics metric cards', metricCards > 0);

    // assets
    await page.goto('/workspace/assets', { waitUntil: 'networkidle' });
    log('assets header', await visible(page.locator('h1:has-text("资产库")')));

    // qa
    await page.goto('/workspace/qa', { waitUntil: 'networkidle' });
    log('qa header', await visible(page.locator('h1:has-text("质检")')));

    // render
    await page.goto('/workspace/render', { waitUntil: 'networkidle' });
    log('render header', await visible(page.locator('h1:has-text("渲染")')));

    // settings
    await page.goto('/workspace/settings', { waitUntil: 'networkidle' });
    log('settings header', await visible(page.locator('h1:has-text("设置")')));
  } catch (e) {
    console.log('FATAL | ' + e.message);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();
