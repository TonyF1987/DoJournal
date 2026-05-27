const theme = require('../../utils/theme.js');

Page({
  data: {
    darkMode: false
  },

  onLoad() {
    wx.setNavigationBarTitle({
      title: '服务协议'
    });
    theme.syncDarkMode(this);
  },

  onShow() {
    theme.syncDarkMode(this);
  }
});
