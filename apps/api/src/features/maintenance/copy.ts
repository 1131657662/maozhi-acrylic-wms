export const maintenanceErrors = {
  busy: '已有维护操作正在进行，请等待完成后再试',
  unavailable: '备份执行器尚未配置，请联系维护人员',
  identity: '备份连接与当前本地数据库不一致，已拒绝执行',
  interrupted: '服务中断，任务未完成；已有记录和文件保留，请重新发起备份',
  dump: '数据库备份失败或超时，未发布备份文件，请检查数据库和磁盘后重试',
  failed: '备份未完成，未发布可下载文件，请检查服务后重试',
  disk: '磁盘剩余空间不足，已拒绝备份',
  file: '备份文件缺失或归属不符，已拒绝操作',
  corrupt: '备份文件大小或校验值不一致，已拒绝下载',
  database: '数据库连接异常，暂时无法校验登录状态',
  retention: '备份清理未完成，记录已保留，请重试',
  tooMany: '备份产物过多，已停止清理，请由维护人员核验',
} as const;

export const maintenanceHealthText = {
  databaseSource: '数据库连接探测',
  databaseFailed: '数据库连接失败',
  diskSource: '备份目录所在磁盘',
  diskMissing: '尚未配置备份目录',
  diskLow: '磁盘剩余空间不足',
  diskFailed: '无法读取磁盘剩余空间',
  backupSource: '备份任务记录',
  backupEmpty: '从未备份',
  backupFailed: '无法读取最近备份记录',
  httpSource: '近24小时请求统计',
  httpUnsupported: '尚未接入近24小时请求统计采集器',
  scheduleFailed: '最近自动备份调度失败，请检查备份任务',
  scheduleInterrupted: '自动备份调度被服务中断',
} as const;

export const schedulerText = {
  busy: '已有备份或清理进行中，本次跳过，不排队',
  startup: '启动时超过24小时没有成功备份',
  daily: '每日北京时间03:00到期备份',
  failed: '自动备份调度失败，请检查数据库和备份执行器',
  interrupted: '服务中断，自动备份未完成',
} as const;
