const { get } = require('../../utils/request');
const dateUtil = require('../../utils/date');

const GRANULARITIES = [
  { key: 'week', label: '周', scope: '本周', past: '上周' },
  { key: 'month', label: '月', scope: '本月', past: '上月' },
  { key: 'year', label: '年', scope: '本年', past: '去年' }
];

function money(value) {
  return Number(value || 0).toFixed(2);
}

/** 汇总格子用小数小时：格子窄，写「3 小时 20 分」会挤爆 */
function hoursOf(minutes) {
  return (Number(minutes || 0) / 60).toFixed(1);
}

/** 列表、峰值这种有地方写的用完整读法 */
function duration(minutes) {
  return dateUtil.durationLabel(Number(minutes) || 0);
}

function delta(value) {
  return value === null || value === undefined ? '' : Math.abs(value).toFixed(1) + '%';
}

/** 每个桶的高度：相对峰值缩放，非零桶最低给 6% 才看得见 */
function barHeight(value, max) {
  if (!max || !value) return 0;
  return Math.min(100, Math.max(6, Math.round((Number(value) / max) * 100)));
}

Component({
  properties: {
    date: {
      type: String,
      value: ''
    },
    // tx = 收支，work = 工时；两套指标共用粒度切换、柱状图和状态行
    scope: {
      type: String,
      value: 'tx'
    },
    show: {
      type: Boolean,
      value: false
    }
  },

  data: {
    granularities: GRANULARITIES,
    granularity: 'month',
    scopeName: '本月',
    pastName: '上月',
    loading: false,
    loaded: false,
    failed: false,
    rangeLabel: '',
    countLabel: '',
    totals: { income: '0.00', expense: '0.00', balance: '0.00' },
    change: { income: '', incomeUp: false, incomeNew: false, expense: '', expenseUp: false, expenseNew: false, balance: '' },
    buckets: [],
    maxLabel: '0.00',
    topExpenses: [],
    hasData: false,
    work: {
      total: '0.0',
      avg: '0.0',
      avgNote: '',
      days: 0,
      daysChange: '',
      totalChange: '',
      totalUp: false,
      totalNew: false
    },
    topDays: [],
    split: {
      note: '按周一至周五算，不看节假日',
      workday: { text: '0 小时', days: 0, avg: '', width: 0 },
      weekend: { text: '0 小时', days: 0, avg: '', width: 0 }
    }
  },

  observers: {
    show(show) {
      // 记账屏随时可能新增或删改流水，每次滑到分析屏都重新取一次
      if (show && !this.data.loading) this.load();
    },
    date(value) {
      if (value && this.data.loaded) this.load();
    }
  },

  methods: {
    pickGranularity(e) {
      const key = e.currentTarget.dataset.key;
      if (key === this.data.granularity) return;
      this.setData({ granularity: key });
      this.load();
    },

    reload() {
      this.load();
    },

    load() {
      const { analyticsUrl } = getApp().globalData;
      const path = this.data.scope === 'work' ? '/analytics/work' : '/analytics';
      this.setData({ loading: true, failed: false });
      get(analyticsUrl + path + '?granularity=' + this.data.granularity + '&date=' + this.data.date)
        .then((res) => {
          this.setData(this.decorate(res));
          this.setData({ loading: false, loaded: true });
        })
        .catch(() => this.setData({ loading: false, failed: true }));
    },

    decorate(res) {
      return this.data.scope === 'work' ? this.decorateWork(res) : this.decorateTx(res);
    },

    meta(res) {
      return GRANULARITIES.find((item) => item.key === res.granularity) || GRANULARITIES[1];
    },

    decorateTx(res) {
      const meta = this.meta(res);
      const max = Number(res.maxBucket) || 0;
      const total = res.totals || {};
      const change = res.change || {};
      const last = res.buckets.length - 1;

      const buckets = res.buckets.map((bucket, index) => ({
        label: bucket.label,
        tick: meta.key === 'month' ? (index % 5 === 0 || index === last) : true,
        incomeH: barHeight(bucket.income, max),
        expenseH: barHeight(bucket.expense, max),
        has: Number(bucket.income) > 0 || Number(bucket.expense) > 0
      }));

      return {
        scopeName: meta.scope,
        pastName: meta.past,
        rangeLabel: res.range.label,
        countLabel: res.recordCount + ' 笔记录',
        totals: {
          income: money(total.income),
          expense: money(total.expense),
          balance: money(total.balance)
        },
        change: {
          income: delta(change.income),
          incomeUp: Number(change.income) > 0,
          incomeNew: change.income === null && Number(total.income) > 0,
          expense: delta(change.expense),
          expenseUp: Number(change.expense) > 0,
          expenseNew: change.expense === null && Number(total.expense) > 0,
          balance: (Number(change.balanceDiff) >= 0 ? '+' : '-') + money(Math.abs(Number(change.balanceDiff)))
        },
        buckets,
        maxLabel: money(max),
        topExpenses: (res.topExpenses || []).map((item) => ({
          remark: item.remark,
          total: money(item.total),
          count: item.count,
          share: item.share,
          width: Math.max(4, Math.round(item.share))
        })),
        hasData: res.recordCount > 0
      };
    },

    decorateWork(res) {
      const meta = this.meta(res);
      const max = Number(res.maxBucket) || 0;
      const totals = res.totals || {};
      const previous = res.previousTotals || {};
      const change = res.change || {};
      const last = res.buckets.length - 1;

      const buckets = res.buckets.map((bucket, index) => ({
        label: bucket.label,
        // 月粒度一格一天，刻度只留每 5 天加最后一天，否则字会叠在一起
        tick: meta.key === 'month' ? (index % 5 === 0 || index === last) : true,
        height: barHeight(bucket.minutes, max),
        weekend: bucket.weekend === true
      }));

      const split = res.weekdaySplit || {};
      const workday = split.workday || { minutes: 0, days: 0 };
      const weekend = split.weekend || { minutes: 0, days: 0 };
      const splitMax = Math.max(Number(workday.minutes) || 0, Number(weekend.minutes) || 0);
      const side = (item) => ({
        text: duration(item.minutes) || '0 小时',
        days: item.days,
        avg: item.days ? duration(Math.round(item.minutes / item.days)) || '0 分' : '—',
        width: splitMax ? Math.max(4, Math.round((Number(item.minutes) || 0) / splitMax * 100)) : 0
      });

      const top = res.topDays || [];
      const topMax = top.length ? Number(top[0].minutes) : 0;

      return {
        scopeName: meta.scope,
        pastName: meta.past,
        rangeLabel: res.range.label,
        countLabel: totals.days ? totals.days + ' 天有记录' : '还没有记录',
        buckets,
        maxLabel: duration(max) || '0 小时',
        hasData: Number(totals.minutes) > 0,
        work: {
          total: hoursOf(totals.minutes),
          avg: hoursOf(res.avgPerDay),
          // 本月只走完一半时 elapsedDays 也只算到今天，日均才不会虚低
          avgNote: '按 ' + res.elapsedDays + ' 天平均',
          days: totals.days,
          daysChange: previous.days ? '上期 ' + previous.days + ' 天' : '上期没记',
          totalChange: delta(change.minutes),
          totalUp: Number(change.minutes) > 0,
          totalNew: change.minutes === null && Number(totals.minutes) > 0
        },
        topDays: top.map((item) => ({
          date: item.date,
          label: item.label + ' ' + item.weekday,
          text: duration(item.minutes),
          share: item.share,
          // 条形按第一名归一，不然月粒度里 5% 占比的条几乎看不见
          width: topMax ? Math.max(6, Math.round(Number(item.minutes) / topMax * 100)) : 0
        })),
        split: {
          note: '按周一至周五算，不看节假日',
          workday: side(workday),
          weekend: side(weekend)
        }
      };
    }
  }
});
