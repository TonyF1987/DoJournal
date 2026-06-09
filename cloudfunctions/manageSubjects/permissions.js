/**
 * 云函数 permissions 模块的源码副本（请勿作为云函数部署）。
 * 修改后请同步到各云函数目录下的 permissions.js，例如：
 * cp shared/cloud-permissions/permissions.js cloudfunctions/manageFamily/permissions.js
 */
const DEFAULT_PERMISSIONS = {
  checkin: true,
  homework: true,
  subjects: true,
  children: true,
  rewards: true,
  exchange: true,
  ocr: true,
  leaveFamily: true,
  deleteAccount: true
};

const PERMISSION_ERRORS = {
  checkin: '您没有打卡权限',
  homework: '您没有作业管理权限',
  subjects: '您没有科目管理权限',
  children: '您没有孩子管理权限',
  rewards: '您没有积分奖励管理权限',
  exchange: '您没有积分兑换权限',
  ocr: '您没有OCR识别权限',
  leaveFamily: '您没有退出家庭权限',
  deleteAccount: '您没有注销账号权限'
};

function getDefaultPermissions() {
  return { ...DEFAULT_PERMISSIONS };
}

function normalizePermissions(permissions) {
  if (!permissions) {
    return getDefaultPermissions();
  }
  return { ...DEFAULT_PERMISSIONS, ...permissions };
}

function canPerform(member, permissionKey) {
  if (!member) {
    return true;
  }
  if (member.role === 'creator') {
    return true;
  }
  if (member.readOnly === true) {
    return false;
  }
  const perms = member.permissions;
  if (!perms) {
    return true;
  }
  if (perms[permissionKey] === false) {
    return false;
  }
  return true;
}

function getPermissionError(member, permissionKey, readOnlyFallback) {
  if (member && member.readOnly === true) {
    return readOnlyFallback;
  }
  return PERMISSION_ERRORS[permissionKey] || '您没有操作权限';
}

function findMember(members, openid, account) {
  return (members || []).find(
    (m) => m.openid === openid && (m.account || '') === (account || '')
  ) || null;
}

async function getCurrentFamilyMember(db, user, openid) {
  if (!user || !user.familyId) {
    return null;
  }
  try {
    const familyRes = await db.collection('families').doc(user.familyId).get();
    if (!familyRes.data) {
      return null;
    }
    return findMember(familyRes.data.members, openid, user.account || '');
  } catch (err) {
    console.error('获取家庭成员失败:', err);
    return null;
  }
}

function isFamilyMemberResolved(user, member) {
  if (!user || !user.familyId) {
    return true;
  }
  return !!member;
}

function getMemberPermissions(member) {
  if (!member || member.role === 'creator') {
    return getDefaultPermissions();
  }
  if (member.readOnly === true) {
    return Object.keys(DEFAULT_PERMISSIONS).reduce((acc, key) => {
      acc[key] = false;
      return acc;
    }, {});
  }
  return normalizePermissions(member.permissions);
}

module.exports = {
  DEFAULT_PERMISSIONS,
  PERMISSION_ERRORS,
  getDefaultPermissions,
  normalizePermissions,
  canPerform,
  getPermissionError,
  findMember,
  getCurrentFamilyMember,
  isFamilyMemberResolved,
  getMemberPermissions
};
