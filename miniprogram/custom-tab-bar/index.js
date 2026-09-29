const icons = require('../utils/nav-icons');

Component({
  data: {
    active: 'index',
    barHidden: false,
    items: [
      { page: 'index', url: '/pages/index/index', label: '今天', off: icons.todayOff, on: icons.todayOn },
      { page: 'finance', url: '/pages/finance/finance', label: '收支', off: icons.moneyOff, on: icons.moneyOn },
      { page: 'calendar', url: '/pages/calendar/calendar', label: '日历', off: icons.gridOff, on: icons.gridOn }
    ]
  },

  methods: {
    onGo(e) {
      const { page, url } = e.currentTarget.dataset;
      if (page === this.data.active) return;
      // switchTab 不会销毁页面，切回来时旧数据直接可见
      wx.switchTab({ url });
    }
  }
});
