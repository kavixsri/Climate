import { JSDOM } from 'jsdom';
import fs from 'fs';

const html = fs.readFileSync('dist/index.html', 'utf8');

const dom = new JSDOM(html, {
  url: "https://kavixsri.github.io/Climate/",
  runScripts: "dangerously",
  resources: "usable",
  pretendToBeVisual: true
});

dom.window.console.log = console.log;
dom.window.console.warn = console.warn;
dom.window.console.error = console.error;

// We need to wait for scripts to load
setTimeout(() => {
  console.log("JSDOM finished waiting.");
  process.exit(0);
}, 5000);
