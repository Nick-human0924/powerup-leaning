import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
const output=process.argv[2]||'docs/pm-review/rendered-v2';
const base=process.env.REVIEW_URL||'http://127.0.0.1:3001';
fs.mkdirSync(output,{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
const context=await browser.newContext({viewport:{width:375,height:812},reducedMotion:'reduce'});
const page=await context.newPage();
await page.goto(base);await page.getByRole('button',{name:/我带安哲练/}).waitFor();
const measurements=[];
for(const [i,name] of ['今日','教材','练习','反馈','记录'].entries()){
 await page.getByRole('navigation',{name:'主要页面'}).getByRole('button',{name,exact:true}).click();
 await page.locator('.view-stack').waitFor();
 if(name==='教材')await page.locator('.unit-strip button').filter({hasText:'Our new school'}).click();
 if(name==='今日')await page.waitForFunction(()=>[...document.querySelectorAll('.home-view img')].every(img=>img.complete&&img.naturalWidth>0),{timeout:15000});
 await page.screenshot({path:path.join(output,`${String(i+1).padStart(2,'0')}-${name}-375.png`),fullPage:true});
 measurements.push(await page.evaluate(name=>({view:name,viewport:innerWidth,scrollWidth:document.documentElement.scrollWidth,body:getComputedStyle(document.body).fontSize,text:[...document.querySelectorAll('p,label,button,small,select,input,textarea')].filter(e=>e.getClientRects().length).slice(0,80).map(e=>({text:(e.textContent||'').slice(0,60),font:getComputedStyle(e).fontSize,color:getComputedStyle(e).color,height:e.getBoundingClientRect().height}))}),name));
}
fs.writeFileSync(path.join(output,'measurements.json'),JSON.stringify(measurements,null,2));
await browser.close();console.log(JSON.stringify({output,captured:5,base}));
