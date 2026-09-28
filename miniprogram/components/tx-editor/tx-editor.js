Component({
  properties: {
    show: {
      type: Boolean,
      value: false
    },
    item: {
      type: Object,
      value: null
    },
    dateLabel: {
      type: String,
      value: ''
    },
    busy: {
      type: Boolean,
      value: false
    }
  },

  data: {
    rendered: false,
    in: false,
    type: 'EXPENSE',
    amount: '',
    remark: '',
    isEdit: false
  },

  observers: {
    show(show) {
      clearTimeout(this._hideTimer);
      if (show) {
        this.fill();
        this.setData({ rendered: true });
        this._timer = setTimeout(() => this.setData({ in: true }), 20);
      } else if (this.data.rendered) {
        this.setData({ in: false });
        this._hideTimer = setTimeout(() => this.setData({ rendered: false }), 240);
      }
    }
  },

  detached() {
    clearTimeout(this._timer);
    clearTimeout(this._hideTimer);
  },

  methods: {
    fill() {
      const item = this.data.item;
      this.setData({
        type: item ? item.type : 'EXPENSE',
        amount: item ? String(item.amount) : '',
        remark: item && item.remark ? item.remark : '',
        isEdit: !!(item && item.id)
      });
    },

    pickType(e) {
      this.setData({ type: e.currentTarget.dataset.type });
    },

    onAmount(e) {
      let value = e.detail.value.replace(/[^\d.]/g, '');
      const parts = value.split('.');
      value = parts.length > 1 ? parts[0] + '.' + parts.slice(1).join('') : parts[0];
      if (value.indexOf('.') >= 0) {
        const dot = value.indexOf('.');
        value = value.slice(0, dot + 3);
      }
      if (value.length > 13) value = value.slice(0, 13);
      this.setData({ amount: value });
    },

    onRemark(e) {
      this.setData({ remark: e.detail.value });
    },

    onSubmit() {
      if (this.data.busy) return;
      const amount = Number(this.data.amount);
      if (!amount || amount <= 0) {
        wx.showToast({ title: '请填写金额', icon: 'none' });
        return;
      }
      this.triggerEvent('submit', {
        id: this.data.item ? this.data.item.id : null,
        type: this.data.type,
        amount: amount.toFixed(2),
        remark: this.data.remark.trim()
      });
    },

    onDelete() {
      this.triggerEvent('delete', { item: this.data.item });
    },

    onClose() {
      this.triggerEvent('close');
    },

    noop() {}
  }
});
