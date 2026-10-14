export const publicDemo = process.env.NEXT_PUBLIC_PUBLIC_DEMO === 'true';
export const basePath = (process.env.NEXT_PUBLIC_BASE_PATH ?? '').replace(/\/$/u, '');

export function appPath(path: string): string {
  if (!path.startsWith('/') || path.startsWith('//') || !basePath || path === basePath || path.startsWith(`${basePath}/`)) return path;
  return `${basePath}${path}`;
}
