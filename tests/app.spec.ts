import { expect, test, type Page } from '@playwright/test';
import { mkdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const png = readFileSync(resolve(process.cwd(), 'public/icon-192.png'));

function onePagePdf(text: string) {
  const stream = text ? `BT /F1 16 Tf 72 700 Td (${text}) Tj ET` : 'q Q';
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${Buffer.byteLength(stream, 'ascii')} >>\nstream\n${stream}\nendstream`,
  ];
  let body = '%PDF-1.4\n'; const offsets = [0];
  for (let i = 0; i < objects.length; i++) { offsets.push(Buffer.byteLength(body, 'ascii')); body += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`; }
  const xref = Buffer.byteLength(body, 'ascii');
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(body, 'ascii');
}

function quietWav() {
  const samples = Buffer.alloc(160);
  const wav = Buffer.alloc(44 + samples.length);
  wav.write('RIFF', 0); wav.writeUInt32LE(36 + samples.length, 4); wav.write('WAVE', 8);
  wav.write('fmt ', 12); wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(8000, 24); wav.writeUInt32LE(16000, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34);
  wav.write('data', 36); wav.writeUInt32LE(samples.length, 40); samples.copy(wav, 44);
  return wav;
}

async function openApp(page: Page) {
  await page.goto('/');
  await expect(page.getByRole('button', { name: /我带安哲练/ })).toBeVisible({ timeout: 30_000 });
}

test('home opens into both guided modes and a 3 minute practice', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await openApp(page);
  await expect(page.getByRole('button', { name: /安哲自己练/ })).toBeVisible();
  await expect(page.getByRole('button', { name: '3分钟' })).toBeVisible();
  for (const button of [page.getByRole('button', { name: /我带安哲练/ }), page.getByRole('button', { name: /安哲自己练/ })]) {
    const bounds = await button.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(812 - 80);
  }
  await page.getByRole('button', { name: /我带安哲练/ }).click();
  await expect(page.getByText('家长带练', { exact: true })).toBeVisible();
  await expect(page.locator('.task-card')).toBeVisible();
  await expect(page.getByText('提示已使用')).toHaveCount(0);
});

test('structure API rejects malformed requests and clearly reports missing provider credentials', async ({ request }) => {
  const malformed = await request.post('/api/structure', { data: { kind: 'feedback', text: 'banana', consent: false } });
  expect(malformed.status()).toBe(400);
  const missingCredentials = await request.post('/api/structure', { data: { kind: 'feedback', text: 'banana', skills: [{ id: 'banana', title: 'banana' }], consent: true } });
  expect(missingCredentials.status()).toBe(503);
  expect((await missingCredentials.json()).error).toMatch(/尚未配置/);
});

test('parent hints downgrade a requested independent result to prompted', async ({ page }) => {
  await openApp(page);
  await page.getByRole('button', { name: /我带安哲练/ }).click();
  await page.getByLabel('指定单元').selectOption({ label: 'Food with friends' });
  const seed = await (await page.request.get('/seed.json')).json();
  const waterRequest = seed.tasks.find((task: { prompt: string; skill_ids: string[] }) =>
    task.prompt.includes('安哲想喝水') && task.skill_ids.some((id: string) => seed.skills.some((skill: { id: string; goal: string }) => skill.id === id && skill.goal === '礼貌请求一种食物或饮品')),
  );
  expect(waterRequest).toBeTruthy();
  await page.getByLabel('换一道题').selectOption({ value: waterRequest.id });
  await expect(page.locator('.task-card .instruction').filter({ hasText: '安哲想喝水' })).toContainText('安哲想喝水');
  await expect(page.locator('.task-card')).not.toContainText('Can I have some water, please?');
  await page.getByRole('button', { name: /给一点提示/ }).click();
  await expect(page.getByText(/本题最多记为“提示后说出”/)).toBeVisible();
  await page.getByRole('button', { name: /独立说出/ }).click();
  await page.getByRole('button', { name: '记录' }).click();
  await expect(page.getByText('提示后说出').first()).toBeVisible();
});

test('text feedback preserves negation and creates editable candidate outcomes', async ({ page }) => {
  await openApp(page);
  await page.getByRole('button', { name: '反馈' }).click();
  await page.getByLabel('识别后可以继续修改').fill('banana完全不用提醒，bread提示了才会，water那句话不会');
  await page.getByRole('button', { name: '本机规则整理' }).click();
  const candidates = page.locator('.candidate-section article');
  await expect(candidates).toHaveCount(3);
  await expect(candidates.nth(0).getByLabel('表现')).toHaveValue('independent');
  await expect(candidates.nth(1).getByLabel('表现')).toHaveValue('prompted');
  await expect(candidates.nth(2).getByLabel('表现')).toHaveValue('miss');
  await expect(candidates.nth(0).getByText(/banana完全不用提醒/)).toBeVisible();
});

test('materials show independent printed p47 and p49 sources and unknown lesson date', async ({ page }) => {
  await openApp(page);
  await page.getByRole('navigation', { name: '主要页面' }).getByRole('button', { name: '教材', exact: true }).click();
  await page.locator('.unit-strip button').filter({ hasText: 'Food with friends' }).click();
  await expect(page.locator('.unit-strip button.selected span')).toHaveText('4');
  await expect(page.getByText('印刷 p.47')).toBeVisible();
  await expect(page.getByText('印刷 p.49')).toBeVisible();
  await expect(page.getByText('实际授课日期未知')).toBeVisible();
});

test('image import manual correction publishes dynamic map and generated task without a lesson date', async ({ page }) => {
  await openApp(page);
  await page.getByRole('navigation', { name: '主要页面' }).getByRole('button', { name: '教材', exact: true }).click();
  await page.getByRole('button', { name: '导入' }).click();
  await page.locator('.drop-zone input[type=file]').setInputFiles({ name: 'simulated-page.png', mimeType: 'image/png', buffer: png });
  await expect(page.getByText('需要 OCR 或手动录入')).toBeVisible({ timeout: 15_000 });
  await page.getByLabel('教材名').fill('Power Up 1');
  await page.getByLabel('级别').fill('1');
  await page.getByLabel('版本').fill('Second Edition');
  await page.getByLabel('Unit / 单元').fill('Simulated Unit 8');
  await page.getByLabel('书中印刷页码').fill('91');
  await page.getByLabel('词汇（每行：表达|中文含义）').fill('kite|风筝');
  await page.getByLabel('本页来源证据').fill('kite under the chair');
  await page.getByLabel(/这些页面也对应一次实际外教课/).check();
  await page.getByRole('button', { name: '核对并发布' }).click();
  await page.locator('.unit-strip button').filter({ hasText: 'Simulated Unit 8' }).click();
  await expect(page.locator('.unit-detail h1')).toHaveText('Simulated Unit 8');
  await expect(page.getByText('kite', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('印刷 p.91')).toBeVisible();
  await expect(page.getByText('实际授课日期未知')).toBeVisible();
  await page.getByRole('button', { name: '导入' }).click();
  await page.locator('.import-workspace input[type=file]').setInputFiles({ name: 'simulated-page.png', mimeType: 'image/png', buffer: png });
  await expect(page.getByText(/已识别重复文件/)).toBeVisible();
  await page.getByRole('button', { name: '关闭导入' }).click();
  await page.getByRole('navigation', { name: '主要页面' }).getByRole('button', { name: '练习', exact: true }).click();
  await page.getByLabel('指定单元').selectOption({ label: 'Simulated Unit 8' });
  await expect(page.locator('.task-card')).toContainText('风筝');
});

test('PDF import extracts source text when available', async ({ page }) => {
  await openApp(page);
  await page.getByRole('navigation', { name: '主要页面' }).getByRole('button', { name: '教材', exact: true }).click();
  await page.getByRole('button', { name: '导入' }).click();
  const picker = () => page.locator('.drop-zone input[type=file]');
  await picker().setInputFiles({ name: 'extractable.pdf', mimeType: 'application/pdf', buffer: onePagePdf('Power Up vocabulary from the visible page') });
  await expect(page.getByText(/仅完成原始文字提取/)).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('.review-pages pre')).toContainText('Power Up vocabulary');
});

test('scanned PDF pages stay on the manual OCR path', async ({ page }) => {
  await openApp(page);
  await page.getByRole('navigation', { name: '主要页面' }).getByRole('button', { name: '教材', exact: true }).click();
  await page.getByRole('button', { name: '导入' }).click();
  const picker = page.locator('.drop-zone input[type=file]');
  await picker.setInputFiles({ name: 'scanned-page.pdf', mimeType: 'application/pdf', buffer: onePagePdf('') });
  await expect(page.getByText('需要 OCR 或手动录入')).toBeVisible({ timeout: 20_000 });
  await page.locator('.review-pages details summary').click();
  await expect(page.getByText(/没有可提取文字/)).toBeVisible();
});

test('backup export/import and V3 backup migration retain review records', async ({ page }, testInfo) => {
  await openApp(page);
  await page.getByRole('button', { name: '反馈' }).click();
  await page.getByLabel('识别后可以继续修改').fill('banana完全不用提醒');
  await page.getByRole('button', { name: '本机规则整理' }).click();
  await page.getByRole('button', { name: '确认并保存' }).click();
  await expect(page.getByRole('heading', { name: '反馈已保存' })).toBeVisible();
  await page.getByRole('button', { name: '记录' }).click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: '下载 JSON 备份' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/andy-learning-backup-.*\.json/);
  const exportedPath = resolve(testInfo.outputDir, download.suggestedFilename());
  await download.saveAs(exportedPath);
  await page.getByRole('button', { name: '清除本机数据' }).click();
  await page.getByRole('button', { name: /再次点击，确认清除/ }).click();
  await page.locator('.backup-card input[type=file]').setInputFiles(exportedPath);
  await expect(page.getByText('备份已合并')).toBeVisible();
  await expect(page.getByText(/banana完全不用提醒/).first()).toBeVisible();
  await page.getByRole('navigation', { name: '主要页面' }).getByRole('button', { name: '教材', exact: true }).click();
  await page.locator('.unit-strip button').filter({ hasText: 'Food with friends' }).click();
  await expect(page.getByText('印刷 p.47')).toBeVisible();
  await expect(page.getByText('印刷 p.49')).toBeVisible();
  await page.getByRole('navigation', { name: '主要页面' }).getByRole('button', { name: '记录', exact: true }).click();
  const v3 = { schema_version: '0.3.0', lesson_links: [], practice_sessions: [], raw_parent_notes: [{ id: 'legacy-note', created_at: '2026-10-01T10:00:00.000Z', source: 'parent_text_input', text: 'V3原始家长反馈', observations: [] }] };
  await page.locator('.backup-card input[type=file]').setInputFiles({ name: 'legacy-v3.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(v3)) });
  await expect(page.getByText('备份已合并')).toBeVisible();
  await expect(page.getByText('V3原始家长反馈')).toBeVisible();
  await expect(page.getByText(/banana完全不用提醒/).first()).toBeVisible();
});

test('child mode does not auto-grade typed answers and can save a manual parent grade', async ({ page }) => {
  await openApp(page);
  await page.getByRole('button', { name: /安哲自己练/ }).click();
  const answer = page.getByLabel('把听到的回答写下来');
  await answer.fill('banana');
  await expect(page.getByText(/不会自动判断对错/)).toBeVisible();
  await expect(page.getByText('识别通过')).toHaveCount(0);
  await page.getByRole('button', { name: /独立说出/ }).click();
  if (await page.locator('.grading').count()) await page.getByRole('button', { name: /独立说出/ }).click();
  await expect(page.getByRole('heading', { name: '这次练习已保存' })).toBeVisible();
});

test('denied microphone permission leaves text feedback and local backup available offline', async ({ page, context }) => {
  await context.grantPermissions([]);
  await page.addInitScript(() => { Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: () => Promise.reject(new DOMException('Permission denied', 'NotAllowedError')) } }); });
  await openApp(page);
  await page.getByRole('button', { name: '反馈' }).click();
  await page.getByRole('button', { name: '录一段音频' }).click();
  await expect(page.getByText(/麦克风权限未开启/)).toBeVisible();
  await page.getByLabel('识别后可以继续修改').fill('offline note');
  await page.getByRole('button', { name: '只保存原话' }).click();
  await expect(page.getByRole('heading', { name: '反馈已保存' })).toBeVisible();
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await openApp(page);
  await context.setOffline(true);
  await page.reload();
  await openApp(page);
  await page.getByRole('button', { name: '记录' }).click();
  await expect(page.getByText('offline note')).toBeVisible();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: '下载 JSON 备份' }).click();
  expect((await downloadPromise).suggestedFilename()).toMatch(/andy-learning-backup/);
  await context.setOffline(false);
});

test('synthetic audio stays local, is marked untranscribed, and can be downloaded or deleted', async ({ page }) => {
  const externalRequests: string[] = [];
  const asrRequests: string[] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (['http:', 'https:'].includes(url.protocol) && !['localhost', '127.0.0.1'].includes(url.hostname)) externalRequests.push(request.url());
    if (url.pathname.startsWith('/api/asr')) asrRequests.push(request.url());
  });
  await openApp(page);
  await page.getByRole('navigation', { name: '主要页面' }).getByRole('button', { name: '反馈', exact: true }).click();
  await page.locator('.local-audio input[type=file]').setInputFiles({ name: 'synthetic-quiet.wav', mimeType: 'audio/wav', buffer: quietWav() });
  await expect(page.getByText(/音频已附加，只会保存到当前浏览器本机/)).toBeVisible();
  await page.getByRole('button', { name: '只保存原话' }).click();
  await expect(page.getByRole('heading', { name: '反馈已保存' })).toBeVisible();
  await page.getByRole('navigation', { name: '主要页面' }).getByRole('button', { name: '记录', exact: true }).click();
  await expect(page.getByText('仅保存音频，尚未转写/分析')).toBeVisible();
  const audioRow = page.locator('.audio-list > div').first();
  const downloadPromise = page.waitForEvent('download');
  await audioRow.getByRole('button', { name: '下载录音' }).click();
  expect((await downloadPromise).suggestedFilename()).toMatch(/andy-audio-.*\.wav/);
  await audioRow.getByRole('button', { name: '删除录音' }).click();
  await expect(page.locator('.audio-list')).toHaveCount(0);
  expect(asrRequests).toEqual([]);
  expect(externalRequests).toEqual([]);
});

test('responsive screens from 320 through desktop have no document-level horizontal overflow', async ({ page }, testInfo) => {
  const screenshotDir = resolve(process.cwd(), 'docs/pm-review/rendered-v2/regression');
  mkdirSync(screenshotDir, { recursive: true });
  const views = [
    { key: 'home', label: '今日', selector: '.home-view' },
    { key: 'materials', label: '教材', selector: '.materials-view' },
    { key: 'practice', label: '练习', selector: '.practice-view' },
    { key: 'feedback', label: '反馈', selector: '.feedback-view' },
    { key: 'records', label: '记录', selector: '.records-view' },
  ];
  for (const width of [320, 375, 390, 430, 768, 1280]) {
    await page.setViewportSize({ width, height: width < 500 ? 844 : 900 });
    await openApp(page);
    for (const [index, view] of views.entries()) {
      if (index > 0) await page.getByRole('navigation', { name: '主要页面' }).getByRole('button', { name: view.label, exact: true }).click();
      await expect(page.locator(view.selector)).toBeVisible();
      await expect(page.locator('.view-stack')).toHaveCSS('opacity', '1');
      const metrics = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, content: document.documentElement.scrollWidth }));
      expect(metrics.content, `${view.key} overflow at ${width}px: ${JSON.stringify(metrics)}`).toBeLessThanOrEqual(metrics.viewport + 1);
      if (width === 375) await page.screenshot({ path: resolve(screenshotDir, `${view.key}-375.png`), fullPage: true });
    }
    if (width !== 375) await page.screenshot({ path: resolve(screenshotDir, `viewport-${width}.png`), fullPage: true });
  }
});
