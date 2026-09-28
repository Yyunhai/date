const { get, post, put, del } = require('../utils/request');

/**
 * 今天页与日历页共用的记录增删改查逻辑，页面只需提供 data.date / data.dateLabel。
 */
module.exports = Behavior({
  data: {
    date: '',
    dateLabel: '',
    entries: [],
    loading: false,
    sheetShow: false,
    sheetEntry: null,
    busy: false
  },

  methods: {
    loadEntries() {
      if (!this.data.date) return;
      this.setData({ loading: true });
      get('/api/entries?date=' + this.data.date)
        .then((list) => this.setData({ entries: list, loading: false }))
        .catch(() => this.setData({ loading: false }));
    },

    openAdd() {
      this.setData({ sheetEntry: null, sheetShow: true });
    },

    onCardTap(e) {
      this.setData({ sheetEntry: e.detail.entry, sheetShow: true });
    },

    closeSheet() {
      this.setData({ sheetShow: false });
    },

    onSheetSubmit(e) {
      const { id, category, content } = e.detail;
      this.setData({ busy: true });
      const saving = id
        ? put('/api/entries/' + id, { category, content })
        : post('/api/entries', { date: this.data.date, category, content });

      saving
        .then(() => {
          this.setData({ busy: false, sheetShow: false });
          wx.showToast({ title: '已保存', icon: 'success' });
          this.loadEntries();
          if (this.onEntriesChanged) this.onEntriesChanged();
        })
        .catch(() => this.setData({ busy: false }));
    },

    onSheetDelete() {
      if (this.data.busy) return;
      const entry = this.data.sheetEntry;
      if (!entry) return;
      wx.showModal({
        title: '删除这条记录',
        content: '删除后无法恢复',
        confirmText: '删除',
        confirmColor: '#d9483b',
        success: (res) => {
          if (!res.confirm) return;
          this.setData({ busy: true });
          del('/api/entries/' + entry.id)
            .then(() => {
              this.setData({ busy: false, sheetShow: false });
              wx.showToast({ title: '已删除', icon: 'success' });
              this.loadEntries();
              if (this.onEntriesChanged) this.onEntriesChanged();
            })
            .catch(() => this.setData({ busy: false }));
        }
      });
    }
  }
});
