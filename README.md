# 日期手账

微信小程序 + Spring Boot 后端 + MySQL。打开显示当天日期，点 `+` 记录当天的**工作 / 日记**，日历页可回看任意一天。前后端完全分离。

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

分析服务没启动时，只有两处分析块（收支屏分析、今天页工时分析）会显示「读不到分析服务，确认 8081 已启动」和重试按钮，记账、日历、工时录入和四张工时卡都不受影响。

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
| PUT | `/api/entries/{id}` | 修改分类或正文（不会改动记录的日期） |
| DELETE | `/api/entries/{id}` | 删除 |
| GET | `/api/month?year=2026&month=9` | 月度汇总，日历打点用 |
| GET | `/api/work?date=2026-09-29` | 某天的工作时长，返回 `{date, minutes}`，没记过就是 0 |
| PUT | `/api/work` | 按天写工时，body `{date?, minutes}`，`minutes` 留空或 0 都是清零（同一天只有一行，反复 PUT 覆盖） |
| GET | `/api/work/stats?date=2026-09-29` | 工作时长汇总，返回 `{today, week, month, year}`，每段是 `{minutes, days}`；`date` 省略则为服务器当天 |
| GET | `/api/transactions?date=2026-09-28` | 某天收支 + 汇总，返回 `{date, income, expense, balance, items[]}` |
| POST | `/api/transactions` | 记一笔，body `{date?, type, amount, remark?}`，`remark` 留空则写类型名 |
| PUT | `/api/transactions/{id}` | 修改一笔 |
| DELETE | `/api/transactions/{id}` | 删除一笔 |

分析服务（8081，与 Java 侧同样的 `{status, message}` 错误体）：

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/analytics?granularity=week\|month\|year&date=2026-09-28` | 周期汇总 + 环比 + 分桶数据 + 支出构成 TOP5 |
| GET | `/analytics/work?granularity=week\|month\|year&date=2026-09-28` | 工时口径：总量 / 日均 + 环比 + 分桶数据 + 最拼的几天 + 工作日周末拆分 |

`category` 取值 `WORK`（工作）/ `DIARY`（日记）；`type` 取值 `INCOME`（收入）/ `EXPENSE`（支出）。参数不合法返回 400 并带中文 `message`，正文最长 5000 字，金额必须大于 0 且最多两位小数，单日工时 0~1440 分钟。

## 底部三个页签

- **今天**：一屏记录流 + 二屏工时统计，左滑或点底部提示条切换。
  - 记录屏：当天日期 + 一条「今日工时」+ 工作/日记卡片流。`+` 或点卡片弹出「记录此刻」，里面只有分类和正文；工时不在这条记录上。
  - 今日工时那一行点开通用弹层 `work-editor`，小时 / 分两个 `type="number"` 输入框（各自卡在 23 / 59），中间实时显示「合计 3 小时 20 分」，右下角「清零」把这天归零。按天存，`daily_work_log` 一天一行，和当天写了几条记录、删没删记录都没关系。
  - 弹层右上角的日期可以往前翻（`‹ ›` 或滚轮 `picker mode="date"`），用来补录往期某一天；`end` 卡在今天，未来记不了。换日期时会 `GET /api/work?date=...` 把那天已有的工时读回来，否则会把屏幕上今天的数字写到别的日子上；连点只认最后一次响应（回调里比对 `dayKey`）。保存时提交 `{date, minutes}`，`date` 是选中的那天，不一定是今天。
  - 工时屏：今日 / 本周 / 本月 / 本年四张卡，主数字是累加工时，副行是「有记录 N 天」（今日那张显示星期，点它等同于点记录屏那一行）。本周按周一起算；某一周跨年时，后端把查询范围外扩到周界，不会漏掉年初/年末那几天。进页面就拉一次，保存工时后重算，下拉刷新当前屏。
  - 工时统计放在 Java 侧（不依赖 8081 分析服务）：一次按年区间的查询，在内存里按四个区间累加。
  - 工时分析：工时屏下方复用收支那个 `analysis-panel` 组件，传 `scope="work"`，走 8081 的 `/analytics/work`。周 / 月 / 年三个粒度、锚点跟着今天页的日期走，和记账屏那套一致。四块内容：三格汇总（总工时 / 日均 / 有记录天数，带环比箭头）、单柱趋势图（周末那根换橙色，年粒度一格是一整月所以不标周末）、最拼的那几天（按时长倒序取 5 天，条形长度按第一名归一而不是按占比，否则最长的那条也只有一格）、工作日 / 周末对比。
  - 工时分析的口径：日均分母是 `elapsedDays`（当期已经过去的天数，本月过一半就只按一半算，不然日均永远虚低）；工作日按周一到周五，不看法定节假日；只统计 `minutes > 0` 的天，清零过的日子不算「有记录」。
  - 这块和收支分析屏共用一个组件，改 `analysis-panel` 要同时看两个 scope；8081 没启动时工时屏上半部分（今日 / 本周 / 本月 / 本年四张卡）照常，只有下面这块显示「读不到分析服务，确认 8081 已启动」。
- **收支**：一个页面两屏，手指左右滑或者点顶部的「记账 / 分析」切换。
  - 记账屏：顶部渐变卡里有一个日期条（`‹ 今天 ▾ ›`），左右箭头逐天翻，点日期弹 `picker` 直接跳到任意一天，非今天会出现「回到今天」。翻天之后结余/收入/支出和流水都是那一天的，`+` 记的就是那一天，往期也能补记、改、删（后端 `PUT` 不会改动记录的日期）。
  - 分析屏：周 / 月 / 年三个粒度，锚点跟着记账屏选的那一天走（选 9 月 20 日时，「本月」是 9 月、「本周」是那周的周一到周日）。三格汇总带环比箭头（上期是 0 时显示「较上周新增」，结余直接给差额），下面是纯 CSS 条形图（收入和支出成对，月视图每隔 5 天打一个刻度），再下面是支出构成 TOP5 及占比。首次滑过去才发请求，之后每次滑过去重新拉一次；下拉刷新会同时刷新当前屏。
  - `analysis-panel` 现在是两个页面共用的：收支屏 `scope="tx"`（默认），今天页工时屏 `scope="work"`。汇总行、趋势图和状态行都按 `scope` 分叉，`decorate()` 走 `decorateTx` / `decorateWork` 两条路；改组件时两个 `scope` 都要过一遍，别只测收支。分析服务没起来时两边都显示「读不到分析服务，确认 8081 已启动」。
  - 滑动实现：`.screens` 是 `width: 200%` 的双槽轨道，靠 `translateX` 位移；触摸先做横纵向锁定，只跟手横向，屏边缘有 0.3 阻尼，位移超过屏宽 22%（最多 80px）才翻页。松手时要先把 transition 打开、下一帧再改位移，否则会直接跳过去。今天页的两屏是这套逻辑的第二份拷贝，改一处记得同步另一处。
- **日历**：月视图按分类打点，选中任意一天可直接增删改。

页签是原生 `tabBar`（`app.json` 里 `"custom": true`），样式写在 `custom-tab-bar/` 组件中。切页走 `wx.switchTab`，三个页面都常驻内存，切过去先看到上一次的数据、后台再静默刷新，不会像 `wx.reLaunch` 那样每次重建页面、每次都闪一下骨架屏。

原生 tabBar 不在页面的层级里，页面内的 `z-index: 200` 弹层盖不住它，所以弹出「记录此刻 / 记一笔 / 工作时长」这类底部弹层时必须把页签收起来：记录弹层统一走 `showSheet()` / `closeSheet()`，里面调 `this.getTabBar().setData({ barHidden })`；工时弹层走今天页的 `openWork()` / `closeWork()`，调的是同一个 `setBarHidden()`。新增全屏弹层记得也收页签，别只 `setData({ xxxShow })`。

三个弹层组件（`entry-editor` / `tx-editor` / `work-editor`）的开场方式是一样的：`show` 变化时在观察者里一次 `setData({ rendered: true, closing: false })` 把节点挂上，入场位移交给 `@keyframes` + `animation ... both`，关闭才补一个 `closing` class 播退场、240ms 后卸载。不要退回「先挂载、再 `setTimeout` 补一个 class 触发 `transition`」那种写法——少掉那一帧的可见状态，弹层就会停在屏幕外，看着像点了没反应。

图标是 `utils/nav-icons.js` 里的内联 SVG（由 `scripts/gen-icons.js` 生成，灰/紫两态）。改图标就改这两个文件，不要再用 CSS 拼形状。

## 收支数据模型

`daily_transaction`：`id / user_id / tx_date / type / amount decimal(12,2) / remark(200) / created_at / updated_at`，`(user_id, tx_date)` 建索引。金额一律服务端 `setScale(2, HALF_UP)`，汇总在 `TxService.byDate` 里累加。

## 数据模型

免登录单用户模式，所有记录挂在 `app.user-id`（默认 1）下。`daily_entry` 字段：`id / user_id / entry_date / category / content(text) / created_at / updated_at`，`(user_id, entry_date)` 建索引。

工时单独一张表 `daily_work_log`：`id / user_id / work_date / minutes / created_at / updated_at`，`(user_id, work_date)` 建唯一约束，一天最多一行。`ddl-auto: update` 只会加表不会删列，早先挂在 `daily_entry` 上的 `duration_minutes` 如果已经建出来了会留一个空的孤儿列，想清掉就手动执行 `ALTER TABLE daily_entry DROP COLUMN duration_minutes;`。
