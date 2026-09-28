function request(method, url, data) {
  const { baseUrl } = getApp().globalData;
  // 传入完整 http(s) 地址时直连（分析服务在另一个端口）
  const target = /^https?:\/\//.test(url) ? url : baseUrl + url;
  return new Promise((resolve, reject) => {
    wx.request({
      url: target,
      method,
      data,
      header: { 'content-type': 'application/json' },
      success(res) {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data);
          return;
        }
        const message = (res.data && res.data.message) || '请求失败（' + res.statusCode + '）';
        toast(message);
        reject(new Error(message));
      },
      fail() {
        toast('连不上后端，请确认服务已启动');
        reject(new Error('network'));
      }
    });
  });
}

function toast(title) {
  wx.showToast({ title, icon: 'none' });
}

module.exports = {
  get: (url, data) => request('GET', url, data),
  post: (url, data) => request('POST', url, data),
  put: (url, data) => request('PUT', url, data),
  del: (url) => request('DELETE', url),
  toast
};
