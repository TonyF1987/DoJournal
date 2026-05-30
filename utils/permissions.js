const DEFAULT_PERMISSIONS = {
  checkin: true,
  homework: true,
  subjects: true,
  children: true,
  rewards: true,
  exchange: true,
  ocr: true
};

const PERMISSION_LABELS = {
  checkin: '打卡',
  homework: '作业管理',
  subjects: '科目管理',
  children: '孩子管理',
  rewards: '积分奖励',
  exchange: '积分兑换',
  ocr: 'OCR识别'
};

const PERMISSION_ERRORS = {
  checkin: '您没有打卡权限',
  homework: '您没有作业管理权限',
  subjects: '您没有科目管理权限',
  children: '您没有孩子管理权限',
  rewards: '您没有积分奖励管理权限',
  exchange: '您没有积分兑换权限',
  ocr: '您没有OCR识别权限'
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

function isRestricted(member) {
  if (!member || member.role === 'creator' || member.readOnly === true) {
    return false;
  }
  const perms = member.permissions;
  if (!perms) {
    return false;
  }
  return Object.keys(DEFAULT_PERMISSIONS).some((key) => perms[key] === false);
}

function hasReadOnly(member) {
  return !!(member && member.readOnly === true);
}

function findFamilyMember(familyMembers, openid, account) {
  return (familyMembers || []).find(
    (m) => m.openid === openid && (m.account || '') === (account || '')
  ) || null;
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
  PERMISSION_LABELS,
  PERMISSION_ERRORS,
  getDefaultPermissions,
  normalizePermissions,
  canPerform,
  getPermissionError,
  isRestricted,
  hasReadOnly,
  findFamilyMember,
  getMemberPermissions
};
