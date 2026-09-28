const dateUtil = require('../../utils/date');
const { get } = require('../../utils/request');
const entryActions = require('../../behaviors/entry-actions');

Page({
  behaviors: [entryActions],

  data: {
    year: 0,
    month: 0,
    monthLabel: '',
    weekdays: dateUtil.WEEKDAYS,
    cells: [],
    selected: '',
    selectedLabel: ''
  },

  onLoad() {
    const now = new Date();
    const today = dateUtil.todayKey();
    this.stats = {};
    this.setData({
      year: now.getFullYear(),
      month: now.getMonth() + 1,
      selected: today,
      date: today
    });
    this.paint();
  },

  onShow() {
    this.loadMonth();
    this.loadEntries();
  },

  onEntriesChanged() {
    this.loadMonth();
  },

  loadMonth() {
    const { year, month } = this.data;
    get('/api/month?year=' + year + '&month=' + month)
      .then((list) => {
        this.stats = {};
        list.forEach((stat) => {
          this.stats[stat.date] = stat;
        });
        this.paint();
      })
      .catch(() => {});
  },

  paint() {
    const { year, month, selected } = this.data;
    const today = dateUtil.todayKey();
    const cells = dateUtil.buildMonthCells(year, month).map((cell) => {
      const stat = this.stats[cell.key];
      const marks = [];
      if (stat) {
        if (stat.work) marks.push('WORK');
        if (stat.diary) marks.push('DIARY');
        if (stat.secret) marks.push('SECRET');
      }
      return Object.assign({}, cell, {
        marks,
        isToday: cell.key === today,
        isSel: cell.key === selected
      });
    });

    const selectedLabel = dateUtil.friendlyLabel(selected);
    this.setData({
      cells,
      monthLabel: year + ' 年 ' + month + ' 月',
      selectedLabel,
      dateLabel: selectedLabel + ' · ' + dateUtil.weekdayLabel(selected)
    });
  },

  onSelect(e) {
    const key = e.currentTarget.dataset.key;
    const day = dateUtil.fromKey(key);
    // 灰显的跨月格子不可选
    if (day.year !== this.data.year || day.month !== this.data.month) return;
    if (key === this.data.selected) return;
    this.setData({ selected: key, date: key, entries: [] });
    this.paint();
    this.loadEntries();
  },

  onPrevMonth() {
    this.shift(-1);
  },

  onNextMonth() {
    this.shift(1);
  },

  shift(step) {
    let { year, month } = this.data;
    month += step;
    if (month < 1) {
      month = 12;
      year -= 1;
    } else if (month > 12) {
      month = 1;
      year += 1;
    }
    const first = dateUtil.toKey(year, month, 1);
    const lastDay = new Date(year, month, 0).getDate();
    const last = dateUtil.toKey(year, month, lastDay);
    this.setData({ year, month, cells: [] });
    this.loadMonth();
    // 切换月份后如果选中的日期不在本月，跳到本月首日
    if (this.data.selected < first || this.data.selected > last) {
      this.setData({ selected: first, date: first, entries: [] });
      this.paint();
      this.loadEntries();
    }
  },

  backToday() {
    const today = dateUtil.todayKey();
    const { year, month } = dateUtil.fromKey(today);
    const changed = year !== this.data.year || month !== this.data.month || today !== this.data.selected;
    this.setData({ year, month, selected: today, date: today, entries: [] });
    this.paint();
    if (changed) {
      this.loadMonth();
      this.loadEntries();
    }
  }
});
