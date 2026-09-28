const d = require('../miniprogram/utils/date');

let fails = 0;
function eq(actual, expected, label) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) {
    fails++;
    console.log('FAIL ' + label + '\n  got     ' + a + '\n  wanted  ' + e);
  } else {
    console.log('ok   ' + label);
  }
}

function shape(year, month) {
  const cells = d.buildMonthCells(year, month);
  return {
    len: cells.length,
    rows: cells.length / 7,
    first: cells[0].key,
    last: cells[cells.length - 1].key,
    firstReal: cells.find((c) => !c.blank).key
  };
}

eq(shape(2026, 9), { len: 35, rows: 5, first: '2026-08-31', last: '2026-10-04', firstReal: '2026-09-01' }, '2026-09 网格');
eq(shape(2026, 2), { len: 35, rows: 5, first: '2026-01-26', last: '2026-03-01', firstReal: '2026-02-01' }, '2026-02 平月');
eq(shape(2028, 2), { len: 35, rows: 5, first: '2028-01-31', last: '2028-03-05', firstReal: '2028-02-01' }, '2028-02 闰年');
eq(shape(2026, 1), { len: 35, rows: 5, first: '2025-12-29', last: '2026-02-01', firstReal: '2026-01-01' }, '跨年向上');
eq(shape(2026, 12), { len: 35, rows: 5, first: '2026-11-30', last: '2027-01-03', firstReal: '2026-12-01' }, '跨年向下');
eq(d.buildMonthCells(2026, 9).filter((c) => !c.blank).length, 30, '本月格子数');

eq(d.weekdayLabel('2026-09-28'), '星期一', 'weekdayLabel 周一');
eq(d.weekdayLabel('2026-09-27'), '星期日', 'weekdayLabel 周日');
eq(d.fromKey('2026-09-05'), { year: 2026, month: 9, day: 5 }, 'fromKey');
eq(d.toKey(2026, 9, 5), '2026-09-05', 'toKey 补零');
eq(d.friendlyLabel(d.todayKey()), '今天', 'friendlyLabel 今天');
eq(d.friendlyLabel('2026-09-27'), '昨天', 'friendlyLabel 昨天');
eq(d.friendlyLabel('2026-09-26'), '前天', 'friendlyLabel 前天');
eq(d.friendlyLabel('2026-08-03'), '8月3日', 'friendlyLabel 本年');
eq(d.friendlyLabel('2025-08-03'), '2025年8月3日', 'friendlyLabel 跨年');

console.log(fails ? '\n' + fails + ' 个断言失败' : '\n全部通过');
process.exit(fails ? 1 : 0);
