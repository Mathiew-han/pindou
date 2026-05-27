# PixelBeads

一个部署在 Vercel 的拼豆图纸生成站点。前端负责图片上传、像素化预览、144/221 色映射和图纸导出；后端使用 Vercel Serverless Functions 提供真实注册登录、会话恢复、联系表单和基础安全校验。

## 已实现

- 图片上传后在浏览器内转换为拼豆图纸
- 支持 `32x32` 到 `128x128` 固定尺寸
- 支持 `MARD 144` / `MARD 221` 色卡
- 支持 `mard` / `coco` / `manman` 命名规则
- 导出 PNG 图纸和 CSV 色号用量表
- 社区图纸页与联系我们页
- 真实注册、登录、登出、刷新恢复会话
- Vercel Analytics 和 Speed Insights 接入

## 本地开发

安装依赖：

```bash
npm install
```

只跑前端：

```bash
npm run dev
```

如果要连同 `api/*.js` 一起调试，建议直接用 Vercel 本地环境：

```bash
vercel dev
```

## 环境变量

部署到 Vercel 前至少需要配置这些环境变量：

- `DATABASE_URL` 或 `POSTGRES_URL`
  - 推荐直接使用 Vercel Postgres 提供的连接串。
- `AUTH_SECRET`
  - 用于签发登录 JWT，会话恢复依赖它。
  - 建议使用长度至少 32 的随机字符串。
- `ALLOWED_ORIGINS`
  - 多个域名用逗号分隔。
  - 例如：`https://your-domain.com,https://preview-domain.vercel.app`
- `AD_SALES_EMAIL`
  - 可选。不填时默认使用 `2072719218@qq.com`。

## Vercel 部署要点

1. 在 Vercel 项目中创建 Postgres 数据库。
2. 将数据库变量自动注入项目，或手动设置 `DATABASE_URL` / `POSTGRES_URL`。
3. 设置 `AUTH_SECRET`。
4. 根据正式域名设置 `ALLOWED_ORIGINS`。
5. 重新部署。

认证相关数据表会在首次注册/登录时自动创建：

- `app_users`
- `app_sessions`

## 监控与观测

当前已接入：

- `@vercel/analytics`
- `@vercel/speed-insights`

另外可直接在 Vercel 面板查看：

- Runtime Logs
- Function Invocations
- Web Analytics
- Speed Insights

健康检查接口：

```text
GET /api/health
```

登录态恢复接口：

```text
GET /api/session
```

## 安全边界

当前已做：

- HttpOnly 会话 Cookie
- CSRF Token 校验
- Origin 白名单校验
- bcrypt 密码哈希
- PostgreSQL 参数化查询
- 请求体大小限制
- 基础限流
- CSP / 安全响应头

当前仍然建议补充：

- Vercel WAF / Bot Protection
- Cloudflare Turnstile 或 reCAPTCHA
- 持久化限流存储（当前限流仍是实例内存级）
- 邮箱验证和密码找回流程
- 审计日志与异常告警

## 校验

已通过：

```bash
npm run build
npm run lint
node --check api/*.js server/*.js
```
