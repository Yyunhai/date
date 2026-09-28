const { get } = require('../../utils/request');

const GRANULARITIES = [
  { key: 'week', label: '周', scope: '本周', past: '上周' },
  { key: 'month', label: '月', scope: '本月', past: '上月' },
  { key: 'year', label: '年', scope: '本年', past: '去年' }
];

function money(value) {
  return Number(value || 0).toFixed(2);
}

Component({
  properties: {
    date: {
      type: String,
      value: ''
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
    totals: { income: '0.00', expense: '0.00', balance: '0.00' },
    change: { income: '', incomeUp: false, incomeNew: false, expense: '', expenseUp: false, expenseNew: false, balance: '' },
    buckets: [],
    maxLabel: '0.00',
    topExpenses: [],
    recordCount: 0,
    hasData: false
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
      this.setData({ loading: true, failed: false });
      get(analyticsUrl + '/analytics?granularity=' + this.data.granularity + '&date=' + this.data.date)
        .then((res) => {
          this.setData(this.decorate(res));
          this.setData({ loading: false, loaded: true });
        })
        .catch(() => this.setData({ loading: false, failed: true }));
    },

    decorate(res) {
      const meta = GRANULARITIES.find((item) => item.key === res.granularity) || GRANULARITIES[1];
      const max = Number(res.maxBucket) || 0;
      const total = res.totals || {};
      const change = res.change || {};
      const last = res.buckets.length - 1;

      const height = (value) => {
        if (!max || !value) return 0;
        return Math.min(100, Math.max(6, Math.round((Number(value) / max) * 100)));
      };

      const buckets = res.buckets.map((bucket, index) => ({
        label: bucket.label,
        tick: meta.key === 'month' ? (index % 5 === 0 || index === last) : true,
        incomeH: height(bucket.income),
        expenseH: height(bucket.expense),
        has: Number(bucket.income) > 0 || Number(bucket.expense) > 0
      }));

      const delta = (value) => (value === null || value === undefined ? '' : Math.abs(value).toFixed(1) + '%');

      return {
        scopeName: meta.scope,
        pastName: meta.past,
        rangeLabel: res.range.label,
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
        recordCount: res.recordCount,
        hasData: res.recordCount > 0
      };
    }
  }
});
