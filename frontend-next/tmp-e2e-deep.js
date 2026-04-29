const { chromium } = require('playwright');

async function exists(locator){ try { return await locator.count() > 0 && await locator.first().isVisible(); } catch { return false; } }
async function clickIf(locator){ if (await exists(locator)) { await locator.first().click(); return true; } return false; }

(async() => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ baseURL: 'http://127.0.0.1:3000' });
  const out = [];
  const log = (name, ok, detail='') => { out.push({name, ok, detail}); console.log(`${ok?'PASS':'FAIL'} | ${name}${detail?` | ${detail}`:''}`) };

  try {
    // Projects real UI
    await page.goto('/workspace/projects', { waitUntil: 'networkidle' });
    log('projects header visible', await exists(page.locator('text=项目')));
    log('projects create visible', await exists(page.getByRole('button', { name: '新建项目' })));
    if (await clickIf(page.getByRole('button', { name: '新建项目' }))) {
      await page.waitForTimeout(300);
      log('projects create modal title', await exists(page.locator('text=新建项目')));
      log('projects create has save action', await exists(page.getByRole('button', { name: '创建' })));
    }

    // Shots real UI
    await page.goto('/workspace/projects/94d2ab1c2b8d4ca9b48d61b00f6a03a8/shots', { waitUntil: 'networkidle' });
    log('shots header visible', await exists(page.locator('text=分镜编辑器')));
    const batchBtn = page.getByRole('button', { name: /批量操作|退出批量/ });
    log('shots batch toggle visible', await exists(batchBtn));
    if (await clickIf(batchBtn)) {
      await page.waitForTimeout(300);
      log('shots batch status action visible', await exists(page.getByRole('button', { name: /修改状态/ })));
      log('shots batch duration action visible', await exists(page.getByRole('button', { name: /调整时长/ })));
      log('shots batch delete action visible', await exists(page.getByRole('button', { name: /批量删除/ })));
      if (await clickIf(page.getByRole('button', { name: /调整时长/ }))) {
        await page.waitForTimeout(300);
        const addWording = await exists(page.locator('text=增加/减少'));
        const addField = await exists(page.locator('text=增减量（秒，负数为减少）'));
        const deltaText = await page.locator('text=delta').count();
        log('shots duration modal wording correct', addWording && addField && deltaText === 0, `delta=${deltaText}`);
      }
    }

    // Delivery real UI
    await page.goto('/workspace/delivery', { waitUntil: 'networkidle' });
    log('delivery header visible', await exists(page.locator('text=剪辑与交付')));
    log('delivery subtitle save visible', await exists(page.getByRole('button', { name: '保存字幕' })));
    log('delivery audio save visible', await exists(page.getByRole('button', { name: '保存混音' })));
    log('delivery package action visible', await exists(page.getByRole('button', { name: /创建交付包|生成交付包/ })));
    log('delivery publish toggle visible', await exists(page.getByRole('button', { name: /新建发布|取消/ })));
    if (await clickIf(page.getByRole('button', { name: /新建发布|取消/ }))) {
      await page.waitForTimeout(300);
      log('delivery publish create visible', await exists(page.getByRole('button', { name: '创建' })));
    }
  } catch (e) {
    console.error('FATAL', e);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();
