/**
 * 格式化日期
 * @param {Date|String} date
 * @returns {String}
 */
function formatDate(date) {
  if (!date) return '';
  const d = new Date(date);
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

/**
 * 格式化日期时间
 * @param {Date|String} date
 * @returns {String}
 */
function formatDateTime(date) {
  if (!date) return '';
  const d = new Date(date);
  return `${d.getMonth() + 1}月${d.getDate()}日 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/**
 * 格式化时间
 * @param {Date|String} date
 * @returns {String}
 */
function formatTime(date) {
  if (!date) return '';
  const d = new Date(date);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/**
 * 计算相对时间
 * @param {Date|String} date
 * @returns {String}
 */
function formatRelativeTime(date) {
  if (!date) return '';
  const now = new Date();
  const d = new Date(date);
  const diff = now - d;

  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diff < minute) {
    return '刚刚';
  } else if (diff < hour) {
    return `${Math.floor(diff / minute)}分钟前`;
  } else if (diff < day) {
    return `${Math.floor(diff / hour)}小时前`;
  } else if (diff < 7 * day) {
    return `${Math.floor(diff / day)}天前`;
  } else {
    return formatDate(date);
  }
}

module.exports = {
  formatDate,
  formatDateTime,
  formatTime,
  formatRelativeTime
};
