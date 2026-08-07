# StoryVerse CloudBase / EdgeOne 部署手册

## 预算闸门

1. 只使用腾讯云国际站账号。
2. 新建 CloudBase 环境时必须看到 PostgreSQL 选项；先选香港，不可用再选新加坡。
3. 购买页显示的基础设施月费必须不高于 10 美元。
4. 任意条件不满足就停止，不切换 MySQL、Lighthouse 或其他付费资源。

## CloudBase PostgreSQL

新建 PG 环境和 `storyverse` 数据库后，通过数据库管理终端执行一次账户引导；把两段密码替换为分别生成的随机强密码，不能提交到仓库：

```sql
CREATE ROLE storyverse_migrator LOGIN PASSWORD '<MIGRATOR_PASSWORD>';
CREATE ROLE storyverse_app LOGIN PASSWORD '<APP_PASSWORD>';
GRANT CONNECT ON DATABASE storyverse TO storyverse_migrator, storyverse_app;
GRANT CREATE, USAGE ON SCHEMA public TO storyverse_migrator;
```

将两条启用 SSL 的连接串分别配置为 `DATABASE_MIGRATOR_URL` 和 `DATABASE_URL`。migration 会创建表、索引、7 条种子故事，并授予 `storyverse_app` 业务表 DML 和 sequence 权限。数据库不要开启浏览器匿名直连。

本地联调可运行 `docker compose up -d postgres`，再复制 `.env.example` 为 `.env.local`、将本地账户密码改为 compose 文件里的开发占位值，分别运行 `npm run dev:api` 与 `npm run dev`。这些开发密码不能用于云端。

## CloudBase Run

- 代码源：GitHub `chelsealeezc/StoryVerse`
- 分支：`main`
- Dockerfile：`Dockerfile.api`
- 端口：`3000`
- 最小实例：`0`
- 最大实例：`1`
- 存活检查：`/health/live`
- 就绪检查：`/health/ready`

保密变量：

```text
DATABASE_URL
DATABASE_MIGRATOR_URL
DATABASE_SSL_REJECT_UNAUTHORIZED=true
DATABASE_POOL_MAX=10
DASHSCOPE_API_KEY
DASHSCOPE_WORKSPACE_ID
DASHSCOPE_IMAGE_MODEL=wan2.7-image
DASHSCOPE_QWEN_MODEL=qwen-plus
SESSION_SECRET
FRONTEND_ORIGINS
NODE_ENV=production
PORT=3000
```

`FRONTEND_ORIGINS` 填 EdgeOne 生产域名的完整 origin。发布后必须确认 `/health/live` 与 `/health/ready` 都返回 HTTP 200。

## EdgeOne Pages

- 导入同一 GitHub 仓库，生产分支 `main`
- 安装：`npm ci`
- 构建：`npm run build`
- 输出：`dist`
- 加速区域：全球可用区（不含中国内地）

环境变量：

```text
VITE_BASE_PATH=/
VITE_API_BASE_URL=/api/v1
VITE_IMAGE_API_URL=/api/generate-image
CLOUDBASE_API_ORIGIN=<CloudBase Run 默认 HTTPS origin>
```

`functions/api/[[default]].js` 会把同源 `/api/*` 请求转发给 CloudBase，并保留 HttpOnly Session Cookie 与 `Set-Cookie`。不得把数据库连接串或 DashScope Key 配置为 `VITE_*`。

## 发布验收

1. 打开 EdgeOne 默认域名并注册，密码至少 10 位。
2. 刷新页面，确认仍为登录状态。
3. 写草稿，等待“保存”状态，再换浏览器登录确认草稿存在。
4. 分析并发布，完成共鸣选择，出现推荐后至少打开一条再进入星图。
5. 验证喜欢/不喜欢互斥，举报可成功提交。
6. 生成一张故事插画，确认只有一张且风格正确。
7. 检查浏览器产物和 CloudBase 日志，不得出现 Cookie、密码、正文、连接串或 API Key。
