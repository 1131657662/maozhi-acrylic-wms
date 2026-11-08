export default [
  {
    path: '/system/document-numbering',
    name: '单据编号配置',
    icon: 'setting',
    component: './system/document-numbering',
  },
  {
    path: '/user/login',
    layout: false,
    component: './user/login',
  },
  {
    path: '/inbound',
    name: '入库记录',
    icon: 'import',
    component: './inbound/index',
  },
  {
    path: '/inbound/new',
    hideInMenu: true,
    component: './inbound/new',
  },
  {
    path: '/inbound/:id',
    hideInMenu: true,
    component: './inbound/detail',
  },
  {
    path: '/',
    name: '出库工作台',
    icon: 'export',
    component: './outbound/list',
  },
  {
    path: '/outbound/new',
    hideInMenu: true,
    component: './outbound/edit',
  },
  {
    path: '/outbound/:id/edit',
    hideInMenu: true,
    component: './outbound/edit',
  },
  {
    path: '/outbound/:id',
    name: '出库详情',
    hideInMenu: true,
    component: './outbound/detail',
  },
  {
    path: '/stock',
    name: '库存概览',
    icon: 'database',
    component: './stock',
  },
  {
    path: '/audit',
    name: '操作记录',
    icon: 'audit',
    component: './audit',
  },
  {
    path: '/master-data',
    name: '主数据',
    icon: 'appstore',
    component: './master-data/index',
  },
  {
    path: '/*',
    component: './404',
    layout: false,
  },
];
