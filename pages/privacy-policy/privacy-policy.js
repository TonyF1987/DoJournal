const theme = require('../../utils/theme.js');

Page({
  data: {
    darkMode: false
  },

  onLoad() {
    wx.setNavigationBarTitle({
      title: '隐私政策'
    });
    theme.syncDarkMode(this);
  },

  onShow() {
    theme.syncDarkMode(this);
  }
});
