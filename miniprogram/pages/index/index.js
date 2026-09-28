const dateUtil = require('../../utils/date');
const entryActions = require('../../behaviors/entry-actions');

Page({
  behaviors: [entryActions],

  data: {
    dayNum: '',
    monthYear: '',
    weekday: ''
  },

  onLoad() {
    const today = dateUtil.todayKey();
    const { year, month, day } = dateUtil.fromKey(today);
    this.setData({
      date: today,
      dateLabel: '今天',
      dayNum: day,
      monthYear: year + '年' + dateUtil.pad(month) + '月',
      weekday: dateUtil.weekdayLabel(today)
    });
  },

  onShow() {
    this.loadEntries();
  },

  onPullDownRefresh() {
    this.loadEntries();
    setTimeout(() => wx.stopPullDownRefresh(), 600);
  }
});
