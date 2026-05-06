const cloud = require('wx-server-sdk');
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const { code } = event;

  try {
    // 使用云开发获取手机号
    const result = await cloud.getOpenData({
      list: [code],
    });

    // 解析手机号
    if (result && result.list && result.list.length > 0) {
      const phoneData = result.list[0];
      const phoneNumber = phoneData.phoneNumber || phoneData.purePhoneNumber;
      
      return {
        success: true,
        phoneNumber: phoneNumber
      };
    }

    return {
      success: false,
      errMsg: '获取手机号失败'
    };
  } catch (err) {
    console.error('获取手机号异常:', err);
    return {
      success: false,
      errMsg: err.message || '获取手机号失败'
    };
  }
};
