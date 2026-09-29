"""收支分析微服务：读同一个 MySQL，按年 / 月 / 周做聚合，供小程序右屏使用。
"""

import os
from datetime import date, datetime, timedelta
from decimal import Decimal

import pandas as pd
import pymysql
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse


def load_dotenv(path: str) -> None:
    if not os.path.exists(path):
        return
    with open(path, encoding="utf-8") as handle:
        for line in handle:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            os.environ.setdefault(key.strip(), value.strip().strip("'").strip('"'))


load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env"))

if not os.getenv("DB_PASSWORD"):
    raise SystemExit("缺少数据库密码：复制 backend/.env.example 为 backend/.env 并填上 DB_PASSWORD")

DB = {
    "host": os.getenv("DB_HOST", "127.0.0.1"),
    "port": int(os.getenv("DB_PORT", "3306")),
    "user": os.getenv("DB_USER", "root"),
    "password": os.getenv("DB_PASSWORD", ""),
    "database": os.getenv("DB_NAME", "date_app"),
    "charset": "utf8mb4",
    "cursorclass": pymysql.cursors.DictCursor,
}

# 免登录单用户，和 Java 侧 app.user-id 保持一致
USER_ID = int(os.getenv("APP_USER_ID", "1"))

GRANULARITIES = ("week", "month", "year")
WEEK_NAMES = ["一", "二", "三", "四", "五", "六", "日"]

app = FastAPI(title="date-analytics")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET"],
    allow_headers=["*"],
)


def money(value) -> float:
    return round(float(value or 0), 2)


def connect():
    return pymysql.connect(**DB)


def shift(anchor: date, granularity: str, step: int) -> date:
    """把 anchor 往前（step=-1）或往后（step=1）挪一个同长度周期。"""
    if granularity == "week":
        return anchor + timedelta(days=7 * step)
    if granularity == "year":
        return anchor.replace(year=anchor.year + step)
    month_index = anchor.year * 12 + (anchor.month - 1) + step
    year, month = divmod(month_index, 12)
    return anchor.replace(year=year, month=month + 1, day=1)


def period(anchor: date, granularity: str):
    """返回该周期的 (start, end, label)。"""
    if granularity == "week":
        start = anchor - timedelta(days=anchor.weekday())
        end = start + timedelta(days=6)
        return start, end, "{} 第 {} 周".format(start.year, start.isocalendar()[1])
    if granularity == "year":
        return date(anchor.year, 1, 1), date(anchor.year, 12, 31), "{} 年".format(anchor.year)
    start = date(anchor.year, anchor.month, 1)
    end = date(anchor.year + (anchor.month == 12), 1 if anchor.month == 12 else anchor.month + 1, 1) - timedelta(days=1)
    return start, end, "{} 年 {} 月".format(anchor.year, anchor.month)


def bucket_keys(start: date, end: date, granularity: str):
    """周期内的每个桶：周=7 天，月=每天，年=12 个月。"""
    if granularity == "year":
        return [
            {
                "label": "{}月".format(month),
                "start": date(start.year, month, 1),
                "end": (date(start.year + (month == 12), 1 if month == 12 else month + 1, 1) - timedelta(days=1)),
            }
            for month in range(1, 13)
        ]
    buckets = []
    day = start
    while day <= end:
        if granularity == "week":
            label = "周" + WEEK_NAMES[day.weekday()]
        else:
            label = str(day.day)
        buckets.append({"label": label, "start": day, "end": day, "sub": "{}.{}".format(day.month, day.day)})
        day += timedelta(days=1)
    return buckets


def fetch(start: date, end: date) -> pd.DataFrame:
    sql = (
        "SELECT tx_date, type, amount, remark FROM daily_transaction "
        "WHERE user_id = %s AND tx_date BETWEEN %s AND %s"
    )
    with connect() as conn:
        with conn.cursor() as cursor:
            cursor.execute(sql, (USER_ID, start.isoformat(), end.isoformat()))
            rows = cursor.fetchall()
    frame = pd.DataFrame(rows, columns=["tx_date", "type", "amount", "remark"])
    if frame.empty:
        return frame
    frame["tx_date"] = pd.to_datetime(frame["tx_date"]).dt.date
    frame["amount"] = frame["amount"].map(lambda value: float(value) if isinstance(value, Decimal) else float(value))
    return frame


def sums(frame: pd.DataFrame, start: date, end: date):
    if frame.empty:
        return {"income": 0.0, "expense": 0.0, "balance": 0.0}
    window = frame[(frame["tx_date"] >= start) & (frame["tx_date"] <= end)]
    if window.empty:
        return {"income": 0.0, "expense": 0.0, "balance": 0.0}
    grouped = window.groupby("type")["amount"].sum().to_dict()
    income = float(grouped.get("INCOME", 0.0))
    expense = float(grouped.get("EXPENSE", 0.0))
    return {"income": money(income), "expense": money(expense), "balance": money(income - expense)}


def change_pct(current: float, previous: float):
    """上期为 0 或为负时百分比没有意义，交给前端显示为「新增」。"""
    if previous <= 0:
        return None
    return round((current - previous) / previous * 100, 1)


def top_expenses(frame: pd.DataFrame, start: date, end: date, total_expense: float):
    if frame.empty or total_expense <= 0:
        return []
    window = frame[(frame["tx_date"] >= start) & (frame["tx_date"] <= end) & (frame["type"] == "EXPENSE")]
    if window.empty:
        return []
    grouped = (
        window.groupby("remark")
        .agg(total=("amount", "sum"), count=("amount", "size"))
        .sort_values("total", ascending=False)
        .head(5)
    )
    return [
        {
            "remark": remark,
            "total": money(row["total"]),
            "count": int(row["count"]),
            "share": round(float(row["total"]) / total_expense * 100, 1),
        }
        for remark, row in grouped.iterrows()
    ]


@app.exception_handler(HTTPException)
async def http_error(request, exc: HTTPException):
    # 和 Java 侧 GlobalExceptionHandler 保持同一种错误体，小程序只认 message
    return JSONResponse(status_code=exc.status_code, content={"status": exc.status_code, "message": exc.detail})


def parse_anchor(date_str: str, granularity: str) -> date:
    if granularity not in GRANULARITIES:
        raise HTTPException(status_code=400, detail="未知的分析粒度: " + granularity)
    try:
        return datetime.strptime(date_str, "%Y-%m-%d").date() if date_str else date.today()
    except ValueError:
        raise HTTPException(status_code=400, detail="日期格式应为 YYYY-MM-DD")


@app.get("/ping")
def ping():
    return {"status": "ok", "service": "date-analytics"}


@app.get("/analytics")
def analytics(
    date_str: str = Query(default="", alias="date"),
    granularity: str = Query(default="month"),
):
    anchor = parse_anchor(date_str, granularity)
    start, end, label = period(anchor, granularity)
    prev_anchor = shift(anchor, granularity, -1)
    prev_start, prev_end, prev_label = period(prev_anchor, granularity)

    frame = fetch(prev_start, end)
    totals = sums(frame, start, end)
    previous = sums(frame, prev_start, prev_end)

    buckets = []
    for bucket in bucket_keys(start, end, granularity):
        values = sums(frame, bucket["start"], bucket["end"])
        buckets.append(
            {
                "label": bucket["label"],
                "sub": bucket.get("sub", ""),
                "income": values["income"],
                "expense": values["expense"],
                "balance": values["balance"],
            }
        )

    return {
        "granularity": granularity,
        "anchor": anchor.isoformat(),
        "range": {"start": start.isoformat(), "end": end.isoformat(), "label": label},
        "previousRange": {"start": prev_start.isoformat(), "end": prev_end.isoformat(), "label": prev_label},
        "totals": totals,
        "previousTotals": previous,
        "change": {
            "income": change_pct(totals["income"], previous["income"]),
            "expense": change_pct(totals["expense"], previous["expense"]),
            "balanceDiff": money(totals["balance"] - previous["balance"]),
        },
        "buckets": buckets,
        "maxBucket": max([max(b["income"], b["expense"]) for b in buckets] or [0]) or 0.0,
        "topExpenses": top_expenses(frame, start, end, totals["expense"]),
        "recordCount": 0 if frame.empty else int(
            ((frame["tx_date"] >= start) & (frame["tx_date"] <= end)).sum()
        ),
    }


def fetch_work(start: date, end: date) -> pd.DataFrame:
    sql = (
        "SELECT work_date, minutes FROM daily_work_log "
        "WHERE user_id = %s AND work_date BETWEEN %s AND %s"
    )
    with connect() as conn:
        with conn.cursor() as cursor:
            cursor.execute(sql, (USER_ID, start.isoformat(), end.isoformat()))
            rows = cursor.fetchall()
    frame = pd.DataFrame(rows, columns=["work_date", "minutes"])
    if frame.empty:
        return frame
    frame["work_date"] = pd.to_datetime(frame["work_date"]).dt.date
    frame["minutes"] = frame["minutes"].map(lambda value: int(value or 0))
    return frame


def work_slice(frame: pd.DataFrame, start: date, end: date) -> pd.DataFrame:
    if frame.empty:
        return frame
    return frame[(frame["work_date"] >= start) & (frame["work_date"] <= end)]


def work_totals(frame: pd.DataFrame, start: date, end: date):
    window = work_slice(frame, start, end)
    if window.empty:
        return {"minutes": 0, "days": 0}
    recorded = window[window["minutes"] > 0]
    return {"minutes": int(recorded["minutes"].sum()), "days": int(len(recorded))}


def elapsed_days(start: date, end: date) -> int:
    """当期还没走完时，日均只按已经过去的天数算，否则本月日均永远偏低。"""
    return max(1, (min(end, date.today()) - start).days + 1)


def work_buckets(frame: pd.DataFrame, start: date, end: date, granularity: str):
    buckets = []
    for bucket in bucket_keys(start, end, granularity):
        window = work_slice(frame, bucket["start"], bucket["end"])
        minutes = int(window["minutes"].sum()) if not window.empty else 0
        buckets.append(
            {
                "label": bucket["label"],
                "sub": bucket.get("sub", ""),
                "minutes": minutes,
                # 年粒度时一格是一整月，再标周末没有意义
                "weekend": None if granularity == "year" else bucket["start"].weekday() >= 5,
            }
        )
    return buckets


def top_work_days(frame: pd.DataFrame, start: date, end: date, limit: int = 5):
    window = work_slice(frame, start, end)
    if not window.empty:
        window = window[window["minutes"] > 0]
    if window.empty:
        return []
    total = int(window["minutes"].sum())
    top = window.sort_values(["minutes", "work_date"], ascending=[False, False]).head(limit)
    return [
        {
            "date": row["work_date"].isoformat(),
            "label": "{}月{}日".format(row["work_date"].month, row["work_date"].day),
            "weekday": "周" + WEEK_NAMES[row["work_date"].weekday()],
            "minutes": int(row["minutes"]),
            "share": round(int(row["minutes"]) / total * 100, 1) if total else 0.0,
        }
        for _, row in top.iterrows()
    ]


def weekday_split(frame: pd.DataFrame, start: date, end: date):
    """工作日 = 周一到周五，按自然周而不是法定节假日。"""
    window = work_slice(frame, start, end)
    result = {}
    for key, weekend in (("workday", False), ("weekend", True)):
        if window.empty:
            result[key] = {"minutes": 0, "days": 0}
            continue
        part = window[
            (window["work_date"].map(lambda day: day.weekday() >= 5) == weekend)
            & (window["minutes"] > 0)
        ]
        result[key] = {"minutes": int(part["minutes"].sum()), "days": int(len(part))}
    return result


@app.get("/analytics/work")
def analytics_work(
    date_str: str = Query(default="", alias="date"),
    granularity: str = Query(default="month"),
):
    anchor = parse_anchor(date_str, granularity)

    start, end, label = period(anchor, granularity)
    prev_anchor = shift(anchor, granularity, -1)
    prev_start, prev_end, prev_label = period(prev_anchor, granularity)

    frame = fetch_work(prev_start, end)
    totals = work_totals(frame, start, end)
    previous = work_totals(frame, prev_start, prev_end)

    days = elapsed_days(start, end)
    avg = int(round(totals["minutes"] / days))
    prev_avg = int(round(previous["minutes"] / ((prev_end - prev_start).days + 1)))
    buckets = work_buckets(frame, start, end, granularity)

    return {
        "granularity": granularity,
        "anchor": anchor.isoformat(),
        "range": {"start": start.isoformat(), "end": end.isoformat(), "label": label},
        "previousRange": {"start": prev_start.isoformat(), "end": prev_end.isoformat(), "label": prev_label},
        "totals": totals,
        "previousTotals": previous,
        "avgPerDay": avg,
        "elapsedDays": days,
        "change": {
            "minutes": change_pct(totals["minutes"], previous["minutes"]),
            "avg": change_pct(avg, prev_avg),
        },
        "buckets": buckets,
        "maxBucket": max([b["minutes"] for b in buckets] or [0]) or 0,
        "topDays": top_work_days(frame, start, end),
        "weekdaySplit": weekday_split(frame, start, end),
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="127.0.0.1", port=int(os.getenv("PORT", "8081")))
