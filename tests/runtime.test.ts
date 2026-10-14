import { afterEach, describe, expect, it, vi } from 'vitest';
afterEach(()=>{vi.unstubAllEnvs();vi.resetModules();});
describe('deployment resource paths',()=>{
  it('preserves local root paths by default',async()=>{
    vi.stubEnv('NEXT_PUBLIC_BASE_PATH','');vi.resetModules();
    const {appPath}=await import('../src/lib/runtime');
    expect(appPath('/seed.json')).toBe('/seed.json');
  });
  it('prefixes project assets once without changing external or blob URLs',async()=>{
    vi.stubEnv('NEXT_PUBLIC_BASE_PATH','/powerup-leaning/');vi.resetModules();
    const {appPath}=await import('../src/lib/runtime');
    expect(appPath('/seed.json')).toBe('/powerup-leaning/seed.json');
    expect(appPath('/powerup-leaning/visuals/hero.png')).toBe('/powerup-leaning/visuals/hero.png');
    expect(appPath('blob:synthetic')).toBe('blob:synthetic');
    expect(appPath('https://example.com/photo.png')).toBe('https://example.com/photo.png');
  });
});
