import type { NextConfig } from 'next';
import { PHASE_DEVELOPMENT_SERVER } from 'next/constants';
export default function config(phase:string): NextConfig {
  const pages=process.env.GITHUB_PAGES==='true';
  return { poweredByHeader: false, distDir: phase === PHASE_DEVELOPMENT_SERVER ? '.next-dev' : '.next',
    ...(pages?{output:'export',basePath:process.env.NEXT_PUBLIC_BASE_PATH??'/powerup-leaning',trailingSlash:true,images:{unoptimized:true},outputFileTracingRoot:process.cwd()}:{}),
  };
}
