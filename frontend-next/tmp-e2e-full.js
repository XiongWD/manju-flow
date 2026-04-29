const { chromium } = require('playwright');

const BASE = 'http://127.0.0.1:3000';
const PROJECT_ID = '94d2ab1c2b8d4ca9b48d61b00f6a03a8';

async function visible(locator){ try { return await locator.first().isVisible(); } catch { return false; } }
async function count(locator){ try { return await locator.count(); } catch { return 0; } }

(async() => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ baseURL: BASE });
  page.on('console', msg => {
    if (msg.type() === 'error') console.log(`BROWSER_ERROR | ${msg.text()}`);
  });
  page.on('pageerror', err => console.log(`PAGE_ERROR | ${err.message}`));

  const log = (name, ok, detail='') => console.log(`${ok ? 'PASS' : 'FAIL'} | ${name}${detail ? ' | ' + detail : ''}`);

  try {
    // projects
    await page.goto('/workspace/projects', { waitUntil: 'networkidle' });
    log('projects header', await visible(page.locator('h1:has-text("项目")')));
    log('projects create btn', await visible(page.getByRole('button', { name: '新建项目' })));
    if (await visible(page.getByRole('button', { name: '新建项目' }))) {
      await page.getByRole('button', { name: '新建项目' }).click();
      await page.waitForTimeout(300);
      log('projects create modal', await visible(page.locator('text=新建项目')));
      log('projects create confirm', await visible(page.getByRole('button', { name: '创建' })));
      await page.keyboard.press('Escape').catch(()=>{});
    }
    const editBtns = page.getByRole('button', { name: /编辑/ });
    const deleteBtns = page.getByRole('button', { name: /删除/ });
    log('projects edit action exists', await count(editBtns) > 0, `count=${await count(editBtns)}`);
    log('projects delete action exists', await count(deleteBtns) > 0, `count=${await count(deleteBtns)}`);

    // shots
    await page.goto(`/workspace/projects/${PROJECT_ID}/shots`, { waitUntil: 'networkidle' });
    log('shots header', await visible(page.locator('h1:has-text("分镜编辑器")')));
    log('shots create btn', await visible(page.getByRole('button', { name: /新建分镜|创建分镜/ })));
    const batchToggle = page.getByRole('button', { name: /批量操作|退出批量/ });
    log('shots batch toggle', await visible(batchToggle));
    if (await visible(batchToggle)) {
      await batchToggle.click();
      await page.waitForTimeout(300);
      const checkboxes = page.locator('input[type="checkbox"]');
      const checkboxCount = await count(checkboxes);
      log('shots batch checkboxes', checkboxCount > 0, `count=${checkboxCount}`);
      if (checkboxCount > 0) {
        await checkboxes.nth(0).click();
        await page.waitForTimeout(300);
        log('shots batch status enabled', await page.getByRole('button', { name: /修改状态/ }).isEnabled().catch(()=>false));
        log('shots batch duration enabled', await page.getByRole('button', { name: /调整时长/ }).isEnabled().catch(()=>false));
        log('shots batch delete enabled', await page.getByRole('button', { name: /批量删除/ }).isEnabled().catch(()=>false));
        if (await visible(page.getByRole('button', { name: /调整时长/ }))) {
          await page.getByRole('button', { name: /调整时长/ }).click();
          await page.waitForTimeout(300);
          const addCount = await count(page.locator('text=增加/减少'));
          const fieldCount = await count(page.locator('text=增减量（秒，负数为减少）'));
          const deltaCount = await count(page.locator('text=delta'));
          log('shots duration wording add', addCount > 0 && fieldCount > 0 && deltaCount === 0, `add=${addCount}, field=${fieldCount}, delta=${deltaCount}`);
          await page.keyboard.press('Escape').catch(()=>{});
        }
      }
    }

    // delivery
    await page.goto('/workspace/delivery', { waitUntil: 'networkidle' });
    log('delivery header', await visible(page.locator('h1:has-text("剪辑与交付")')));
    const selects = page.locator('select');
    const selectCount = await count(selects);
    log('delivery selector bar', selectCount >= 1, `count=${selectCount}`);
    if (selectCount >= 1) {
      const projectOptions = await count(selects.nth(0).locator('option'));
      log('delivery project options', projectOptions > 1, `count=${projectOptions}`);
      if (projectOptions > 1) {
        const projectValue = await selects.nth(0).locator('option').nth(1).getAttribute('value');
        await selects.nth(0).selectOption(projectValue);
        await page.waitForTimeout(1000);
      }
    }
    if ((await count(page.locator('select'))) >= 2) {
      const episodeOptions = await count(page.locator('select').nth(1).locator('option'));
      log('delivery episode options', episodeOptions > 1, `count=${episodeOptions}`);
      if (episodeOptions > 1) {
        const episodeValue = await page.locator('select').nth(1).locator('option').nth(1).getAttribute('value');
        await page.locator('select').nth(1).selectOption(episodeValue);
        await page.waitForTimeout(1200);
      }
    }
    if ((await count(page.locator('select'))) >= 3) {
      const sceneOptions = await count(page.locator('select').nth(2).locator('option'));
      log('delivery scene options', sceneOptions > 1, `count=${sceneOptions}`);
      if (sceneOptions > 1) {
        const sceneValue = await page.locator('select').nth(2).locator('option').nth(1).getAttribute('value');
        await page.locator('select').nth(2).selectOption(sceneValue);
        await page.waitForTimeout(1200);
      }
    }
    const finalSelectCount = await count(page.locator('select'));
    log('delivery version select', finalSelectCount >= 4, `count=${finalSelectCount}`);
    log('delivery subtitle save', await visible(page.getByRole('button', { name: '保存字幕' })));
    log('delivery audio save', await visible(page.getByRole('button', { name: '保存混音' })));
    log('delivery package create', await visible(page.getByRole('button', { name: /创建.*交付包|生成.*交付包/ })));
    log('delivery publish toggle', await visible(page.getByRole('button', { name: /新建发布|取消/ })));
  } catch (e) {
    console.log('FATAL | ' + e.message);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();
