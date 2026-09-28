Component({
  properties: {
    entry: {
      type: Object,
      value: {}
    }
  },

  data: {
    secret: false,
    revealed: false,
    expanded: false,
    clipped: false,
    time: ''
  },

  observers: {
    entry(entry) {
      if (!entry) return;
      const content = entry.content || '';
      this.setData({
        secret: entry.category === 'SECRET',
        revealed: false,
        expanded: false,
        clipped: content.length > 66,
        time: entry.updatedAt ? entry.updatedAt.slice(11, 16) : ''
      });
    }
  },

  methods: {
    onToggleSecret() {
      this.setData({ revealed: !this.data.revealed });
    },

    onToggleExpand() {
      this.setData({ expanded: !this.data.expanded });
    },

    onTap() {
      // 自定义事件名避开原生 tap，原生 tap 会从组件冒泡出去造成重复触发
      this.triggerEvent('select', { entry: this.data.entry });
    }
  }
});
