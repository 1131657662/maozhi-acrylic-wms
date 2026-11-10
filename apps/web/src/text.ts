export const errorCopy = {
  NETWORK: ['网络连接中断，请检查网络后重试', '重试'],
  UNAVAILABLE: ['服务暂时不可用，请稍后重试', '重试'],
  TIMEOUT: ['服务响应超时，本次操作未完成', '重试'],
  SERVER: ['系统出错了，已记录', '重试'],
  VALIDATION: ['填写有误，请检查标红的内容', '检查填写内容'],
  CONFLICT: ['该单据已被修改，请刷新后重试', '刷新'],
  FORBIDDEN: ['没有权限执行此操作', '联系管理员'],
  UNAUTHORIZED: ['登录已过期，请重新登录', '去登录'],
  NOT_FOUND: ['该记录不存在或已被删除', '返回列表'],
  DATA_INVALID: ['数据异常，已记录', '重试'],
} as const;
export const errorUi = {
  details: '查看诊断信息',
  time: '发生时间',
  path: '请求位置',
  status: '响应结果',
  trace: '追踪编号',
  copy: '复制诊断信息',
  copied: '已复制',
  unavailable: '未收到响应',
  invalid: '请检查此项填写内容',
  notSaved: '未提交成功，填写内容已保留。重试不会重复保存。',
  repeated: '请联系开发并提供诊断信息中的编号。',
};
export const WEB_REQUEST_TIMEOUT_MS = 30_000;
export const ERROR_DEDUPE_MS = 5_000;
export const ERROR_MAX_VISIBLE = 3;
export const ERROR_HISTORY_LIMIT = 100;
export const ERROR_SUPPORT_THRESHOLD = 3;
