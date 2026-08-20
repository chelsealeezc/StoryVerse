# StoryVerse 生产发版 QA 报告

日期：2026-08-20  
候选版本：本地 Supabase 正式版  
发布目标：Supabase 项目 `zgyrbtdyraxglxhbkazp` 与 GitHub Pages

## 发布范围

- React、TypeScript、Vite 前端及压缩后的 WebP 资源。
- Supabase 数据库迁移、RLS、Edge Functions、Storage 和实验分析。
- 火山方舟审核、标签、Embedding、翻译和 Seedream 图片流程。
- StarLobby 推荐、故事恢复、互动限制、管理员后台与实验看板。
- 自动化测试、QA 脚本、架构/事件文档和设计截图。

真实冷启动 Excel/CSV 与 `outputs/` 转换产物只保存在本地，不进入公开仓库。

## 本地发布门禁

| 检查                         | 结果                                   |
| ---------------------------- | -------------------------------------- |
| `npm run format:check`       | 通过                                   |
| `npm test`                   | 15 个文件、80/80 通过                  |
| `npm run build`              | TypeScript 与 Vite 生产构建通过        |
| `npm run db:test`            | 57/57 通过                             |
| `npm run qa:local`           | 21/21 通过                             |
| `npm run qa:boundaries`      | 299 项断言通过，1 个本地网关差异已记录 |
| `npm run qa:moderation`      | 8/8 风险类别均未公开                   |
| `npm run qa:local-analytics` | 24/24 通过，测试数据已清理             |
| `git diff --check`           | 通过                                   |

## 已知非阻断项

- 本地 Supabase 模拟网关会把部分 OPTIONS CORS 响应覆盖为 `*`；函数层和生产环境的陌生 Origin 拒绝测试通过。
- StarLobby 的 Three.js 分片仍超过 Vite 500kB 提示线，但页面已按需加载，不阻断功能发布。
- 麦克风输入最终仍取决于用户浏览器是否支持并允许 `SpeechRecognition`。

## 生产验证

### Supabase

| 检查                               | 结果                                              |
| ---------------------------------- | ------------------------------------------------- |
| 数据库迁移 dry-run                 | 线上已是最新，无待执行迁移                        |
| Edge Function Secrets              | 必要配置存在；补齐独立埋点 HMAC 与生产公开 URL    |
| Edge Functions                     | 21 个函数完成部署或确认代码未变化                 |
| `npm run qa:online-smoke`          | 22/22 通过                                        |
| `npm run qa:online-story-recovery` | 5/5 通过                                          |
| `npm run qa:online-analytics`      | 24/24 通过，测试数据已清理                        |
| `npm run qa:online-image`          | 2048×2048；三次请求只产生 1 行记录和 1 次模型调用 |

线上图片 Prompt 已验证包含标题、地点、年龄、性别、人生阶段和完整正文；测试图片保存在 Storage 且可以读取。

### GitHub

- 正式发布分支：`agent/storyverse-production-release`
- 发布 PR：[#18](https://github.com/chelsealeezc/StoryVerse/pull/18)
- 正式发布提交：`c6f0796ee4d4f5796886e1da267ffc981557ae7d`
- PR 分支 CI：前端验证与数据库任务通过。
- `main` CI：通过。
- GitHub Pages 构建与部署：通过。

### 生产页面

- 生产地址：<https://chelsealeezc.github.io/StoryVerse/>
- 首页 HTTP 200，桌面视觉、注册/登录入口、中英文切换和静态资源加载正常。
- 浏览器控制台没有 error 或 warning。
- 生产 JavaScript 包内的 Supabase 地址为 `https://zgyrbtdyraxglxhbkazp.supabase.co`。
- 页面不再出现旧“审核人员入口”或邮箱/电话注册。
- 直接访问 `/StoryVerse/StarLobby` 时，GitHub Pages 返回 SPA 的 `404.html`，应用可以正常启动并按未登录规则显示首页，不会白屏。HTTP 状态仍为 GitHub Pages 静态托管的 404，这是当前深层路由回退方式的已知限制。
- 生产移动端没有再次使用独立设备执行全流程；相同构建的 390px 本地回归已经通过。
