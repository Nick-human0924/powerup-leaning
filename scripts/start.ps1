param([int]$Port=3001,[switch]$Production)
$ErrorActionPreference='Stop'
$projectPath=Split-Path $PSScriptRoot -Parent
Set-Location -LiteralPath $projectPath
if (!(Get-Command node -ErrorAction SilentlyContinue)) {
  $runtimeNode=Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin'
  if (Test-Path -LiteralPath (Join-Path $runtimeNode 'node.exe')) { $env:PATH="$runtimeNode;$env:PATH" }
}
if (!(Test-Path -LiteralPath 'node_modules\next\dist\bin\next')) { throw '请先安装依赖，见 README.md。' }
node scripts/bootstrap.mjs
node scripts/prepare-worker.mjs
node scripts/prepare-seed.mjs
if ($Production) { node node_modules/next/dist/bin/next start --hostname 0.0.0.0 --port $Port }
else { node node_modules/next/dist/bin/next dev --hostname 0.0.0.0 --port $Port }
