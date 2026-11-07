const api = require('../../utils/api');
const { present } = require('../../utils/present');
Page({
  data: { items: [], page: 1, total: 0, keyword: '', loading: false, error: '', hasMore: true },
  onShow() {
    if (!wx.getStorageSync('session')) return wx.reLaunch({ url: '/pages/login/index' });
    this.load(true);
  },
  onPullDownRefresh() {
    this.load(true);
  },
  onReachBottom() {
    if (this.data.hasMore) this.load(false);
  },
  search(event) {
    this.setData({ keyword: event.detail });
    this.load(true);
  },
  retry() {
    this.load(true);
  },
  async load(reset) {
    if (this.data.loading) return;
    const page = reset ? 1 : this.data.page;
    this.setData({ loading: true, error: '' });
    try {
      const result = await api.listOrders({ page, keyword: this.data.keyword });
      if (!Array.isArray(result.items) || typeof result.total !== 'number') throw new Error('列表响应格式不正确');
      const items = reset ? result.items.map(present) : this.data.items.concat(result.items.map(present));
      this.setData({ items, page: page + 1, total: result.total, hasMore: items.length < result.total });
    } catch (error) {
      this.setData({ error: error.message });
      wx.showToast({ title: error.message, icon: 'none' });
    } finally {
      this.setData({ loading: false });
      wx.stopPullDownRefresh();
    }
  },
  open(event) {
    wx.navigateTo({ url: `/pages/detail/index?id=${encodeURIComponent(event.currentTarget.dataset.id)}` });
  },
  logout() {
    wx.showModal({
      title: '退出登录',
      content: '是否退出当前查询账户？',
      success: async (result) => {
        if (!result.confirm) return;
        try {
          await api.logout();
          wx.removeStorageSync('session');
          wx.reLaunch({ url: '/pages/login/index' });
        } catch (error) {
          wx.showToast({ title: error.message, icon: 'none' });
        }
      },
    });
  },
});
