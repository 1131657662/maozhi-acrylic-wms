const api = require('../../utils/api');
const { present } = require('../../utils/present');
Page({
  data: { id: '', order: null, loading: false, error: '' },
  onLoad(options) {
    this.setData({ id: options.id || '' });
    this.load();
  },
  onPullDownRefresh() {
    this.load();
  },
  async load() {
    if (this.data.loading) return;
    this.setData({ loading: true, error: '' });
    try {
      const order = await api.getOrder(this.data.id);
      if (!order.id || !Array.isArray(order.lines)) throw new Error('详情响应格式不正确');
      this.setData({ order: present(order) });
    } catch (error) {
      this.setData({ error: error.message });
      wx.showToast({ title: error.message, icon: 'none' });
    } finally {
      this.setData({ loading: false });
      wx.stopPullDownRefresh();
    }
  },
});
