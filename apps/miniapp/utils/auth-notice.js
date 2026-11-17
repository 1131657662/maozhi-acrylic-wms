const authCopy = {
  title: '账号安全提醒',
  legacyPassword: '当前密码超过安全长度，请到网页个人中心修改密码。',
  confirm: '知道了',
};

function showPasswordNotice(result) {
  if (result.passwordChangeRecommended !== true) return Promise.resolve();
  return new Promise((resolve) =>
    wx.showModal({
      title: authCopy.title,
      content: authCopy.legacyPassword,
      showCancel: false,
      confirmText: authCopy.confirm,
      complete: resolve,
    }),
  );
}
module.exports = { showPasswordNotice };
