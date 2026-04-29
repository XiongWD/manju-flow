const { chromium } = require('playwright');
async function text(locator){ try { return await locator.textContent(); } catch { return null; } }
(async() => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ baseURL: 'http://127.0.0.1:3000' });
  const log = (name, ok, detail='') => console.log(`${ok?'PASS':'FAIL'} | ${name}${detail?` | ${detail}`:''}`);
  try {
    // delivery path
    await page.goto('/workspace/delivery', { waitUntil: 'networkidle' });
    const selects = page.locator('select');
    const selectCount = await selects.count();
    log('delivery selector count', selectCount >= 3, `count=${selectCount}`);
    if (selectCount >= 1) {
      const projectOptions = await page.locator('select').nth(0).locator('option').count();
      log('delivery project options present', projectOptions > 1, `options=${projectOptions}`);
      if (projectOptions > 1) {
        const val = await page.locator('select').nth(0).locator('option').nth(1).getAttribute('value');
        await page.locator('select').nth(0).selectOption(val);
        await page.waitForTimeout(800);
      }
    }
    if (selectCount >= 2) {
      const episodeOptions = await page.locator('select').nth(1).locator('option').count();
      log('delivery episode options present', episodeOptions > 1, `options=${episodeOptions}`);
      if (episodeOptions > 1) {
        const val = await page.locator('select').nth(1).locator('option').nth(1).getAttribute('value');
        await page.locator('select').nth(1).selectOption(val);
        await page.waitForTimeout(1200);
      }
    }
    const updatedSelectCount = await page.locator('select').count();
    if (updatedSelectCount >= 3) {
      const sceneOptions = await page.locator('select').nth(2).locator('option').count();
      log('delivery scene options present', sceneOptions > 1, `options=${sceneOptions}`);
      if (sceneOptions > 1) {
        const val = await page.locator('select').nth(2).locator('option').nth(1).getAttribute('value');
        await page.locator('select').nth(2).selectOption(val);
        await page.waitForTimeout(1200);
      }
    }
    const versionSelectCount = await page.locator('select').count();
    log('delivery version select appears', versionSelectCount >= 4, `count=${versionSelectCount}`);
    log('delivery subtitle save enabled', await page.getByRole('button', { name: '保存字幕' }).isVisible().catch(()=>false));
    log('delivery audio save enabled', await page.getByRole('button', { name: '保存混音' }).isVisible().catch(()=>false));
    log('delivery package create visible after selection', await page.getByRole('button', { name: /创建.*交付包|生成.*交付包/ }).isVisible().catch(()=>false));
    log('delivery publish visible after selection', await page.getByRole('button', { name: /新建发布|取消/ }).isVisible().catch(()=>false));

    // shots path
    await page.goto('/workspace/projects/94d2ab1c2b8d4ca9b48d61b00f6a03a8/shots', { waitUntil: 'networkidle' });
    const batchToggle = page.getByRole('button', { name: /批量操作|退出批量/ });
    const batchToggleVisible = await batchToggle.isVisible().catch(()=>false);
    log('shots batch toggle visible after page load', batchToggleVisible);
    if (batchToggleVisible) {
      await batchToggle.click();
      await page.waitForTimeout(400);
      const checkboxes = page.locator('input[type="checkbox"]');
      const checkboxCount = await checkboxes.count();
      log('shots checkboxes present in batch mode', checkboxCount > 0, `count=${checkboxCount}`);
      if (checkboxCount > 0) {
        await checkboxes.nth(0).check().catch(async()=>{ await checkboxes.nth(0).click(); });
        await page.waitForTimeout(300);
        log('shots batch status enabled after select', await page.getByRole('button', { name: /修改状态/ }).isEnabled().catch(()=>false));
        log('shots batch duration enabled after select', await page.getByRole('button', { name: /调整时长/ }).isEnabled().catch(()=>false));
        log('shots batch delete enabled after select', await page.getByRole('button', { name: /批量删除/ }).isEnabled().catch(()=>false));
        await page.getByRole('button', { name: /调整时长/ }).click().catch(()=>{});
        await page.waitForTimeout(300);
        const hasAdd = await page.locator('text=增加/减少').count();
        const hasField = await page.locator('text=增减量（秒，负数为减少）').count();
        const hasDelta = await page.locator('text=delta').count();
        log('shots duration modal add wording only', hasAdd > 0 && hasField > 0 && hasDelta === 0, `add=${hasAdd},field=${hasField},delta=${hasDelta}`);
      }
    }
  } catch (e) {
    console.error('FATAL', e);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();
