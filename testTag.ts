import { chromium } from 'playwright';
import * as cheerio from 'cheerio';

async function main() {
  const browser = await chromium.launch({ headless: true, executablePath: '/usr/bin/google-chrome' });
  const context = await browser.newContext();
  await context.addCookies([{
      name: 'view_adult',
      value: 'true',
      domain: 'archiveofourown.org',
      path: '/'
  }]);
  const page = await context.newPage();
  const url = 'https://archiveofourown.org/tags/%EF%BC%82%D0%A7%D0%B8%D0%BD%D0%B3%D0%B8%D1%81%20%D0%A5%D0%B0%D0%B0%D0%BD%EF%BC%82%20-%20Mongolian%20Version%20of%20%EF%BC%82Dschinghis%20Khan%EF%BC%82%20(song)/works?page=20';
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  const html = await page.content();
  const $ = cheerio.load(html);
  console.log('Works count:', $('li.work.blurb.group').length);
  await browser.close();
}
main();
