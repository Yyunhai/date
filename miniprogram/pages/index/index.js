const dateUtil = require('../../utils/date');
const { get, put } = require('../../utils/request');
const entryActions = require('../../behaviors/entry-actions');

function windowWidth() {
  const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
  return info.windowWidth || 375;
}

function hoursOf(range) {
  return dateUtil.durationLabel(range && range.minutes) || '还没记';
}

function daysOf(range) {
  const days = (range && range.days) || 0;
  return days ? '有记录 ' + days + ' 天' : '还没有记录';
}

Page({
  behaviors: [entryActions],

  data: {
    dayNum: '',
    monthYear: '',
    weekday: '',
    screen: 0,
    winWidth: 375,
    trackX: 0,
    dragging: false,
    workLoading: false,
    workMinutes: 0,
    workText: '还没记',
    workCards: [],
    workShow: false,
    workBusy: false
  },

  onLoad() {
    const today = dateUtil.todayKey();
    const { year, month, day } = dateUtil.fromKey(today);
    this.setData({
      date: today,
      dateLabel: '今天',
      dayNum: day,
      monthYear: year + '年' + dateUtil.pad(month) + '月',
      weekday: dateUtil.weekdayLabel(today),
      winWidth: windowWidth()
    });
  },

  onShow() {
    const bar = this.getTabBar && this.getTabBar();
    if (bar) bar.setData({ active: 'index' });
    // 页面常驻后跨过午夜不会重新 onLoad，这里补一次
    const today = dateUtil.todayKey();
    if (today !== this.data.date) {
      const { year, month, day } = dateUtil.fromKey(today);
      this.setData({
        date: today,
        dateLabel: '今天',
        dayNum: day,
        monthYear: year + '年' + dateUtil.pad(month) + '月',
        weekday: dateUtil.weekdayLabel(today)
      });
    }
    this.loadEntries();
    this.loadWork();
  },

  onPullDownRefresh() {
    this.loadEntries();
    this.loadWork();
    setTimeout(() => wx.stopPullDownRefresh(), 600);
  },

  loadWork() {
    if (this.data.workLoading) return;
    this.setData({ workLoading: true });
    get('/api/work/stats?date=' + this.data.date)
      .then((res) => {
        this.setData({
          workLoading: false,
          workMinutes: (res.today && res.today.minutes) || 0,
          workText: hoursOf(res.today),
          workCards: [
            { key: 'today', label: '今日', text: hoursOf(res.today), sub: this.data.weekday },
            { key: 'week', label: '本周', text: hoursOf(res.week), sub: daysOf(res.week) },
            { key: 'month', label: '本月', text: hoursOf(res.month), sub: daysOf(res.month) },
            { key: 'year', label: '本年', text: hoursOf(res.year), sub: daysOf(res.year) }
          ]
        });
      })
      .catch(() => this.setData({ workLoading: false }));
  },

  openWork() {
    this.setData({ workShow: true });
    this.setBarHidden(true);
  },

  // 四张卡里只有「今日」能改，其余是累加出来的
  onRangeTap(e) {
    if (e.currentTarget.dataset.key === 'today') this.openWork();
  },

  closeWork() {
    this.setData({ workShow: false });
    this.setBarHidden(false);
  },

  onWorkSubmit(e) {
    if (this.data.workBusy) return;
    this.setData({ workBusy: true });
    // 弹层里可以往前翻日期，保存的是选中那天，不一定是今天
    put('/api/work', { date: e.detail.date, minutes: e.detail.minutes })
      .then(() => {
        this.setData({ workBusy: false });
        this.closeWork();
        wx.showToast({ title: '已保存', icon: 'success' });
        this.loadWork();
      })
      .catch(() => this.setData({ workBusy: false }));
  },

  switchScreen(e) {
    const index = Number(e.currentTarget.dataset.index);
    if (index === this.data.screen) return;
    this.goTo(index);
  },

  goTo(index) {
    this.setData({ dragging: false, screen: index, trackX: -index * this.data.winWidth });
  },

  onSwipeStart(e) {
    const touch = e.touches[0];
    this.swipe = { x: touch.clientX, y: touch.clientY, dx: 0, axis: '' };
  },

  onSwipeMove(e) {
    const s = this.swipe;
    if (!s || s.axis === 'y') return;
    const touch = e.touches[0];
    const dx = touch.clientX - s.x;
    const dy = touch.clientY - s.y;
    if (!s.axis) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      s.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
      if (s.axis !== 'x') return;
      // 先关闭 transition，手指才不会拖着一段动画
      this.setData({ dragging: true });
    }
    const atEdge = (this.data.screen === 0 && dx > 0) || (this.data.screen === 1 && dx < 0);
    s.dx = atEdge ? dx * 0.3 : dx;
    this.setData({ trackX: s.dx - this.data.screen * this.data.winWidth });
  },

  onSwipeEnd() {
    const s = this.swipe;
    this.swipe = null;
    if (!s || !this.data.dragging) return;
    let next = this.data.screen;
    const threshold = Math.min(80, this.data.winWidth * 0.22);
    if (s.dx <= -threshold) next = 1;
    else if (s.dx >= threshold) next = 0;
    // 分两步：恢复 transition 之后才改位移，否则松手时会瞬间跳过去
    this.setData({ dragging: false }, () => this.goTo(next));
  }
});
