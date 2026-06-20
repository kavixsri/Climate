const puppeteer = require('puppeteer');
const { AxePuppeteer } = require('axe-puppeteer');

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  // Serve the local build via file protocol or a local server.
  // We'll use file protocol for simplicity.
  const path = require('path');
  const filePath = `file://${path.resolve(__dirname, 'dist/index.html')}`;
  
  console.log('Navigating to', filePath);
  await page.goto(filePath);
  
  const results = await new AxePuppeteer(page).analyze();
  console.log(`Found ${results.violations.length} violations`);
  
  if (results.violations.length > 0) {
    console.log(JSON.stringify(results.violations, null, 2));
  }
  
  await browser.close();
})();
