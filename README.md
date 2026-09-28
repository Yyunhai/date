# 日期手账

微信小程序 + Spring Boot 后端 + MySQL。打开显示当天日期，点 `+` 记录当天的**工作 / 日记 / 心事**，日历页可回看任意一天。前后端完全分离。

## 目录

```
backend/      Spring Boot 3.3.5 + JPA，端口 8080（业务数据）
  analysis/   Python FastAPI 分析服务，端口 8081（只读统计，虚拟环境 backend/.venv）
miniprogram/  微信小程序原生代码（WXML/WXSS/JS，无第三方依赖）
scripts/      日期工具逻辑的断言测试：node scripts/test-date.js
```

## 第一次跑之前：填数据库密码

仓库里不含任何账号密码，两个服务各读一个本地文件，两个文件都已在 `.gitignore` 里：

```bash
cd backend
cp .env.example .env                                          # 分析服务用
cp src/main/resources/application-local.example.yml \
   src/main/resources/application-local.yml                   # Spring Boot 用
```

然后在这两个文件里填上自己的 MySQL 密码。少了 `application-local.yml`，后端会以 `Access denied for user 'root'@'localhost' (using password: NO)` 启动失败；少了 `.env`，`python analysis/app.py` 会直接打印缺密码的提示并退出。

## 启动后端

环境：JDK 17、Maven 3.8.9、MySQL 8.0（本机 3306）。

```bash
cd backend
mvn spring-boot:run
```

数据库 `date_app` 和表 `daily_entry` 由程序自动创建（`createDatabaseIfNotExist=true` + `ddl-auto: update`）。`application.yml` 里只有 `${DB_USER}` / `${DB_PASSWORD}` 占位，真实值来自上面那份 `application-local.yml`（profile `local` 由 `spring.profiles.include` 引入），也可以直接用同名环境变量覆盖。

验证：

```bash
curl http://localhost:8080/api/ping
```

## 启动分析服务（可选，只用收支页的「分析」屏才需要）

收支页右滑的分析屏走的是独立的 Python 服务，它只读 `daily_transaction`，不做写入。

```bash
cd backend
.venv/Scripts/activate        # 或 source .venv/bin/activate
pip install -r analysis/requirements.txt
python analysis/app.py        # 监听 127.0.0.1:8081
```

数据库密码从 `backend/.env` 读（见上一节），`app.py` 里不留任何默认密码。其他可选变量：`DB_HOST`、`DB_PORT`、`DB_USER`、`DB_NAME`、`APP_USER_ID`、`PORT`（服务端口，默认 8081），已经设置的环境变量优先于 `.env`。

分析服务没启动时，只有分析屏会显示「读不到分析服务，确认 8081 已启动」和重试按钮，记账、日历都不受影响。

## 启动小程序

1. 微信开发者工具 → 导入项目 → 选择 `miniprogram/` 目录。
2. `project.config.json` 里的 `appid` 目前是 `touristappid`（无 AppID 模式）。有自己的测试号/正式 AppID 时替换即可。
3. 详情 → 本地设置 → 勾选**不校验合法域名**，否则请求不到 `http://localhost:8080`。
4. 后端地址在 `miniprogram/app.js` 的 `globalData.baseUrl`，分析服务在 `globalData.analyticsUrl`，真机预览时都改成局域网 IP 或线上域名（`utils/request.js` 里以 `http(s)://` 开头的地址会直连，不会拼 `baseUrl`）。

## 接口

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/ping` | 健康检查，返回服务器今天 |
| GET | `/api/entries?date=2026-09-28` | 某天的记录，按创建时间倒序 |
| POST | `/api/entries` | 新增，body `{date?, category, content}`，`date` 省略则为服务器当天 |
| PUT | `/api/entries/{id}` | 修改分类或正文 |
| DELETE | `/api/entries/{id}` | 删除 |
| GET | `/api/month?year=2026&month=9` | 月度汇总，日历打点用 |
| GET | `/api/transactions?date=2026-09-28` | 某天收支 + 汇总，返回 `{date, income, expense, balance, items[]}` |
| POST | `/api/transactions` | 记一笔，body `{date?, type, amount, remark?}`，`remark` 留空则写类型名 |
| PUT | `/api/transactions/{id}` | 修改一笔 |
| DELETE | `/api/transactions/{id}` | 删除一笔 |

分析服务（8081，与 Java 侧同样的 `{status, message}` 错误体）：

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/analytics?granularity=week\|month\|year&date=2026-09-28` | 周期汇总 + 环比 + 分桶数据 + 支出构成 TOP5 |

`category` 取值 `WORK`（工作）/ `DIARY`（日记）/ `SECRET`（心事）；`type` 取值 `INCOME`（收入）/ `EXPENSE`（支出）。参数不合法返回 400 并带中文 `message`，正文最长 5000 字，金额必须大于 0 且最多两位小数。

## 底部三个页签

- **今天**：当天日期 + 工作/日记/心事卡片流。
- **收支**：一个页面两屏，手指左右滑或者点顶部的「记账 / 分析」切换。
  - 记账屏：顶部渐变卡显示本日结余/收入/支出，下面是当天流水，点 `+` 弹出记账面板（支出/收入切换、大号金额数字键盘、备注）。点某笔可修改或删除，汇总实时重算。`+` 按钮只在记账屏出现。
  - 分析屏：周 / 月 / 年三个粒度，三格汇总带环比箭头（上期是 0 时显示「较上周新增」，结余直接给差额），下面是纯 CSS 条形图（收入和支出成对，月视图每隔 5 天打一个刻度），再下面是支出构成 TOP5 及占比。首次滑过去才发请求，之后每次滑过去重新拉一次；下拉刷新会同时刷新当前屏。
  - 滑动实现：`.screens` 是 `width: 200%` 的双槽轨道，靠 `translateX` 位移；触摸先做横纵向锁定，只跟手横向，屏边缘有 0.3 阻尼，位移超过屏宽 22%（最多 80px）才翻页。松手时要先把 transition 打开、下一帧再改位移，否则会直接跳过去。
- **日历**：月视图按分类打点，选中任意一天可直接增删改。

页签图标是 `utils/nav-icons.js` 里的内联 SVG（由 `scripts/gen-icons.js` 生成，灰/紫两态）。改图标就改这两个文件，不要再用 CSS 拼形状。

## 收支数据模型

`daily_transaction`：`id / user_id / tx_date / type / amount decimal(12,2) / remark(200) / created_at / updated_at`，`(user_id, tx_date)` 建索引。金额一律服务端 `setScale(2, HALF_UP)`，汇总在 `TxService.byDate` 里累加。

## 关于「心事」

按当前选择，心事只做**隐私标记**，不加密：列表中心事卡片默认折叠成「仅自己可见的心事」，点「显示」才展开正文，数据库里存的是明文。

要改成真正的加密存储，需要补的是：给 `daily_entry` 增加 `iv` 列，写入时用 AES-GCM 加密 `content`（密钥由访问密码经 PBKDF2 派生），查询时解密或直接把密文交给小程序端解。表结构和 `EntryService` 的读写点是唯一的改动位置。

## 数据模型

免登录单用户模式，所有记录挂在 `app.user-id`（默认 1）下。`daily_entry` 字段：`id / user_id / entry_date / category / content(text) / created_at / updated_at`，`(user_id, entry_date)` 建索引。

## 提交与忽略规则

根目录 `.gitignore` 已经按三类产物写好，实测过：

- 构建 / 依赖：`target/`、`node_modules/`、`build/`、`dist/`。
- Python：`backend/.venv`（121MB）、`__pycache__/`、`*.pyc`、各种缓存、`uv.lock`。
- 微信开发者工具：`project.private.config.json`（每人自己的本地覆盖，不提交）；`project.config.json` 是共享配置，要提交。
- IDE：`.idea/`、`*.iml`、`.vscode/` 等。
- 密钥：`.env`、`application-local.yml`。上面两个模板（`.env.example`、`application-local.example.yml`）是提交进仓库的。
- 日志与系统临时文件：`*.log`、`.DS_Store`、`Thumbs.db`、`*.tmp` 等。

`git init` 之后建议先确认一遍再提交：

```bash
git status --short          # 不该出现 target/、.venv/、.env
git check-ignore -v backend/.venv backend/.env backend/src/main/resources/application-local.yml
```
