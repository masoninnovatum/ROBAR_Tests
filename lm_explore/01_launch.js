// Launches a visible Chromium instance with a remote-debugging port so a later script can
// reconnect to it via chromium.connectOverCDP(). Stays open indefinitely - kill the process
// (or close the window) when done. The user logs in manually in this window; Claude never
// touches the login form.
const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch({
        headless: false,
        args: ['--remote-debugging-port=9222', '--start-maximized'],
    });
    const context = await browser.newContext({ viewport: null });
    const page = await context.newPage();
    await page.goto('http://vmsrvtst703/innovatum/WebMenu/');
    console.log('Browser launched and navigated to login page. Waiting for manual login...');
    console.log('CDP endpoint: http://localhost:9222');
    // Keep process alive indefinitely so the browser window stays open.
    await new Promise(() => {});
})();
