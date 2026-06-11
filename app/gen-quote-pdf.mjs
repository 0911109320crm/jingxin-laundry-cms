import { chromium } from 'playwright';
import { pathToFileURL } from 'node:url';

const htmlPath = 'C:/RenStudio/case/washinmachine/jingxin-quote.html';
const outPath = 'C:/RenStudio/case/washinmachine/jingxin-quote.pdf';

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(pathToFileURL(htmlPath).href, { waitUntil: 'networkidle' });
await page.emulateMedia({ media: 'screen' });
await page.pdf({
  path: outPath,
  format: 'A4',
  printBackground: true,
  margin: { top: '12mm', bottom: '12mm', left: '10mm', right: '10mm' },
});
await browser.close();
console.log('PDF written:', outPath);
