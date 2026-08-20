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

发布完成后补充 Supabase Functions、线上业务冒烟、埋点、故事恢复、图片和 GitHub Pages 结果。
