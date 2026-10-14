import { createServer } from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium, expect } from '@playwright/test';

const root=path.resolve('pages-out');
const prefix='/powerup-leaning/';
let server;
let target=process.env.PAGES_URL;
if(!target){
  server=createServer(async(req,res)=>{
    try{
      const url=new URL(req.url,'http://localhost');
      if(!url.pathname.startsWith(prefix)){res.writeHead(404);res.end();return;}
      const relative=decodeURIComponent(url.pathname.slice(prefix.length))||'index.html';
      let file=path.resolve(root,relative);
      if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
      if((await fs.stat(file)).isDirectory())file=path.join(file,'index.html');
      const types={'.html':'text/html','.js':'application/javascript','.mjs':'application/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.json':'application/json','.webmanifest':'application/manifest+json','.txt':'text/plain'};
      res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream'});res.end(await fs.readFile(file));
    }catch{res.writeHead(404);res.end();}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  target=`http://127.0.0.1:${server.address().port}${prefix}`;
}
const candidates=[process.env.PW_CHROMIUM_EXECUTABLE_PATH,'C:/Program Files/Google/Chrome/Application/chrome.exe'];
let executablePath;
for(const candidate of candidates.filter(Boolean)){try{await fs.access(candidate);executablePath=candidate;break;}catch{}}
const browser=await chromium.launch(executablePath?{executablePath}:{});
try{
  const context=await browser.newContext({viewport:{width:375,height:812},reducedMotion:'reduce'});
  const page=await context.newPage();
  const errors=[],apiCalls=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('request',request=>{if(new URL(request.url()).pathname.includes('/api/'))apiCalls.push(request.url());});
  await page.goto(target);
  await expect(page.getByRole('button',{name:/我带孩子练/})).toBeVisible({timeout:30000});
  await expect(page.getByRole('note')).toContainText('公开演示');
  await expect(page.locator('.home-view img')).toHaveCount(3);
  for(const img of await page.locator('.home-view img').all())await expect.poll(()=>img.evaluate(el=>el.complete&&el.naturalWidth>0),{timeout:30000}).toBe(true);
  for(const label of [/我带孩子练/,/孩子自己练/]){
    const box=await page.getByRole('button',{name:label}).boundingBox();expect(box.y+box.height).toBeLessThanOrEqual(736);
  }
  const seedResponse=await page.request.get(new URL('seed.json',target).href);
  const seed=await seedResponse.json();
  expect(seed.skills).toHaveLength(4);
  for(const name of ['observations','notes','lessons','audio'])expect(seed[name]).toEqual([]);
  expect(JSON.stringify(seed)).not.toMatch(/Pupil_s Book|textbook-pages|PU1-U4/u);
  await fs.mkdir('docs/pm-review/pages',{recursive:true});
  await page.screenshot({path:'docs/pm-review/pages/home-375.png'});
  const nav=()=>page.getByRole('navigation',{name:'主要页面'});
  for(const label of ['教材','练习','反馈','记录']){
    await nav().getByRole('button',{name:label,exact:true}).click();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  }
  await nav().getByRole('button',{name:'今日',exact:true}).click();
  await page.getByRole('button',{name:/我带孩子练/}).click();
  await expect(page.locator('.task-card')).toBeVisible();
  await page.getByRole('button',{name:/给一点提示/}).click();
  await page.getByRole('button',{name:/独立说出/}).click();
  await nav().getByRole('button',{name:'记录',exact:true}).click();
  await expect(page.locator('.record-list .status-pill').filter({hasText:'提示后说出'})).toHaveCount(1);
  await page.reload();
  await nav().getByRole('button',{name:'记录',exact:true}).click();
  await expect(page.locator('.record-list .status-pill').filter({hasText:'提示后说出'})).toHaveCount(1);
  expect(errors).toEqual([]);expect(apiCalls).toEqual([]);
  console.log(JSON.stringify({url:target,views:5,images:3,syntheticSkills:4,preservedHintedEvidence:true,noBackendRequests:true,passed:true}));
}finally{
  await browser.close();
  if(server)await new Promise(resolve=>server.close(resolve));
}
