const dateUtil = require('../../utils/date');
const { get } = require('../../utils/request');

/** 只留数字并卡在上限内 */
function clamp(value, max) {
  const digits = String(value).replace(/\D/g, '');
  if (!digits) return '';
  return String(Math.min(Number(digits), max));
}

Component({
  properties: {
    show: {
      type: Boolean,
      value: false
    },
    date: {
      type: String,
      value: ''
    },
    minutes: {
      type: Number,
      value: 0
    },
    busy: {
      type: Boolean,
      value: false
    }
  },

  data: {
    rendered: false,
    closing: false,
    dayKey: '',
    todayKey: '',
    dateLabel: '',
    weekday: '',
    isToday: true,
    hours: '',
    mins: '',
    total: ''
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
      const key = this.data.date || dateUtil.todayKey();
      this.setData({ todayKey: dateUtil.todayKey() });
      this.setDay(key, false);
      this.setDuration(Math.min(Number(this.data.minutes) || 0, 1440));
    },

    /** 换天必须把那天原本的工时读回来，否则会把今天这个数字写到别的日子去 */
    setDay(key, reload) {
      this.setData({
        dayKey: key,
        dateLabel: dateUtil.friendlyLabel(key),
        weekday: dateUtil.weekdayLabel(key),
        isToday: dateUtil.dayDiffFromToday(key) === 0
      });
      if (!reload) return;
      get('/api/work?date=' + key)
        .then((res) => {
          // 连点只认最后一次
          if (this.data.dayKey !== key) return;
          this.setDuration(Math.min(Number(res.minutes) || 0, 1440));
        })
        .catch(() => {});
    },

    onPrevDay() {
      this.setDay(dateUtil.shiftDay(this.data.dayKey, -1), true);
    },

    onNextDay() {
      const next = dateUtil.shiftDay(this.data.dayKey, 1);
      if (next > dateUtil.todayKey()) return;
      this.setDay(next, true);
    },

    backToday() {
      this.setDay(dateUtil.todayKey(), true);
    },

    onPickDate(e) {
      let key = e.detail.value;
      if (key > dateUtil.todayKey()) key = dateUtil.todayKey();
      this.setDay(key, true);
    },

    /** 只在打开、换天和清零时回填两个输入框，打字过程中不动它们，光标才不会跳 */
    setDuration(minutes) {
      this.setData({
        hours: minutes ? String(Math.floor(minutes / 60)) : '',
        mins: minutes % 60 ? String(minutes % 60) : '',
        total: dateUtil.durationLabel(minutes) || '还没记'
      });
    },

    onHours(e) {
      this.setData({ hours: clamp(e.detail.value, 23) });
      this.recount();
    },

    onMins(e) {
      this.setData({ mins: clamp(e.detail.value, 59) });
      this.recount();
    },

    recount() {
      const minutes = (Number(this.data.hours) || 0) * 60 + (Number(this.data.mins) || 0);
      this.setData({ total: dateUtil.durationLabel(minutes) || '还没记' });
    },

    clearDuration() {
      this.setDuration(0);
    },

    onSubmit() {
      if (this.data.busy) return;
      this.triggerEvent('submit', {
        date: this.data.dayKey,
        minutes: (Number(this.data.hours) || 0) * 60 + (Number(this.data.mins) || 0)
      });
    },

    onClose() {
      this.triggerEvent('close');
    },

    noop() {}
  }
});
