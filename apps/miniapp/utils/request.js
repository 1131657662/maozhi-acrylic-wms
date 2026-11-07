const { apiBase } = require('../config');

function request(path, options = {}) {
  return new Promise((resolve, reject) => {
    wx.request({
      url: apiBase + path,
      method: options.method || 'GET',
      data: options.data,
      timeout: 15000,
      header: { 'Content-Type': 'application/json', Authorization: `Bearer ${wx.getStorageSync('session') || ''}` },
      success(response) {
        const body = response.data;
        if (response.statusCode === 401) {
          wx.removeStorageSync('session');
          if (path !== '/auth/login') wx.reLaunch({ url: '/pages/login/index' });
        }
        if (response.statusCode >= 200 && response.statusCode < 300 && body && body.code === 'OK')
          return resolve(body.data);
        const trace = body && body.traceId ? `（${body.traceId.slice(0, 8)}）` : '';
        reject(new Error(((body && body.message) || '服务返回异常') + trace));
      },
      fail() {
        reject(new Error('连接失败或超时，请确认本地 API 已启动后重试'));
      },
    });
  });
}
module.exports = { request };
