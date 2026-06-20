const puppeteer = require('puppeteer');

(async () => {
  try {
    console.log('Launching browser...');
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', error => console.error('PAGE ERROR:', error.message));
    page.on('requestfailed', request =>
      console.log(`REQUEST FAILED: ${request.url()} - ${request.failure().errorText}`)
    );

    console.log('Navigating to GitHub Pages...');
    await page.goto('https://kavixsri.github.io/Climate/', { waitUntil: 'domcontentloaded', timeout: 30000 });

    // Wait a bit to let JS execute
    await new Promise(r => setTimeout(r, 5000));

    await browser.close();
    console.log('Done.');
    process.exit(0);
  } catch (err) {
    console.error('SCRIPT ERROR:', err);
    process.exit(1);
  }
})();
