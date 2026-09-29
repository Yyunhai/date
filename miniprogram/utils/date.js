const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日'];

function pad(n) {
  return n < 10 ? '0' + n : '' + n;
}

function toKey(year, month, day) {
  return year + '-' + pad(month) + '-' + pad(day);
}

/** 本地今天的 yyyy-MM-dd，避免用toISOString 导致跨时区差一天 */
function todayKey() {
  const now = new Date();
  return toKey(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

function fromKey(key) {
  const parts = String(key).split('-');
  return { year: Number(parts[0]), month: Number(parts[1]), day: Number(parts[2]) };
}

function weekdayLabel(key) {
  const { year, month, day } = fromKey(key);
  return '星期' + WEEKDAYS[(new Date(year, month - 1, day).getDay() + 6) % 7];
}

/** 按天偏移，交给 Date 处理跨月、跨年、闰年 */
function shiftDay(key, delta) {
  const { year, month, day } = fromKey(key);
  const moved = new Date(year, month - 1, day + delta);
  return toKey(moved.getFullYear(), moved.getMonth() + 1, moved.getDate());
}

function dayDiffFromToday(key) {
  const { year, month, day } = fromKey(key);
  const target = new Date(year, month - 1, day);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((target - today) / 86400000);
}

/** 今天 / 昨天 / 2026年9月26日 星期五 */
function friendlyLabel(key) {
  const diff = dayDiffFromToday(key);
  if (diff === 0) return '今天';
  if (diff === -1) return '昨天';
  if (diff === -2) return '前天';
  const { year, month, day } = fromKey(key);
  if (diff === 1) return '明天';
  const now = new Date();
  if (year === now.getFullYear()) return month + '月' + day + '日';
  return year + '年' + month + '月' + day + '日';
}

/** 周一为每行起点，补齐前后月份日期，返回扁平格子数组 */
function buildMonthCells(year, month) {
  const firstWeekday = (new Date(year, month - 1, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month, 0).getDate();
  const prevMonthDays = new Date(year, month - 1, 0).getDate();
  const cells = [];

  for (let i = firstWeekday - 1; i >= 0; i--) {
    const day = prevMonthDays - i;
    const m = month === 1 ? 12 : month - 1;
    const y = month === 1 ? year - 1 : year;
    cells.push({ key: toKey(y, m, day), day, blank: true });
  }
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push({ key: toKey(year, month, day), day, blank: false });
  }
  let tail = 1;
  while (cells.length % 7 !== 0) {
    const m = month === 12 ? 1 : month + 1;
    const y = month === 12 ? year + 1 : year;
    cells.push({ key: toKey(y, m, tail), day: tail, blank: true });
    tail++;
  }
  return cells;
}

/** 200 -> 3 小时 20 分，40 -> 40 分，空或 0 返回空串 */
function durationLabel(minutes) {
  const total = Math.floor(Number(minutes) || 0);
  if (total <= 0) return '';
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (!h) return m + ' 分';
  if (!m) return h + ' 小时';
  return h + ' 小时 ' + m + ' 分';
}

module.exports = {
  WEEKDAYS,
  pad,
  todayKey,
  fromKey,
  toKey,
  shiftDay,
  weekdayLabel,
  friendlyLabel,
  dayDiffFromToday,
  durationLabel,
  buildMonthCells
};
