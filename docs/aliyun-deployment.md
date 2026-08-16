# StoryVerse 阿里云部署手册

生产链路：ESA Pages → 同源 `/api/*` 代理 → SAE → RDS PostgreSQL。DashScope 仅由 SAE 服务端调用。

## RDS PostgreSQL

- 数据库：`storyverse`
- 运行账号：`storyverse_app`，只授予业务表 DML 权限
- migration 账号：`storyverse_migrator`
- SAE 与 RDS 使用同地域、同 VPC 的内网地址
- 开启 SSL；连接池上限默认 10

## SAE

使用 `Dockerfile.api` 构建端口 3000 的容器。配置以下保密环境变量：

```text
DATABASE_URL
DATABASE_MIGRATOR_URL
DASHSCOPE_API_KEY
DASHSCOPE_WORKSPACE_ID
DASHSCOPE_IMAGE_MODEL
DASHSCOPE_QWEN_MODEL
SESSION_SECRET
FRONTEND_ORIGINS
NODE_ENV=production
PORT=3000
```

容器启动时先在 advisory lock 保护下执行 Drizzle migration，成功后才监听端口。健康检查使用 `/health/live` 和 `/health/ready`。

## ESA Pages

连接 GitHub `main`，安装命令 `npm ci`，构建命令 `npm run build`，输出目录 `dist`。设置：

```text
VITE_BASE_PATH=/
VITE_API_BASE_URL=/api/v1
VITE_IMAGE_API_URL=/api/generate-image
BACKEND_API_ORIGIN=<SAE HTTPS origin>
```

真实数据库密码和 DashScope Key 不得使用 `VITE_` 前缀，也不得进入 Git、前端产物或日志。
