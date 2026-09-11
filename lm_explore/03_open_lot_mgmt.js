const { connect } = require('./lib');

(async () => {
    const { page } = await connect();
    console.log('Connected. Current URL:', page.url());

    // The Web Menu is a Knockout SPA - find the Lot Management tile by its visible text.
    const lotMgmtLink = page.locator('text=Lot Management').first();
    await lotMgmtLink.waitFor({ state: 'visible', timeout: 10000 });
    await lotMgmtLink.click();

    // Lot Management (like Template Management etc.) may open in a new tab/window or an iframe.
    await page.waitForTimeout(3000);

    const context = page.context();
    const pages = context.pages();
    console.log('Open pages after click:', pages.length);
    for (const p of pages) {
        console.log(' -', p.url(), '|', await p.title());
    }

    const target = pages[pages.length - 1];
    await target.screenshot({ path: 'lm_explore/screenshots/01_after_click.png', fullPage: false });
    console.log('Screenshot saved: 01_after_click.png');
})();
