const LIGHT_PAGE_BG = '#f5f5f5';
const LIGHT_PAGE_TOP = '#f0f7f0';
const DARK_PAGE_BG = '#121212';
const LIGHT_NAV_BG = '#4CAF50';
/** 深色导航栏：低饱和墨绿，避免与 #121212 反差过大 */
const DARK_NAV_BG = '#1c2420';

/**
 * 同步页面深色模式状态，并设置窗口/导航栏配色
 */
function syncDarkMode(page, options = {}) {
  if (!page || typeof page.setData !== 'function') {
    return false;
  }

  const app = getApp();
  const darkMode = !!(app && app.globalData && app.globalData.darkMode);
  const data = { darkMode };

  if (options.extraData) {
    Object.assign(data, options.extraData);
  }

  page.setData(data);
  applyPageChrome(darkMode, options);
  return darkMode;
}

function applyPageChrome(darkMode, options = {}) {
  const topColor = darkMode ? DARK_PAGE_BG : (options.backgroundTop || LIGHT_PAGE_TOP);
  const bottomColor = darkMode ? DARK_PAGE_BG : (options.backgroundBottom || LIGHT_PAGE_BG);

  try {
    wx.setBackgroundColor({
      backgroundColor: darkMode ? DARK_PAGE_BG : LIGHT_PAGE_BG,
      backgroundColorTop: topColor,
      backgroundColorBottom: bottomColor
    });
  } catch (e) {
    // 部分环境可能不支持
  }

  if (options.skipNavBar) {
    return;
  }

  try {
    wx.setNavigationBarColor({
      frontColor: '#ffffff',
      backgroundColor: darkMode ? DARK_NAV_BG : (options.navBarColor || LIGHT_NAV_BG),
      animation: {
        duration: 200,
        timingFunc: 'easeIn'
      }
    });
  } catch (e) {
    // 部分页面可能未配置导航栏
  }
}

function setGlobalDarkMode(enabled) {
  const app = getApp();
  const darkMode = !!enabled;
  app.globalData.darkMode = darkMode;
  wx.setStorageSync('darkMode', darkMode);
  return darkMode;
}

function syncAllPages() {
  const pages = getCurrentPages();
  pages.forEach((page) => {
    syncDarkMode(page, { skipNavBar: true });
  });
  const current = pages[pages.length - 1];
  if (current) {
    applyPageChrome(!!getApp().globalData.darkMode);
  }
}

module.exports = {
  syncDarkMode,
  applyPageChrome,
  setGlobalDarkMode,
  syncAllPages
};
