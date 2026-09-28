const icons = require('../../utils/nav-icons');

Component({
  properties: {
    active: {
      type: String,
      value: 'index'
    }
  },

  data: {
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
      wx.reLaunch({ url });
    }
  }
});
