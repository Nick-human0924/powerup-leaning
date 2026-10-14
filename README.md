# 安哲的英语小课堂

手机优先的本地学习助手：短时家长带练、孩子看题/听题/文字应答、家长反馈核对、教材增量导入和可追溯学习档案。

## 从 GitHub 克隆运行

公开仓库包含应用源码、原创插画、导入工具和测试。教材 PDF、教材原页、私有教材种子、录音、学习档案、密钥及原始启动包均不上传。首次克隆显示空教材库，通过应用导入自己的材料即可使用。

```powershell
git clone https://github.com/Nick-human0924/powerup-leaning.git
cd powerup-leaning
pnpm install --frozen-lockfile
pnpm run setup
pnpm dev --port 3001
```

打开 http://localhost:3001 。`pnpm run setup` 只创建缺失的本地空白种子和 PDF worker，不覆盖已有教材或 IndexedDB 学习记录。生产运行：`pnpm build` 后 `pnpm start --port 3001`。

公开检验：`pnpm test`、`pnpm typecheck`、`pnpm build`。没有私有教材时，单元测试自动运行合成导入与服务契约测试；教材完整性及原书浏览器回归需在私有本机恢复教材后运行。私有资料不要上传 GitHub。

## 私有本机教材状态

**当前材料实况**：用户现已放入九份 Power Up 1 Second Edition PDF，本机逐页渲染和 RapidOCR 已完成 90 页。当前知识地图按 Hello、Unit 1–7 排列，包含 82 个课型页段、196 个知识点、197 道练习及真实原页来源。Unit 7 仅收录至印刷 p.89。初始教材不会生成授课日期或成绩；已有用户记录在升级时增量保留。p.49 原句是 chocolate 请求，water 为明确标注的替换词练习。

## 本机启动（当前电脑）

在 PowerShell 中执行：

```powershell
cd 'D:\Codex\PU学习复盘'
.\scripts\start.ps1 -Port 3001
```

打开 http://127.0.0.1:3001 。窗口保持运行；按 Ctrl+C 停止。本项目约定使用3001端口。

需要正式构建时：

```powershell
node node_modules/next/dist/bin/next build
.\scripts\start.ps1 -Port 3001 -Production
```

`start.ps1` 会使用已有 Node，或这台电脑自带的 Codex Node 路径，不依赖 `npm` 命令。

## 换电脑／首次安装

安装 Node.js 22+ 和 pnpm；将整个**私有项目目录**复制过去，包括 `schemas/initial-reference.json`、`public/seed.json`、`public/reference-pages/`、`public/textbook-pages/`（教材版权内容被 gitignore 排除）。已有完整教材种子时直接执行：

```powershell
pnpm install --frozen-lockfile
pnpm dev --port 3001
```

当前电脑没有 npm 命令，已使用 Codex 自带 pnpm 安装。需要重新装依赖时可执行：

```powershell
& "$env:USERPROFILE\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\fallback\pnpm.cmd" install --frozen-lockfile
```

## 手机使用与安装

电脑和手机连接同一 Wi-Fi，电脑用 `ipconfig` 查看 Wi-Fi 的 IPv4 地址。手机打开 `http://电脑IPv4:3001`，可查看教材、手动练习、录入文字和备份。电脑应一直开着；手机和电脑各有独立学习档案。

麦克风、PWA安装和浏览器缓存需要安全环境：电脑 localhost 可用；手机普通局域网 HTTP 不保证录音/识别可用。正式手机安装请通过有认证保护的 HTTPS 部署，不要把私有教材站点直接公开。部署 Next.js 完整服务，不能只导出静态网页。没有托管账号/凭证，本次未部署云端站点。

生产模式联网首次打开后，应用外壳与已访问静态资源由 Service Worker 缓存；练习档案和导入附件保存在 IndexedDB。离线可继续已加载内容的手动操作。尚未访问/缓存的附件可能不可见，浏览器清除站点数据会删掉学习档案。隐身模式不适合长期保存。请固定同一个访问地址；localhost、127.0.0.1 和不同端口各有独立档案。早期样例会自动增量合并当前教材种子，已有观察、原话和实际课次保留。

## 导入一节新课（无需修改代码）

1. 打开「教材 → 导入」，选择 PDF/JPG/PNG，可批量；建议每个PDF约10页。
2. 核对书名、册次、版本和单元。PDF按实际页序逐页提取文字、生成预览；扫描页显示「需要OCR或手动录入」，不会声称已解析。
3. 每页填写书中印刷页码、词汇或句型（每行 `表达|中文含义`）、可核对的来源原话。未知印刷页码留空；不能从文件名推断。
4. 如果这些内容确实上过，勾选实际课次并填写已知日期；不知道就留为未知。仅上传教材不会创建课次或成绩。
5. 点击「核对并发布」。新知识点和模板题立即进入教材、练习与推荐；旧观察记录和原始反馈保留。完全相同文件重新上传会提示重复，跨文件完全相同页图复用来源。

手动填写的内容必须来自真实页面；模板练习会标注「基于教材的练习」。AI建议同样需要核对。版本修订有审计记录，不删除原知识点或旧题引用。

## 语音／AI配置（可选）

复制 `.env.example` 为 `.env.local`，配置 `AI_API_KEY` 和需要的模型名，再重启。默认兼容 OpenAI Chat Completions / Audio API，`AI_BASE_URL` 可替换供应商。适配器在 `src/lib/providers.ts`，接口在 `src/app/api/`。密钥只能放服务端，不能使用 `NEXT_PUBLIC_` 前缀。

- `VISION_MODEL`：图片教材视觉抽取；模型必须支持图片和JSON输出。
- `STRUCTURING_MODEL`：反馈语义整理和逐题回答建议；模型必须支持JSON。
- `ASR_MODEL`：真实音频转写；接口仅接受明确 `consent=true` 的音频。
- `TTS_MODEL`：云端朗读；无配置可用浏览器朗读。

当前没有凭证，真实云端OCR/ASR/LLM尚未验证。测试使用模拟服务响应检验请求、结构校验、拒绝和缺密钥降级，不能代表真实识别准确率。批量文件处理在本机逐页完成；视觉建议逐页请求并核对。服务没有长期内存任务或伪造的云端持久存储。

家长「开始说」使用浏览器 Web Speech，启用前需勾选知情同意，浏览器厂商可能联网处理。录音留底默认只进本机，不上传；文字转写不等于发音评分。没有可靠服务时，孩子练习由家长核对文字/真实回答，手动评分。

官方接口依据：[Chat Completions](https://developers.openai.com/api/reference/resources/chat/subresources/completions/methods/create)、[Audio Transcriptions](https://developers.openai.com/api/reference/resources/audio/subresources/transcriptions/methods/create)。

## 档案备份与迁移

「记录 → 下载JSON备份」导出全量结构关系和历史。导入使用校验后合并，重复ID不重复写入，失败不会覆盖档案。支持 `1.0.0` 以及 V3 `0.3.0`、V2 `0.2.0`；上传旧HTML导出的JSON即可，不能自动读取另一个站点的 localStorage。旧知识点不认识时保留待核对映射，跳过记录保持未测。

JSON **不内嵌教材大附件与录音**。请单独保存原教材文件、下载本机录音；换设备仅导入JSON时来源关系仍在，但未随迁的附件需重新提供。浏览器数据完全清空前先备份。课次和观察可以删除；教材导入不会自动删除历史。

## 验证命令

```powershell
node node_modules/typescript/bin/tsc --noEmit
node node_modules/vitest/vitest.mjs run
node node_modules/@playwright/test/cli.js test
node scripts/validate-backup.mjs public/seed.json
```

Playwright默认测试 http://localhost:3001；可设置 `PLAYWRIGHT_BASE_URL`。使用已安装的 Chrome/Edge，或 `pnpm exec playwright install chromium` 安装测试浏览器。测试均使用隔离浏览器上下文，不操作真实用户档案。详见 `docs/TEST_RESULTS.md`。

## 实现范围

P0：本机闭环可用。P1：服务端可调用适配器、显式授权与校验已实现，真实模型准确性需要凭证和真实材料验收。P2：可解释1/3/7天推荐与一周摘要已提供；账号、自动多设备同步、长期趋势尚未实现。

不要把教材页图、儿童录音或私人备份提交公开仓库。项目本身可迁移，版权素材保持私有。
