# StoryVerse 埋点 QA 清单

## 自动化

- [x] `AnalyticsPriority` 只能为 P0/P1/P2。
- [x] 客户端和 Edge Function 事件白名单一致。
- [x] 有效计时器支持暂停、恢复且不重复累计。
- [x] 视口设备分类边界：767/768、1099/1100。
- [x] `event_id` 为数据库主键，重试幂等。
- [x] 用户删除时 `user_id` 为 `ON DELETE SET NULL`。
- [x] 普通客户端没有分析表 INSERT 权限。
- [x] 生产 TypeScript/Vite 构建通过。
- [x] 13 个测试文件、73 项自动化测试通过。
- [x] 19.999/20.000 秒有效阅读和 999/1000ms 曝光边界通过。

## 本地数据库与 Edge Function

- [x] 使用 Colima 启动容器并执行 `npm run db:reset`，全部迁移成功。
- [x] 执行 `npm run db:test`，57 项 pgTAP 通过；新增账号、P0/P1/P2、行为模块和组合筛选断言。
- [x] 本地 HMAC 使用 `STORYVERSE_WORKER_TOKEN` 安全回退；生产可单独配置 `ANALYTICS_HMAC_SECRET`。
- [x] 启动 Functions，匿名首页事件返回 accepted=1。
- [x] 匿名发送 `story_input_snapshot` 返回 401。
- [x] 登录用户事件的 `user_id` 由 JWT 写入。
- [x] 管理员事件返回 skipped 且数据库无新增行。
- [x] 相同 `event_id` 重试只保留一行。
- [x] 批次 >20、事件 >64KB、批次 >256KB 被拒绝。
- [x] password/security_answer/access_token/api_key 字段被拒绝。
- [x] 非白名单 Origin 被 analytics handler 拒绝。
- [x] `npm run qa:local-analytics` 的 24 项合约全部通过并清理数据，包括管理员账号组合下钻。
- [x] `npm run qa:boundaries` 的 299 项断言通过，包括 `analytics-query` 参数与权限边界。
- [x] `npm run qa:local` 的 21 个完整业务检查点通过。
- [ ] 匿名速率限制需独立压测；数据库限流函数与调用路径已经覆盖。

## 已链接 Supabase 线上合约

- [x] 迁移 `202608200001_analytics.sql`、`202608200002_analytics_dashboard.sql` 与 `202608200003_analytics_research_dashboard.sql` 已应用。
- [x] 匿名白名单事件、JWT 身份、管理员跳过和普通用户 RLS 均通过。
- [x] 20 条/64KB/256KB 大小限制、敏感字段、来源、未知事件和过期时间均通过。
- [x] `event_id` 幂等，测试账号和测试事件在验证后清理。
- [x] 创作、星空、阅读、引导、搜索、导航、账号排名与行为时间线聚合 RPC 可用。
- [x] 远端 `admin-api` 可以按登录账号、P0/P1/P2 和行为模块组合下钻。
- [ ] 匿名速率限制仍需独立压测，避免在共享线上项目制造异常流量。

## P0 手工边界

- [ ] 标题聚焦 5 秒、失焦 5 秒：只累计前 5 秒。
- [ ] 正文输入时切到其他标签页：隐藏时间不累计。
- [ ] 有效 AI 整理只产生一份当前内容快照。
- [ ] 校验失败有 `ai_organize_clicked` 和 `story_validation_blocked`，没有快照。
- [ ] 粘贴记录完整文本、次数和字符数。
- [x] 星点在相机内 999ms 不曝光，连续 1000ms 后曝光（自动化边界）。
- [ ] 星点离开相机再进入，连续计时重新开始。
- [x] 同一 lobby/story/view 只曝光一次（完整 UI 旅程数据库核对）。
- [ ] 切换 explore/owned/liked 后按新 view 去重。
- [x] 共鸣刷新成功产生新 batch 与新 lobby_view，允许重新曝光。
- [ ] 共鸣刷新失败不更换 lobby_view。
- [x] 搜索 800ms 防抖、同查询去重、清空事件正确。
- [x] 阅读 19.999 秒不算 meaningful，20.000 秒算（自动化边界）。
- [ ] 失焦/隐藏期间阅读不累计。
- [x] 本人故事阅读 20 秒仍不算 meaningful。
- [ ] 关闭、切故事、切导航、Esc、路由离开都结算一次。
- [x] 喜欢、不喜欢均有 clicked 和 result。
- [x] 自己的故事没有喜欢、不喜欢、举报入口。

## 完整旅程

```text
主页 → 注册 → Icebreaker → 写故事/粘贴 → AI 整理 → 修改标签
→ 发布或人工审核 → 首次共鸣 → 推荐卡 → StarLobby → 星点曝光
→ 搜索/导航 → 大厅共鸣重排 → 星点点击 → 有效阅读 → 喜欢/不喜欢
```

- [x] 正常发布分支完整走一次。
- [ ] 人工审核分支完整走一次。
- [ ] AI 分析失败和重试走一次。
- [ ] 图片生成失败、复用、下载分支完整走一次；成功分支已验证为 2048×2048。
- [x] 新手引导完成和跳过分别走一次。
- [ ] 中文、英文、日间、夜间、桌面和移动端分别验证；本轮已验证中英文和桌面端。
- [x] 管理员实验看板结构与远端 SQL/RPC 一致。
- [x] 账号时间线只能通过服务端管理员接口读取；普通用户 RLS 返回空结果。
- [x] 完整 UI 旅程中的 P0 送达率为 100%，重复曝光率为 0%。

## 截图

页面和热点编号维护在 `screenshots/README.md`。截图只能使用本地虚拟实验账号与虚拟故事，不截取真实参与者页面。
