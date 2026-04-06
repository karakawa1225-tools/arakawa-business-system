import puppeteer, { type Browser, type Page } from 'puppeteer';

const LAUNCH_ARGS = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-dev-shm-usage',
  '--disable-background-networking',
];

let browserPromise: Promise<Browser> | null = null;

/** Chromium は1プロセス共用（毎回 launch しない） */
export function getSharedPdfBrowser(): Promise<Browser> {
  if (!browserPromise) {
    browserPromise = puppeteer.launch({
      headless: true,
      args: LAUNCH_ARGS,
    });
  }
  return browserPromise;
}

/**
 * PDF 生成を直列化する。同時に複数 launch / 複数 heavy タブで
 * メモリ・CPU を食いつぶしブラウザや OS が実質フリーズするのを防ぐ。
 */
let pdfTail: Promise<unknown> = Promise.resolve();

export async function withPdfPage<T>(fn: (page: Page) => Promise<T>): Promise<T> {
  const run = async (): Promise<T> => {
    const browser = await getSharedPdfBrowser();
    const page = await browser.newPage();
    try {
      return await fn(page);
    } finally {
      await page.close().catch(() => {});
    }
  };
  const job = pdfTail.then(run, run);
  pdfTail = job.then(
    () => undefined,
    () => undefined
  );
  return job as Promise<T>;
}
