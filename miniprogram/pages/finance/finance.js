const dateUtil = require('../../utils/date');
const { get, post, put, del } = require('../../utils/request');

function money(value) {
  return Number(value || 0).toFixed(2);
}

function windowWidth() {
  const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
  return info.windowWidth || 375;
}

Page({
  data: {
    date: '',
    dateLabel: '',
    weekday: '',
    isToday: true,
    items: [],
    income: '0.00',
    expense: '0.00',
    balance: '0.00',
    loading: false,
    sheetShow: false,
    sheetItem: null,
    busy: false,
    screen: 0,
    winWidth: 375,
    trackX: 0,
    dragging: false
  },

  onLoad() {
    const today = dateUtil.todayKey();
    this.setData({
      date: today,
      dateLabel: dateUtil.friendlyLabel(today),
      weekday: dateUtil.weekdayLabel(today),
      isToday: true,
      winWidth: windowWidth()
    });
  },

  setDate(key) {
    if (!key || key === this.data.date) return;
    this.setData({
      date: key,
      dateLabel: dateUtil.friendlyLabel(key),
      weekday: dateUtil.weekdayLabel(key),
      isToday: dateUtil.dayDiffFromToday(key) === 0,
      items: [] // 换天先清空，避免上一天的流水残留
    });
    this.load();
  },

  onPrevDay() {
    this.setDate(dateUtil.shiftDay(this.data.date, -1));
  },

  onNextDay() {
    this.setDate(dateUtil.shiftDay(this.data.date, 1));
  },

  backToday() {
    this.setDate(dateUtil.todayKey());
  },

  onPickDate(e) {
    this.setDate(e.detail.value);
  },

  onShow() {
    const bar = this.getTabBar && this.getTabBar();
    if (bar) bar.setData({ active: 'finance' });
    // 页面常驻后跨过午夜不会重新 onLoad，setDate 自己会发请求
    if (this.data.isToday && dateUtil.todayKey() !== this.data.date) {
      this.setDate(dateUtil.todayKey());
      return;
    }
    this.load();
  },

  onPullDownRefresh() {
    if (this.data.screen === 1) {
      const panel = this.selectComponent('#analysis-panel');
      if (panel) panel.reload();
    }
    this.load();
    setTimeout(() => wx.stopPullDownRefresh(), 600);
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
  },

  load() {
    this.setData({ loading: true });
    get('/api/transactions?date=' + this.data.date)
      .then((res) => {
        const items = (res.items || []).map((item) => ({
          id: item.id,
          type: item.type,
          remark: item.remark,
          amount: item.amount,
          amountText: money(item.amount),
          sign: item.type === 'INCOME' ? '+' : '-',
          time: item.updatedAt ? item.updatedAt.slice(11, 16) : ''
        }));
        this.setData({
          items,
          income: money(res.income),
          expense: money(res.expense),
          balance: money(res.balance),
          loading: false
        });
      })
      .catch(() => this.setData({ loading: false }));
  },

  openAdd() {
    this.showSheet(null);
  },

  onItemTap(e) {
    const item = this.data.items.find((row) => row.id === e.currentTarget.dataset.id);
    if (!item) return;
    this.showSheet(item);
  },

  showSheet(item) {
    this.setData({ sheetItem: item, sheetShow: true });
    this.setBarHidden(true);
  },

  closeSheet() {
    this.setData({ sheetShow: false });
    this.setBarHidden(false);
  },

  setBarHidden(hidden) {
    const bar = this.getTabBar && this.getTabBar();
    if (bar) bar.setData({ barHidden: hidden });
  },

  onSheetSubmit(e) {
    if (this.data.busy) return;
    const { id, type, amount, remark } = e.detail;
    const payload = { date: this.data.date, type, amount, remark };
    this.setData({ busy: true });
    const saving = id ? put('/api/transactions/' + id, payload) : post('/api/transactions', payload);
    saving
      .then(() => {
        this.setData({ busy: false });
        this.closeSheet();
        wx.showToast({ title: '已保存', icon: 'success' });
        this.load();
      })
      .catch(() => this.setData({ busy: false }));
  },

  onSheetDelete() {
    const item = this.data.sheetItem;
    if (!item || this.data.busy) return;
    wx.showModal({
      title: '删除这笔收支',
      content: item.sign + item.amountText + '  ' + item.remark,
      confirmText: '删除',
      confirmColor: '#d9483b',
      success: (res) => {
        if (!res.confirm) return;
        this.setData({ busy: true });
        del('/api/transactions/' + item.id)
          .then(() => {
            this.setData({ busy: false });
            this.closeSheet();
            wx.showToast({ title: '已删除', icon: 'success' });
            this.load();
          })
          .catch(() => this.setData({ busy: false }));
      }
    });
  }
});
