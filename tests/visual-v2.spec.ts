import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

type Seed = {
  units: Array<{ id: string; title: string; review_status: string; printed_page_range: [number, number] | null; source_page_ids: string[] }>;
  pages: Array<{ id: string; unit_id?: string; printed_page_number: number | null; page_preview_ref?: string }>;
  skills: Array<{ id: string; unit_id: string; title: string; source_page_ids: string[] }>;
  tasks: Array<{ id: string; skill_ids: string[]; source_page_ids: string[] }>;
};

const catalogOrder = ['PU1-U0-HELLO', 'PU1-U1', 'PU1-U2', 'PU1-U3', 'PU1-U4', 'PU1-U5', 'PU1-U6', 'PU1-U7'];
const views = [
  { key: 'home', label: '今日', selector: '.home-view' },
  { key: 'materials', label: '教材', selector: '.materials-view' },
  { key: 'practice', label: '练习', selector: '.practice-view' },
  { key: 'feedback', label: '反馈', selector: '.feedback-view' },
  { key: 'records', label: '记录', selector: '.records-view' },
];

async function openApp(page: Page) {
  await page.goto('/');
  await expect(page.getByRole('button', { name: /我带安哲练/ })).toBeVisible({ timeout: 30_000 });
}

async function seed(page: Page): Promise<Seed> {
  const response = await page.request.get('/seed.json');
  expect(response.ok()).toBeTruthy();
  return await response.json() as Seed;
}

async function waitForView(page: Page, selector: string) {
  await expect(page.locator(selector)).toBeVisible();
  await expect(page.locator('.view-stack')).toHaveCSS('opacity', '1');
}

test('V2 home keeps both guided starts in the 375px first screen and uses loaded optimized art', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  const optimizedResponses: Array<{ url: string; status: number }> = [];
  page.on('response', (response) => {
    if (response.url().includes('/_next/image')) optimizedResponses.push({ url: response.url(), status: response.status() });
  });
  await openApp(page);

  const parent = page.getByRole('button', { name: /我带安哲练/ });
  const child = page.getByRole('button', { name: /安哲自己练/ });
  await expect(parent).toBeVisible();
  await expect(child).toBeVisible();
  for (const button of [parent, child]) {
    const bounds = await button.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(812 - 80);
  }

  expect(await page.locator('body').evaluate((el) => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(18);
  const artwork = page.locator('.home-view img');
  await expect(artwork).toHaveCount(3);
  for (const image of await artwork.all()) {
    await image.scrollIntoViewIfNeeded();
    try {
      await expect.poll(() => image.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0), { timeout: 10_000 }).toBe(true);
    } catch {
      const diagnostic = await image.evaluate((img: HTMLImageElement) => ({
        className: img.className,
        src: img.getAttribute('src'),
        currentSrc: img.currentSrc,
        complete: img.complete,
        naturalWidth: img.naturalWidth,
        naturalHeight: img.naturalHeight,
        rect: (() => { const r = img.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; })(),
        display: getComputedStyle(img).display,
        visibility: getComputedStyle(img).visibility,
        opacity: getComputedStyle(img).opacity,
      }));
      throw new Error(`Generated image did not load: ${JSON.stringify({ diagnostic, optimizedResponses })}`);
    }
    expect(await image.getAttribute('src')).toContain('/_next/image');
  }
  expect(optimizedResponses.length).toBeGreaterThanOrEqual(3);
  expect(optimizedResponses.every((response) => response.status === 200), JSON.stringify(optimizedResponses)).toBe(true);

  await parent.click();
  const question = page.locator('.task-card h1');
  await expect(question).toBeVisible();
  expect(await question.evaluate((el) => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(26);
  const explanation = page.locator('.task-card .instruction').first();
  await expect(explanation).toBeVisible();
  expect(await explanation.evaluate((el) => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(14);
});

test('V2 catalog is ordered, source-backed, task-backed, and marks Unit 7 as partial through p.89', async ({ page }) => {
  const data = await seed(page);
  expect(data.units.map((unit) => unit.id)).toEqual(catalogOrder);
  expect(data.units).toHaveLength(8);
  expect(data.skills).toHaveLength(196);
  expect(data.tasks).toHaveLength(197);

  for (const unit of data.units) {
    const sourcePageIds = new Set(unit.source_page_ids);
    const unitSkills = data.skills.filter((skill) => skill.unit_id === unit.id);
    const unitTasks = data.tasks.filter((task) => task.skill_ids.some((skillId) => unitSkills.some((skill) => skill.id === skillId)));
    expect(sourcePageIds.size, `${unit.title} source pages`).toBeGreaterThan(0);
    expect(unitSkills.length, `${unit.title} skills`).toBeGreaterThan(0);
    expect(unitTasks.length, `${unit.title} generated tasks`).toBeGreaterThan(0);
    expect(unitTasks.every((task) => task.source_page_ids.some((id) => sourcePageIds.has(id))), `${unit.title} task traceability`).toBe(true);
  }
  expect(data.units.at(-1)?.printed_page_range?.[1]).toBe(89);

  await openApp(page);
  await page.getByRole('navigation', { name: '主要页面' }).getByRole('button', { name: '教材', exact: true }).click();
  await waitForView(page, '.materials-view');
  await expect(page.locator('.unit-detail h1')).toHaveText('Our new school');
  expect(await page.locator('.reference-outline small').evaluate(el=>parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(14);
  await expect(page.locator('.unit-detail .skill-list summary strong').getByText('pencil', { exact: true })).toBeVisible();
  await expect(page.locator('.unit-detail .skill-list summary strong').getByText('bag', { exact: true })).toBeVisible();

  const unitButtons = page.locator('.unit-strip button');
  await expect(unitButtons).toHaveCount(8);
  for (const unit of data.units) {
    await page.locator('.unit-strip button').filter({ hasText: unit.title }).click();
    await expect(page.locator('.unit-detail h1')).toHaveText(unit.title);
    const expectedPages = unit.source_page_ids.length;
    await expect(page.locator('.unit-detail .source-tile')).toHaveCount(expectedPages);
    await expect(page.locator('.unit-detail .skill-list details')).toHaveCount(data.skills.filter((skill) => skill.unit_id === unit.id).length);
    const sourceImage = page.locator('.unit-detail .source-tile img').first();
    await expect(sourceImage).toBeVisible();
    await expect.poll(() => sourceImage.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
  }

  await page.locator('.unit-strip button').filter({ hasText: 'Food with friends' }).click();
  await expect(page.locator('.unit-detail .status-pill')).toContainText('已核验部分原页');
  await page.locator('.unit-strip button').filter({ hasText: 'Let’s play!' }).click();
  await expect(page.locator('.unit-detail')).toContainText(/部分|p\.89|p\. 89|已收录至/);
  await expect(page.locator('.unit-detail')).toContainText('p.89');
});

test('V2 five main views fit phone, tablet, and desktop widths; captures reviewed 375px screens', async ({ page }) => {
  const screenshotDir = resolve(process.cwd(), 'docs/pm-review/rendered-v2');
  mkdirSync(screenshotDir, { recursive: true });
  await page.emulateMedia({ reducedMotion: 'reduce' });

  for (const width of [320, 375, 390, 430, 768, 1280]) {
    await page.setViewportSize({ width, height: width < 500 ? 844 : 900 });
    await openApp(page);
    for (const [index, view] of views.entries()) {
      if (index > 0) await page.getByRole('navigation', { name: '主要页面' }).getByRole('button', { name: view.label, exact: true }).click();
      await waitForView(page, view.selector);
      const metrics = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, content: document.documentElement.scrollWidth }));
      expect(metrics.content, `${view.key} overflow at ${width}px: ${JSON.stringify(metrics)}`).toBeLessThanOrEqual(metrics.viewport + 1);
      if (width === 375) await page.screenshot({ path: resolve(screenshotDir, `${view.key}-375.png`), fullPage: true, animations: 'disabled' });
    }
  }
});
