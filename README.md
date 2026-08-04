# StoryVerse

StoryVerse 是一个围绕真实人生经历展开的叙事共鸣产品。它希望帮助用户写下自己的故事，也在故事星图中遇见与自己相似或截然不同的人生。

当前版本重点服务于前端体验验证：从沉浸式入口、故事生态预览、登录注册、首故事输入，到 AI 整理、共鸣选择和 3D 星图浏览，形成一条完整的产品体验链路。

## 在线预览

公开网页：

[https://chelsealeezc.github.io/StoryVerse/](https://chelsealeezc.github.io/StoryVerse/)

当前主要迭代分支：

[frontend-polish](https://github.com/chelsealeezc/StoryVerse/tree/frontend-polish)

> GitHub Pages 由 `.github/workflows/pages.yml` 自动构建并发布。当前工作流支持从 `main` 和 `frontend-polish` 分支触发部署。

## 当前体验流程

```text
Gateway Intro
  ↓
Previewing 故事生态预览
  ↓
注册 / 登录
  ↓
首故事输入流程
  ↓
AI 整理与确认发布
  ↓
三维共鸣选择
  ↓
StoryVerse 3D 星图主页面
```

## 页面模块

- A｜Gateway Intro：沉浸式舷窗入口，逐行文案显现，支持跳过。
- B｜Previewing：故事生态预览，弧形故事卡片 carousel。
- C｜注册与登录：支持中英文切换，包含昵称、邮箱、密码输入。
- D｜Story Input Wizard：人生事件引导、故事正文输入、草稿保存、专注模式、城市搜索与坐标解析、AI 分析结果确认。
- E｜共鸣选择与 StoryVerse 星图：城市、人生阶段、主题三维共鸣选择；3D 星图浏览；属性调整；故事浮层卡片。
- F｜故事浏览与反馈：故事浏览、喜欢 / 不喜欢、关闭与举报等反馈闭环。

## 近期前端重点

- 全站支持中英文切换。
- 全站支持白天 / 深夜模式。
- ABC 页面使用沉浸式蓝天 / 星空视觉系统。
- DE 页面适配深夜模式，确保文本、输入框、弹窗和按钮可读。
- E 星图页接入 Three.js / React Three Fiber 3D 星图。
- E 星图「调整属性」支持读取共鸣选择、临时修改、确认后更新星图分布。
- 右上角语言、日夜、搜索等常驻控件统一为轻量玻璃态按钮。

## 技术栈

- React 18
- TypeScript
- Vite
- Three.js
- React Three Fiber
- Drei
- React Three Postprocessing
- GSAP
- Lucide React

## 本地开发

```bash
npm install
npm run dev
```

### AI 故事生图

故事确认页已接入阿里云百炼通义万相。复制环境变量模板并填入自己的百炼 API Key：

```bash
cp .env.example .env.local
```

编辑 `.env.local`：

```dotenv
DASHSCOPE_API_KEY=你的百炼_API_Key
DASHSCOPE_WORKSPACE_ID=你的百炼_Workspace_ID
DASHSCOPE_IMAGE_MODEL=wan2.7-image
DASHSCOPE_QWEN_MODEL=qwen-plus
```

随后运行 `npm run dev`。密钥只由本机 Vite 服务端读取，不会进入浏览器代码；千问先生成结构化四格分镜，万相 2.7 再生成四张连续画面。页面以 2×2 排列并可合成为一张 PNG 下载，图片不会上传长期存储。

> GitHub Pages 是静态托管，不能安全保存 API Key。公开环境需要把 `/api/generate-image` 部署为独立的服务端接口，再通过 `VITE_IMAGE_API_URL` 指向该地址。

生产图片接口可通过 `Dockerfile.api` 构建，容器监听 `3000` 端口，健康检查为 `/health/live`。服务端必须配置 `DASHSCOPE_API_KEY`、`DASHSCOPE_WORKSPACE_ID` 和 `FRONTEND_ORIGINS=https://chelsealeezc.github.io`；前端构建时设置 `VITE_IMAGE_API_URL=https://<你的API域名>/api/generate-image`。

默认本地开发地址通常为：

[http://127.0.0.1:4173/](http://127.0.0.1:4173/)

## 本地预览生产构建

```bash
npm run build
npm run preview -- --host 127.0.0.1 --port 4174
```

本地预览地址：

[http://127.0.0.1:4174/](http://127.0.0.1:4174/)

## 构建

```bash
npm run build
```

构建产物会输出到 `dist/`，并复制 `dist/index.html` 为 `dist/404.html`，用于 GitHub Pages 的 SPA 路由回退。

## 部署

推送到 `main` 或 `frontend-polish` 后，GitHub Actions 会自动运行：

```bash
npm ci
npm run build
```

部署完成后访问：

[https://chelsealeezc.github.io/StoryVerse/](https://chelsealeezc.github.io/StoryVerse/)
