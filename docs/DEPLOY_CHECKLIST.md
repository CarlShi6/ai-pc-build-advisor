# 部署清单（Windows PowerShell）

照顺序做。每一步写了：去哪里、点什么或运行什么、成功后应该看到什么。网站界面的按钮名可能随时间略有变化，找不到时按意思找最接近的那个。

背景说明在 `docs/DEPLOY.md`；这里只写操作。

**三条规矩，整个过程都适用：**

- key 只粘贴到 `npx wrangler secret put` 的提示里，不要放进任何文件、聊天或命令参数。
- 所有命令都在项目根目录运行：

  ```powershell
  cd "C:\Users\carls\Documents\ChatGPT\AI装机助手\ai-pc-build-advisor"
  ```

- 设置 `$env:...` 的那几步和后面的 `deploy:check`、`wrangler deploy` 要在**同一个** PowerShell 窗口里做（环境变量只在当前窗口有效）。

---

## 0. 准备

1. 确认 Node 可用：`node --version`，应显示 v20 或更高。
2. 确认依赖已装：`npm install`，最后应显示 `found 0 vulnerabilities` 或类似的完成信息，没有 `ERR!`。
3. 确认代码是最新提交：`git status`，应显示 `nothing to commit, working tree clean`（`docs/portfolio/` 未跟踪可以忽略）。

---

## a. OpenAI：项目、key、月度上限、告警

1. 打开 <https://platform.openai.com/>，登录。
2. **新建项目**：左上角项目切换器 → **Create project** → 名字填 `AIPC production` → **Create**。
   - 成功：左上角显示 `AIPC production`。
3. **新建 key**：确认左上角是 `AIPC production`，进入 **API keys** → **Create new secret key**。
   - Name：`aipc-worker`；Project：`AIPC production`；Permissions：**All**。
   - 如果你选 Restricted，或者项目限制了可用模型，必须放行这三个模型：`gpt-5.4`（读图）、`gpt-4.1-mini`（判断是不是电脑）、`omni-moderation-latest`（内容审核）。否则线上读图会报错。
   - **Create secret key** 后复制显示的 key（以 `sk-proj-` 开头）。它只显示这一次，先放在剪贴板里，b.6 要用。
4. **月度上限 $30**：**Settings** → 选 `AIPC production` 项目 → **Limits**（或 Budget）。
   - 月度预算 / Monthly budget 填 `30`，保存。
   - 如果项目页没有这个选项，就在 **Settings → Organization → Limits** 设组织的月度预算 `30`。
   - 成功：页面显示 $30 的月度预算。
5. **告警邮件**：同一个 Limits 页里的 **Email notification threshold**（或 Budget alerts），填 `15`（再加一个 `24` 更好）→ 保存。
   - 告警发到组织的账单邮箱：在 **Settings → Organization → General / Billing** 确认那是你的邮箱。
6. **余额**：**Settings → Billing** 确认有可用余额，或者已绑定付款方式。没有余额时所有请求都会失败。

---

## b. Cloudflare

### b.1 升级 Workers Paid

读一张照片的 CPU 时间约 160 ms，免费版每次请求只有 10 ms（`docs/DEPLOY.md` "CPU time"）。

1. 打开 <https://dash.cloudflare.com/> 登录 → 左侧 **Workers & Pages**（或 Compute (Workers)）→ **Plans**。
2. 选 **Workers Paid**（$5/月）→ **Purchase** 或 **Upgrade**，按提示付款。这一步由你在页面上完成。
3. 成功：Plans 页当前计划显示 **Workers Paid**。

### b.2 wrangler login

```powershell
npx wrangler login
```

- 第一次运行如果问 `Need to install the following packages: wrangler@... Ok to proceed? (y)`，输入 `y`。
- 浏览器会打开 Cloudflare 授权页 → 点 **Allow**。
- 成功：终端显示 `Successfully logged in.`

然后确认账号：

```powershell
npx wrangler whoami
```

成功时会显示你的邮箱和 Account Name / Account ID。如果列出多个账号，后面的命令会问你用哪个，选同一个。

### b.3 创建 D1 并替换 ID

```powershell
npx wrangler d1 create aipc-image-cap
```

- 如果问 `Would you like Wrangler to add it on your behalf to your Wrangler configuration file?`，选 **No**，下一步手动改。
- 成功：输出 `Successfully created DB 'aipc-image-cap'`，还有一段配置，其中有一行 `"database_id": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"`。
- 打开 `wrangler.jsonc`，把 `"database_id": "REPLACE_WITH_D1_DATABASE_ID"` 换成上面那串 ID，保存。
  - 这个 ID 不是秘密，可以提交进 git：`git commit -am "set D1 database id"`。

### b.4 D1 建表 / 迁移

不需要迁移。代码第一次用到时会自己建表（`CREATE TABLE IF NOT EXISTS image_analysis_daily ...`），全局上限和每 IP 上限共用这张表。

如果想现在就确认 D1 能用（可选）：

```powershell
npx wrangler d1 execute aipc-image-cap --remote --command "CREATE TABLE IF NOT EXISTS image_analysis_daily (day TEXT PRIMARY KEY, count INTEGER NOT NULL)"
```

成功：输出里有 `"success": true`（或 `Executed 1 command`）。

### b.5 Turnstile 站点（先只填 workers.dev 域名）

1. 先找到你的 workers.dev 子域：Dashboard → **Workers & Pages** → 右侧 **Subdomain**（形如 `xxx.workers.dev`）。
   - 本站的地址会是 `ai-pc-build-advisor.<你的子域>.workers.dev`。
2. Dashboard 左侧 **Turnstile** → **Add widget**（或 Add site）：
   - Widget name：`AIPC`；
   - Hostname：只填 `ai-pc-build-advisor.<你的子域>.workers.dev`；
   - Widget Mode：**Managed**；
   - Pre-clearance：No。
3. **Create**。页面显示两样东西：
   - **Site Key**：公开的，会打进前端代码。
   - **Secret Key**：秘密，下一步用 `secret put` 上传。
4. 在**要用来部署的那个 PowerShell 窗口**里设 Site Key：

   ```powershell
   $env:VITE_TURNSTILE_SITE_KEY = "<粘贴 Site Key>"
   ```

   不开 Turnstile 也能上线（还有限流和上限挡着），那就跳过这一步和 b.6 的第二个 secret。`deploy:check` 会检查两边一致：前端有 Site Key 时服务器必须有 Secret，反过来也一样。

### b.6 上传 secrets

每条命令都会提示 `Enter a secret value:`，粘贴后回车（屏幕上不显示）。

```powershell
npx wrangler secret put OPENAI_API_KEY
```

- 如果问 `There doesn't seem to be a Worker called "ai-pc-build-advisor". Do you want to create a new Worker with that name and add secrets to it?`，选 **Y**。
- 成功：`✨ Success! Uploaded secret OPENAI_API_KEY`。
- 上传成功后，可以把剪贴板里的 OpenAI key 清掉。

启用了 Turnstile 的话（粘贴 b.5 的 Secret Key）：

```powershell
npx wrangler secret put TURNSTILE_SECRET_KEY
```

确认：

```powershell
npx wrangler secret list
```

应列出 `OPENAI_API_KEY`（和 `TURNSTILE_SECRET_KEY`）。只显示名字，不显示值。

- 如果还列出 `STRIPE_*`、`SUPABASE_*`、`BEST_BUY_*` 等旧 secret，v3 不会读它们，可以删：`npx wrangler secret delete <名字>`。

只有这两个是 secret。其他设置（上限、`AI_PROVIDER` 等）都在 `wrangler.jsonc` 的 `vars` 里，不要用 `secret put` 放它们，也不要设任何 `VITE_` 开头的 key。

---

## c. 第一次部署：暂停读图

1. 部署前检查（同一个窗口，b.5 设过 `$env:VITE_TURNSTILE_SITE_KEY` 的话它会被打进这次构建）：

   ```powershell
   npm run deploy:check
   ```

   它会依次检查：配置、secrets、构建、预览 E2E、路由，大约 3–5 分钟。
   - 成功：最后一行是 `Ready to deploy: ...`，中间列出 "Going live (v3)" 和 "Hidden in production (must be 404)" 两张路由表。
   - 任何 `FAIL` 都会让它停下并以非 0 退出；按 FAIL 那行的说明改好再跑。

2. 部署，并打开暂停开关：

   ```powershell
   npx wrangler deploy --var IMAGE_ANALYSIS_PAUSED:true
   ```

   - 第一次可能问是否注册 workers.dev 子域，按提示确认。
   - 成功：输出有 `Uploaded ai-pc-build-advisor`、`Deployed ai-pc-build-advisor triggers`，然后是 `https://ai-pc-build-advisor.<你的子域>.workers.dev` 和 `Current Version ID: ...`。
   - 记下这个 Version ID，回滚时有用。

3. 冒烟测试（不花 AI 费用）：

   ```powershell
   npm run smoke -- https://ai-pc-build-advisor.<你的子域>.workers.dev
   ```

   成功的样子：
   - 每行都是 `PASS`；
   - 其中一行是 `POST /api/image-analyses refuses a non-image before any AI call · kill switch is ON (analysis paused)`；
   - 最后一行是 `17/17 passed against https://...`。

4. 浏览器打开这个网址看一眼：
   - 首页能打开，页脚有 Privacy 和 Terms；
   - `/terms` 底部是你的邮箱；
   - 在 `/start/image` 上传照片会显示 "unavailable" 提示，并把 Describe 放在第一位。

---

## d. 打开读图并真实测一张照片

1. 关掉暂停，重新部署（同一个窗口，不用重新构建，`deploy:check` 的构建还在）：

   ```powershell
   npx wrangler deploy --var IMAGE_ANALYSIS_PAUSED:false
   ```

   成功：同 c.2，生成新的 Version ID。

2. 用**你自己的**一张电脑照片（会产生一次 AI 调用，约 $0.04，计入当天上限）：

   ```powershell
   npm run smoke -- https://ai-pc-build-advisor.<你的子域>.workers.dev --analyze "C:\路径\你的照片.jpg"
   ```

   - **没开 Turnstile**：成功时最后一项是 `PASS  POST /api/image-analyses reads ... · started@1.9s case@2.5s ... done@16.0s`，最后一行是 `18/18 passed`。
   - **开了 Turnstile**：这一项会显示 `refused before streaming as expected: TURNSTILE_REQUIRED`。这是正常的，脚本没法过人机验证。这时改在浏览器里测：打开 `/start/image`，选照片，过 Turnstile，点 Analyze。
     - 约 2 秒进入 Studio，零件陆续出现；
     - 约 15–20 秒读完；
     - 能保存到 My Builds。

3. 到 OpenAI → **Usage** 看到刚才的调用（可能晚几分钟），确认费用在预期内。

4. 到 Cloudflare → Worker → **Metrics** 看 CPU time（读图那次应在几百 ms 以内）。

---

## e. 出问题时

### 立刻停读图（最快，不碰代码）

Dashboard → **Workers & Pages** → `ai-pc-build-advisor` → **Settings** → **Variables and Secrets** → `IMAGE_ANALYSIS_PAUSED` → Edit → 改成 `true` → **Deploy**（或 Save）。几秒内生效：读图请求直接返回暂停提示，不读照片、不计数、不调 AI。

命令行等效（需要本地还有这次的构建）：

```powershell
npx wrangler deploy --var IMAGE_ANALYSIS_PAUSED:true
```

注意：之后每次 `wrangler deploy` 都会用 `wrangler.jsonc` 加命令里的 `--var` 覆盖 Dashboard 里改过的变量，所以重新部署时记得带上你要的 `--var IMAGE_ANALYSIS_PAUSED:...`。

### 怀疑 key 泄露或费用异常

1. OpenAI → **API keys** → 找到 `aipc-worker` → **Revoke**。读图会立刻失败，页面显示 "unavailable"，其他页面照常。
2. 新建一个 key，`npx wrangler secret put OPENAI_API_KEY` 重新上传（上传会立刻生效）。

### 回滚到上一个版本

```powershell
npx wrangler deployments list
```

这会列出最近的部署和各自的 Version ID。回滚到上一个版本：

```powershell
npx wrangler rollback
```

它会问回滚原因，再确认 `y`。要回到指定版本：

```powershell
npx wrangler rollback <Version ID>
```

- 成功：`Successfully rolled back to version ...`。
- Dashboard 也能做：Worker → **Deployments** → 目标版本右侧 **⋯** → **Rollback**。
- 回滚恢复的是那个版本的代码和 vars。secrets 不随版本回退，用的是当前值。

### 看线上日志

实时日志（开着就会持续显示，Ctrl+C 停止）：

```powershell
npx wrangler tail --format pretty
```

每个请求会显示一行（方法、路径、状态）和代码里的 `console.error`。应用只记录错误，不记录照片、IP 或 key。

历史日志：Dashboard → Worker → **Observability**（Logs）。`wrangler.jsonc` 已开启 Workers Logs（`observability.enabled`），可以按时间、状态码搜索。

### 常见现象

| 现象                                | 多半是                                                                                                            | 看哪里                                                                              |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| 上传后显示 "unavailable"            | 暂停开关开着、OpenAI key 无效或没余额、D1 绑定缺失                                                                | `wrangler tail` 里的错误码；OpenAI Usage / Billing                                  |
| "Photo reading is paused for now"   | OpenAI 余额用完（`insufficient_quota`，代码 `PROVIDER_QUOTA_EXHAUSTED`）：和每日上限一样的暂停提示，引导 Describe | OpenAI → Billing 充值后立刻恢复，不用重新部署                                       |
| "Photo reading is paused for today" | 当天 30 次全局上限用完（UTC 0 点重置）                                                                            | 正常；要放宽改 `wrangler.jsonc` 的 `IMAGE_ANALYSIS_DAILY_CAP` 后重新 check + deploy |
| 同一个人第 11 次被拒                | 每 IP 每天 10 次                                                                                                  | 正常                                                                                |
| Turnstile 一直转圈或失败            | Turnstile 的 Hostname 和实际域名不一致                                                                            | Turnstile → 你的 widget → Hostnames                                                 |
| 读图中途 "Reading was interrupted"  | 页面被刷新或网络断开                                                                                              | 用户可以点 "Read the photo again"                                                   |

---

## f. 自定义域名（待定）

先空着。等你告诉我：

- 域名在哪家注册商；
- 你的个人网站是不是在同一个域名上。

之后我再补这一节：DNS 怎么接入 Cloudflare、Worker 的 Custom Domain 或 Route 怎么设、Turnstile 要加的 Hostname，以及 HSTS 对子域的影响。
