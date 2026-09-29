const CATEGORIES = [
  { key: 'WORK', label: '工作', placeholder: '今天推进了什么？' },
  { key: 'DIARY', label: '日记', placeholder: '今天发生了什么？' }
];

Component({
  properties: {
    show: {
      type: Boolean,
      value: false
    },
    entry: {
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
    categories: CATEGORIES,
    rendered: false,
    closing: false,
    category: 'WORK',
    content: '',
    placeholder: CATEGORIES[0].placeholder,
    isEdit: false
  },

  observers: {
    show(show) {
      clearTimeout(this._hideTimer);
      if (show) {
        this.fill();
        // 挂载即由 CSS 动画滑到位，不再等下一帧补 class
        this.setData({ rendered: true, closing: false });
      } else if (this.data.rendered) {
        this.setData({ closing: true });
        this._hideTimer = setTimeout(() => this.setData({ rendered: false, closing: false }), 240);
      }
    }
  },

  detached() {
    clearTimeout(this._hideTimer);
  },

  methods: {
    fill() {
      const entry = this.data.entry;
      const matched = CATEGORIES.find((item) => item.key === (entry && entry.category)) || CATEGORIES[0];
      this.setData({
        category: matched.key,
        placeholder: matched.placeholder,
        content: entry ? entry.content : '',
        isEdit: !!(entry && entry.id)
      });
    },

    pickCategory(e) {
      const key = e.currentTarget.dataset.key;
      const matched = CATEGORIES.find((item) => item.key === key);
      this.setData({ category: key, placeholder: matched.placeholder });
    },

    onInput(e) {
      this.setData({ content: e.detail.value });
    },

    onSubmit() {
      if (this.data.busy) return;
      const content = this.data.content.trim();
      if (!content) {
        wx.showToast({ title: '写点什么再保存', icon: 'none' });
        return;
      }
      this.triggerEvent('submit', {
        id: this.data.entry ? this.data.entry.id : null,
        category: this.data.category,
        content
      });
    },

    onDelete() {
      this.triggerEvent('delete', { entry: this.data.entry });
    },

    onClose() {
      this.triggerEvent('close');
    },

    noop() {}
  }
});
