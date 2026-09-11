const { connect } = require('./lib');

(async () => {
    const { page } = await connect();
    console.log('Current URL:', page.url());
    await page.screenshot({ path: 'lm_explore/screenshots/02_status_check.png', fullPage: false });
    console.log('Screenshot saved: 02_status_check.png');
    const bodyText = await page.evaluate(() => document.body.innerText.slice(0, 500));
    console.log('Body text sample:', bodyText);
})();
