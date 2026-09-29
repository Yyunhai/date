# 日期手账

一个记录工作与生活的微信小程序：打开是当天日期，点 `+` 写下**工作 / 日记**，顺手记工时和收支，日历页回看任意一天。

前后端完全分离，免登录单用户模式。

## 目录结构

```
backend/       Spring Boot 3.3.5 + JPA + MySQL，端口 8080（业务数据读写）
  analysis/    Python FastAPI 分析服务，端口 8081（只读统计，虚拟环境 backend/.venv）
miniprogram/   微信小程序原生代码（WXML / WXSS / JS，无第三方依赖）
scripts/       工具脚本
  test-date.js 日期逻辑断言测试：node scripts/test-date.js
  gen-icons.js 生成 utils/nav-icons.js 里的内联 SVG 图标
```

## 环境要求

| 组件 | 版本 |
| --- | --- |
| JDK | 17 |
| Maven | 3.8.9 |
| MySQL | 8.0（本机 3306） |
| 微信开发者工具 | 任意近期版本 |
| Python | 3.11（仅分析服务需要） |

## 快速开始

### 1. 填数据库密码

仓库不含任何账号密码，两个服务各读一个本地文件，两个文件都已在 `.gitignore` 里：

```bash
cd backend
cp .env.example .env                                          # 分析服务用
cp src/main/resources/application-local.example.yml \
   src/main/resources/application-local.yml                   # Spring Boot 用
```

然后在这两个文件里填上自己的 MySQL 密码。缺文件时的表现：

- 少了 `application-local.yml`：后端启动失败，报 `Access denied for user 'root'@'localhost' (using password: NO)`。
- 少了 `.env`：`python analysis/app.py` 打印缺密码提示后退出。

### 2. 启动后端（8080）

```bash
cd backend
mvn spring-boot:run
```

数据库 `date_app` 和表由程序自动创建（`createDatabaseIfNotExist=true` + `ddl-auto: update`）。`application.yml` 里只放 `${DB_USER}` / `${DB_PASSWORD}` 占位，真实值来自上一步的 `application-local.yml`（通过 `spring.profiles.include: local` 引入），也可以直接用同名环境变量覆盖。

验证：

```bash
curl http://localhost:8080/api/ping
```

### 3. 启动分析服务（8081，可选）

只有收支页的「分析」屏和今天页的工时分析需要它，它只读 `daily_transaction` 和 `daily_work_log`，不做写入。

```bash
cd backend
.venv/Scripts/activate        # 或 source .venv/bin/activate
pip install -r analysis/requirements.txt
python analysis/app.py        # 监听 127.0.0.1:8081
```

密码从 `backend/.env` 读，`app.py` 里不留任何默认密码。可选变量：`DB_HOST`、`DB_PORT`、`DB_USER`、`DB_NAME`、`APP_USER_ID`、`PORT`（默认 8081）；已设置的环境变量优先于 `.env`。

不启动它不影响记账、日历、工时录入和四张工时卡，只有两块分析区域会显示「读不到分析服务，确认 8081 已启动」和重试按钮。

### 4. 启动小程序

1. 微信开发者工具 → 导入项目 → 选择 `miniprogram/` 目录。
2. `project.config.json` 里的 `appid` 目前是 `touristappid`（无 AppID 模式），有测试号 / 正式 AppID 时替换即可。
3. 详情 → 本地设置 → 勾选**不校验合法域名**，否则请求不到 `http://localhost:8080`。
4. 后端地址在 `miniprogram/app.js` 的 `globalData.baseUrl`，分析服务在 `globalData.analyticsUrl`。真机预览时都改成局域网 IP 或线上域名（`utils/request.js` 里以 `http(s)://` 开头的地址会直连，不再拼 `baseUrl`）。

## 功能

底部三个页签由原生 `tabBar` 承载（`app.json` 里 `"custom": true`，样式在 `custom-tab-bar/` 组件中）。切页走 `wx.switchTab`，三个页面常驻内存，切过去先看到上次的数据、后台再静默刷新，不会像 `wx.reLaunch` 那样每次重建页面闪一下骨架屏。

### 今天

一屏记录流 + 二屏工时统计，左右滑动或点底部提示条切换。

- **记录屏**：当天日期 + 一条「今日工时」+ 工作 / 日记卡片流。`+` 或点卡片弹出「记录此刻」，里面只有分类和正文；工时不在记录上。
- **今日工时**：点那一行打开通用弹层 `work-editor`，小时 / 分两个数字输入框（各自卡在 23 / 59），中间实时显示「合计 3 小时 20 分」，右下角「清零」把这天归零。按天存，`daily_work_log` 一天一行，和当天写了几条记录、删没删记录都无关。
  - 弹层右上角日期可往前翻（`‹ ›` 或滚轮 `picker mode="date"`）以补录往期，`end` 卡在今天、未来记不了。换日期时 `GET /api/work?date=...` 把那天已有的工时读回来，否则会把屏幕上今天的数字写到别的日子上；连点只认最后一次响应（回调里比对 `dayKey`）。保存提交 `{date, minutes}`，`date` 是选中的那天。
- **工时屏**：今日 / 本周 / 本月 / 本年四张卡，主数字是累加工时，副行是「有记录 N 天」（今日那张显示星期，点它等同于点记录屏那一行）。本周按周一起算；某一周跨年时后端把查询范围外扩到周界，不漏掉年初 / 年末那几天。进页面拉一次，保存工时后重算，下拉刷新当前屏。
- **工时分析**：工时屏下方复用收支的 `analysis-panel` 组件（`scope="work"`），走 8081 的 `/analytics/work`。周 / 月 / 年三个粒度，锚点跟着今天页的日期走。四块内容：三格汇总（总工时 / 日均 / 有记录天数，带环比箭头）、单柱趋势图（周末那根换橙色；年粒度一格是一整月，不标周末）、最拼的那几天（按时长倒序取 5 天，条形按第一名归一而非按占比，否则最长的那条也只有一格）、工作日 / 周末对比。

**口径**：工时统计放在 Java 侧（不依赖 8081），一次按年区间的查询在内存里按四个区间累加。工时分析的日均分母是 `elapsedDays`（当期已经过去的天数，本月过一半就只按一半算，否则日均永远虚低）；工作日按周一到周五，不看法定节假日；只统计 `minutes > 0` 的天，清零过的日子不算「有记录」。

### 收支

一个页面两屏，手指左右滑或点顶部「记账 / 分析」切换。

- **记账屏**：顶部渐变卡里有日期条（`‹ 今天 ▾ ›`），左右箭头逐天翻，点日期弹 `picker` 跳到任意一天，非今天会出现「回到今天」。翻天之后结余 / 收入 / 支出和流水都是那一天的，`+` 记的就是那一天，往期也能补记、改、删（后端 `PUT` 不会改动记录的日期）。
- **分析屏**：周 / 月 / 年三个粒度，锚点跟着记账屏选的那一天走（选 9 月 20 日时「本月」是 9 月、「本周」是那周的周一到周日）。三格汇总带环比箭头（上期是 0 时显示「较上周新增」，结余直接给差额），下面是纯 CSS 条形图（收入和支出成对，月视图每隔 5 天打一个刻度），再下面是支出构成 TOP5 及占比。首次滑过去才发请求，之后每次滑过去重拉；下拉刷新会同时刷新当前屏。

### 日历

月视图按分类打点，选中任意一天可直接增删改。

## 接口

### 后端（8080）

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/ping` | 健康检查，返回服务器今天 |
| GET | `/api/entries?date=2026-09-28` | 某天的记录，按创建时间倒序 |
| POST | `/api/entries` | 新增，body `{date?, category, content}`，`date` 省略则为服务器当天 |
| PUT | `/api/entries/{id}` | 修改分类或正文（不改动记录的日期） |
| DELETE | `/api/entries/{id}` | 删除 |
| GET | `/api/month?year=2026&month=9` | 月度汇总，日历打点用 |
| GET | `/api/work?date=2026-09-29` | 某天的工作时长，返回 `{date, minutes}`，没记过就是 0 |
| PUT | `/api/work` | 按天写工时，body `{date?, minutes}`，`minutes` 留空或 0 都是清零（同一天只有一行，反复 PUT 覆盖） |
| GET | `/api/work/stats?date=2026-09-29` | 工时汇总，返回 `{today, week, month, year}`，每段是 `{minutes, days}`；`date` 省略则为服务器当天 |
| GET | `/api/transactions?date=2026-09-28` | 某天收支 + 汇总，返回 `{date, income, expense, balance, items[]}` |
| POST | `/api/transactions` | 记一笔，body `{date?, type, amount, remark?}`，`remark` 留空则写类型名 |
| PUT | `/api/transactions/{id}` | 修改一笔 |
| DELETE | `/api/transactions/{id}` | 删除一笔 |

### 分析服务（8081）

与 Java 侧同样的 `{status, message}` 错误体：

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/ping` | 健康检查 |
| GET | `/analytics?granularity=week\|month\|year&date=2026-09-28` | 周期汇总 + 环比 + 分桶数据 + 支出构成 TOP5 |
| GET | `/analytics/work?granularity=week\|month\|year&date=2026-09-28` | 工时口径：总量 / 日均 + 环比 + 分桶数据 + 最拼的几天 + 工作日周末拆分 |

### 取值与校验

- `category`：`WORK`（工作）/ `DIARY`（日记）。
- `type`：`INCOME`（收入）/ `EXPENSE`（支出）。
- 参数不合法返回 400 并带中文 `message`；正文最长 5000 字，金额必须大于 0 且最多两位小数，单日工时 0~1440 分钟。

## 数据模型

免登录单用户模式，所有记录挂在 `app.user-id`（默认 1）下。

| 表 | 字段 | 约束 |
| --- | --- | --- |
| `daily_entry` | `id / user_id / entry_date / category / content(text) / created_at / updated_at` | `(user_id, entry_date)` 索引 |
| `daily_work_log` | `id / user_id / work_date / minutes / created_at / updated_at` | `(user_id, work_date)` 唯一，一天最多一行 |
| `daily_transaction` | `id / user_id / tx_date / type / amount decimal(12,2) / remark(200) / created_at / updated_at` | `(user_id, tx_date)` 索引 |

金额一律服务端 `setScale(2, HALF_UP)`，汇总在 `TxService.byDate` 里累加。

`ddl-auto: update` 只会加表不会删列。早先挂在 `daily_entry` 上的 `duration_minutes` 如果已经建出来会留一个空的孤儿列，想清掉手动执行：

```sql
ALTER TABLE daily_entry DROP COLUMN duration_minutes;
```

## 开发

几个容易踩坑、改动时必须一起处理的地方：

**共用组件 `analysis-panel`** — 收支屏 `scope="tx"`（默认）、今天页工时屏 `scope="work"`。汇总行、趋势图和状态行都按 `scope` 分叉，`decorate()` 走 `decorateTx` / `decorateWork` 两条路。改组件时两个 `scope` 都要过一遍，别只测收支。

**滑动两屏的实现有两份拷贝** — 收支页和今天页各一套，改一处记得同步另一处。`.screens` 是 `width: 200%` 的双槽轨道，靠 `translateX` 位移；触摸先做横纵向锁定、只跟手横向，屏边缘有 0.3 阻尼，位移超过屏宽 22%（最多 80px）才翻页。松手时要先把 transition 打开、下一帧再改位移，否则会直接跳过去。

**底部弹层必须收页签** — 原生 tabBar 不在页面的层级里，页面内的 `z-index: 200` 盖不住它。弹出「记录此刻 / 记一笔 / 工作时长」这类底部弹层时要收起页签：记录弹层统一走 `showSheet()` / `closeSheet()`（内部调 `this.getTabBar().setData({ barHidden })`），工时弹层走今天页的 `openWork()` / `closeWork()`（内部调同一个 `setBarHidden()`）。新增全屏弹层时记得也收，别只 `setData({ xxxShow })`。

**弹层入场不要用 setTimeout 补 class** — 三个弹层组件（`entry-editor` / `tx-editor` / `work-editor`）开场方式一致：`show` 变化时在观察者里一次 `setData({ rendered: true, closing: false })` 把节点挂上，入场位移交给 `@keyframes` + `animation ... both`，关闭才补一个 `closing` class 播退场、240ms 后卸载。退回「先挂载、再 `setTimeout` 补一个 class 触发 `transition`」的写法，会少掉那一帧的可见状态，弹层停在屏幕外，看着像点了没反应。

**图标** — `utils/nav-icons.js` 里的内联 SVG，由 `scripts/gen-icons.js` 生成（灰 / 紫两态）。改图标就改这两个文件，不要再用 CSS 拼形状。

## 测试

```bash
node scripts/test-date.js     # 日期工具逻辑断言
```
