const { request } = require('./request');
module.exports = {
  login: (username, password) =>
    request('/auth/login', { method: 'POST', data: { username, password, channel: 'miniapp' } }),
  logout: () => request('/auth/logout', { method: 'POST' }),
  listOrders: ({ page, keyword }) =>
    request(`/outbound?page=${page}&pageSize=10&keyword=${encodeURIComponent(keyword)}`),
  getOrder: (id) => request(`/outbound/${encodeURIComponent(id)}`),
};
