// Shared connect helper for all exploration scripts in this folder.
const { chromium } = require('playwright');

async function connect() {
    const browser = await chromium.connectOverCDP('http://localhost:9222');
    const context = browser.contexts()[0];
    const page = context.pages()[0];
    return { browser, context, page };
}

module.exports = { connect };
