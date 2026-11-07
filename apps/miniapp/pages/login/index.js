const api = require('../../utils/api');
Page({
  data: { username: 'owner', password: '', loading: false, error: '' },
  onLoad() {
    if (wx.getStorageSync('session')) wx.reLaunch({ url: '/pages/outbound/index' });
  },
  usernameChanged(event) {
    this.setData({ username: event.detail });
  },
  passwordChanged(event) {
    this.setData({ password: event.detail });
  },
  async submit() {
    if (this.data.loading) return;
    this.setData({ loading: true, error: '' });
    try {
      const result = await api.login(this.data.username, this.data.password);
      if (typeof result.token !== 'string') throw new Error('登录响应缺少会话');
      wx.setStorageSync('session', result.token);
      this.setData({ password: '' });
      wx.reLaunch({ url: '/pages/outbound/index' });
    } catch (error) {
      this.setData({ error: error.message });
      wx.showToast({ title: error.message, icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },
});
