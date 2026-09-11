const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.connectOverCDP('http://localhost:9222');
    const context = browser.contexts()[0];
    const page = context.pages()[0];
    console.log('Connected. Current URL:', page.url());
    console.log('Title:', await page.title());
    await page.screenshot({ path: 'lm_explore/screenshots/00_connected_state.png', fullPage: false });
    console.log('Screenshot saved.');
    // Deliberately not calling browser.close() here - this Browser object represents an
    // attached CDP connection to an externally-launched Chrome, not one Playwright owns the
    // lifecycle of. Just let the script exit; the actual browser window stays open.
})();
