# StoryVerse

StoryVerse 是一个围绕真实人生经历展开的叙事共鸣产品。它希望帮助用户写下自己的故事，也在故事星图中遇见与自己相似或截然不同的人生。

当前版本重点服务于前端体验验证与后端接入前的产品链路打磨：从沉浸式入口、故事生态预览、登录注册、首故事输入，到 AI 整理、共鸣选择和 3D 星图浏览，已经形成一条完整的体验闭环。

## 在线预览

公开网页：

[https://chelsealeezc.github.io/StoryVerse/](https://chelsealeezc.github.io/StoryVerse/)

当前主分支：

[main](https://github.com/chelsealeezc/StoryVerse/tree/main)

> GitHub Pages 由 `.github/workflows/pages.yml` 自动构建并发布。当前仓库以 `main` 作为唯一发布分支。

## 当前体验流程

```text
A. Gateway Intro 沉浸式入口
  ↓
B. Previewing 故事生态预览
  ↓
C. 注册 / 登录
  ↓
D. Story Input Wizard 首故事输入流程
  ↓
D. AI 整理与确认发布
  ↓
E. 三维共鸣选择
  ↓
F. StoryVerse 3D 星图主页面
```

## 页面模块

- A｜Gateway Intro：沉浸式舷窗入口，逐行文案显现，支持跳过至注册登录。
- B｜Previewing：故事生态预览，弧形故事卡片 carousel，支持左右切换。
- C｜注册与登录：支持中英文切换、昵称、邮箱 / 电话、密码输入，以及忘记密码弹窗的前端接口。
- D｜Story Input Wizard：人生事件引导、故事正文输入、草稿保存、专注模式、城市搜索与高德坐标解析、AI 分析结果确认。
- E｜共鸣选择：围绕城市、人生阶段、主题三个维度，选择想看到「相近」或「不同」的故事。
- F｜StoryVerse 星图主页面：3D 星图浏览、属性调整、故事浮层、喜欢 / 不喜欢 / 举报、个人中心与退出。

## 迭代历史

### 0.1｜PRD 梳理与 localhost 原型

- 基于飞书功能说明梳理 StoryVerse 的核心目标：故事输入、相似 / 相异推荐、反馈闭环。
- 明确第一阶段先做 localhost 可预览原型，不先接完整后端。
- 将「轻量星图 / 卡片式星图」作为第一阶段验证重点。

### 0.2｜首故事输入链路

- 搭建人生事件引导选择页、故事正文输入页、AI 分析结果页、确认发布页。
- 增加「其他」自定义引导。
- 修复草稿保存误清空问题，改为自动保存用户输入。
- 增加专注模式，隐藏干扰信息，让用户只保留标题与正文输入。
- 增加大量粘贴提示、离开页面保存草稿提示等关键弹窗。

### 0.3｜C02 / C03 重点打磨

- 根据同伴版本，覆盖迭代 C02 人生事件引导选择页和 C03 故事正文输入页。
- 接入城市搜索与高德坐标解析的前端逻辑。
- 多次调整 C02 交互动效，从滚动抽卡改为更适合 PC 的横向卡片展开。
- 优化 C03 专注模式顶部栏、退出方式、底部引导词与按钮逻辑。

### 0.4｜ABC 入口重构

- 将产品入口重塑为三段式体验：
  - Intro：沉浸式舷窗入口。
  - Previewing：先尝鲜看看其他人的故事，理解平台基调。
  - 注册 / 登录：进入正式写故事流程。
- 将 ABC 页面改为独立屏幕切换，而不是普通长页面滚动。
- 引入蓝天、云层、舷窗和故事卡片 carousel 的视觉系统。
- 修复 Skip / 跳过按钮点击逻辑，使其直接滑入注册登录页。

### 0.5｜页面结构与评审清单

- 按 ABCDEF 重新整理页面结构与子页面清单，方便团队按页面提交修改意见。
- 去除 localhost 演示感提示，例如「重置演示」。
- 将首页入口绑定到 StoryVerse logo。
- 后续 D/E/F 页面逐步统一顶部常驻按钮与中英文切换控件。

### 0.6｜中英文、日夜模式与视觉统一

- 全站增加中英文切换，尤其保证中文模式下提示文案不再中英夹杂。
- 全站增加白天 / 深夜模式。
- ABC 页面沿用沉浸式蓝天 / 夜景视觉。
- D/E 页面适配深夜模式，并为白天模式替换为天空背景图。
- 统一右上角语言、日夜、搜索等常驻控件为轻量玻璃态按钮。

### 0.7｜AI 整理与故事画册

- D12 / D13 增加 AI 分析等待与确认发布体验。
- 确认发布页支持正文编辑。
- 智能分析结果展示主题、情绪、意义三类标签。
- 标签支持增加、删除与「其他」自定义输入，预留安全审核位置。
- 右侧预留 AIGC 故事画册区域，并接入本地图片生成接口方案。

### 0.8｜3D 星图主页面

- E / F 星图页接入 Three.js、React Three Fiber、Drei、Postprocessing 与 GSAP。
- 星体大小来自文本长度，颜色来自主题，相对距离来自与用户的相似度。
- 点击星体后相机推进并打开故事卡片。
- 新增底部悬浮导航、搜索、个人账户、退出、属性调整等入口。
- 属性调整浮窗与 E01 三维共鸣选择保持同一交互模式。

### 0.9｜反馈闭环与账号弹窗

- F 故事弹窗增加喜欢、不喜欢、举报。
- 举报支持预设原因与自行填写。
- 个人中心增加修改昵称、修改密码、修改绑定邮箱、用户反馈输入框。
- 退出按钮回到 A 页。
- C 页底部链接更新为新手引导、RED / 小红书、邮箱、隐私政策与服务条款。

### 1.0｜main 发布与 Pages 部署

- 将原 `frontend-polish` 分支的前端打磨成果合并并推送至 `main`。
- GitHub Pages 公开页面以 `main` 为准自动部署。
- 当前阶段仍以静态前端和本地模拟接口为主；真实用户、草稿、故事、反馈、举报、审核和图片生成数据需要后续接入云端数据库与服务端能力。

## 当前前端重点

- ABC 是沉浸式入口体验，强调产品基调与情绪氛围。
- D 是首故事输入流程，重点降低空白页焦虑，并让草稿、标签、城市、专注模式顺滑工作。
- E 是用户选择想听见怎样回声的共鸣筛选页。
- F 是 StoryVerse 的核心浏览体验，用 3D 星图承载故事生态。
- 全站需要持续保证中英文、白天 / 深夜模式、移动端和不同屏幕尺寸下的可读性。

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

默认本地开发地址通常为：

[http://127.0.0.1:4173/](http://127.0.0.1:4173/)

## 本地预览生产构建

```bash
npm run build
npm run preview -- --host 127.0.0.1 --port 4174
```

本地预览地址：

[http://127.0.0.1:4174/](http://127.0.0.1:4174/)

## AI 故事生图

故事确认页已接入阿里云百炼通义万相的本地服务端方案。复制环境变量模板并填入自己的百炼 API Key：

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

随后运行：

```bash
npm run dev
```

密钥只由本机 Vite 服务端读取，不会进入浏览器代码；千问先生成结构化四格分镜，万相 2.7 再生成连续画面。页面以 2×2 排列并可合成为一张 PNG 下载，图片不会上传长期存储。

> GitHub Pages 是静态托管，不能安全保存 API Key。公开环境需要把 `/api/generate-image` 部署为独立服务端接口，再通过 `VITE_IMAGE_API_URL` 指向该地址。

生产图片接口可通过 `Dockerfile.api` 构建，容器监听 `3000` 端口，健康检查为 `/health/live`。服务端必须配置 `DASHSCOPE_API_KEY`、`DASHSCOPE_WORKSPACE_ID` 和 `FRONTEND_ORIGINS=https://chelsealeezc.github.io`；前端构建时设置 `VITE_IMAGE_API_URL=https://<你的API域名>/api/generate-image`。

## 构建

```bash
npm run build
```

构建产物会输出到 `dist/`，并复制 `dist/index.html` 为 `dist/404.html`，用于 GitHub Pages 的 SPA 路由回退。

## 部署

推送到 `main` 后，GitHub Actions 会自动运行：

```bash
npm ci
npm run build
```

部署完成后访问：

[https://chelsealeezc.github.io/StoryVerse/](https://chelsealeezc.github.io/StoryVerse/)
