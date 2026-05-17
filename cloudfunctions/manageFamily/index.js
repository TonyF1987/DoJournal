const cloud = require('wx-server-sdk');
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});
const db = cloud.database();
const _ = db.command;

// 根据openid获取所有用户账号
async function getUsersByOpenid(openid) {
  const userRes = await db.collection('users').where({
    _openid: openid
  }).get();
  return userRes.data || [];
}

// 比较两个成员是否是同一个（通过account + openid联合判断）
function isSameMember(member, openid, account) {
  if (member.openid !== openid) {
    return false;
  }
  if ((member.account || '') !== (account || '')) {
    return false;
  }
  return true;
}

// 从members中查找匹配的成员
function findMember(members, openid, account) {
  return members.find(m => m.openid === openid && (m.account || '') === (account || ''));
}

// 从members中过滤掉匹配的成员
function filterOutMember(members, openid, account) {
  return members.filter(m => !(m.openid === openid && (m.account || '') === (account || '')));
}

// 检查当前用户是否是只读成员
function checkReadOnly(familyMembers, openid, account) {
  const member = findMember(familyMembers, openid, account);
  return member && member.readOnly === true;
}

// 检查当前用户是否是只读成员
function checkReadOnly(familyMembers, openid, account) {
  const member = findMember(familyMembers, openid, account);
  return member && member.readOnly === true;
}

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const { action, data } = event;

  try {
    switch (action) {
      case 'createFamily':
        return await createFamily(wxContext, data);
      case 'joinFamily':
        return await joinFamily(wxContext, data);
      case 'leaveFamily':
        return await leaveFamily(wxContext, data);
      case 'removeMember':
        return await removeMember(wxContext, data);
      case 'getFamilyInfo':
        return await getFamilyInfo(wxContext, data);
      case 'updateMemberRole':
        return await updateMemberRole(wxContext, data);
      case 'listFamilyMembers':
        return await listFamilyMembers(wxContext, data);
      case 'generateInvitationCode':
        return await generateInvitationCode(wxContext, data);
      case 'verifyInvitationCode':
        return await verifyInvitationCode(wxContext, data);
      case 'updateFamilyName':
        return await updateFamilyName(wxContext, data);
      case 'setMemberReadOnly':
        return await setMemberReadOnly(wxContext, data);
      case 'dissolveFamily':
        return await dissolveFamily(wxContext, data);
      case 'getAvailableAccounts':
        return await getAvailableAccounts(wxContext, data);
      case 'addSameOpenIdMember':
        return await addSameOpenIdMember(wxContext, data);
      default:
        return { success: false, errMsg: '未知操作' };
    }
  } catch (err) {
    console.error('家庭管理错误:', err);
    return { success: false, errMsg: err.message };
  }
};

// 创建家庭
async function createFamily(wxContext, data) {
  console.log('createFamily 被调用，data:', data);
  
  const { familyName, account = '' } = data;
  
  if (!familyName) {
    console.log('家庭名称为空');
    return { success: false, errMsg: '请输入家庭名称' };
  }

  // 获取用户信息（支持同一个 openID 的多个账号）
  const usersRes = await db.collection('users').where({
    _openid: wxContext.OPENID
  }).get();
  
  console.log('查询到用户:', usersRes.data.length);
  
  if (usersRes.data.length === 0) {
    return { success: false, errMsg: '用户不存在' };
  }
  
  // 查找对应账号的用户
  let user;
  if (account) {
    user = usersRes.data.find(u => (u.account || '') === account);
  }
  if (!user) {
    user = usersRes.data[0];
  }
  
  console.log('用户 familyId:', user.familyId);
  
  if (user.familyId) {
    return { success: false, errMsg: '您已经加入了一个家庭' };
  }

  // 创建家庭
  const familyRes = await db.collection('families').add({
    data: {
      name: familyName,
      members: [
        {
          openid: wxContext.OPENID,
          account: user.account || '',
          userId: user._id,
          nickName: user.nickName || '',
          avatarUrl: user.avatarUrl || '',
          role: 'creator', // creator, admin, member
          joinTime: db.serverDate()
        }
      ],
      children: [],
      createTime: db.serverDate(),
      updateTime: db.serverDate()
    }
  });

  const familyId = familyRes._id;

  // 更新用户，关联家庭
  await db.collection('users').doc(user._id).update({
    data: {
      familyId: familyId,
      familyRole: 'creator',
      updateTime: db.serverDate()
    }
  });

  // 将用户的小朋友迁移到家庭（如果有）
  if (user.children && user.children.length > 0) {
    const children = user.children.map(child => ({
      ...child,
      createTime: child.createTime || db.serverDate()
    }));
    
    await db.collection('families').doc(familyId).update({
      data: {
        children: children,
        updateTime: db.serverDate()
      }
    });
  }

  return {
    success: true,
    familyId: familyId,
    message: '家庭创建成功'
  };
}

// 加入家庭
async function joinFamily(wxContext, data) {
  const { familyId, invitationCode, account = '' } = data;
  
  if (!familyId) {
    return { success: false, errMsg: '请提供家庭ID' };
  }

  // 获取用户信息（支持同一个 openID 的多个账号）
  const usersRes = await db.collection('users').where({
    _openid: wxContext.OPENID
  }).get();
  
  if (usersRes.data.length === 0) {
    return { success: false, errMsg: '用户不存在' };
  }
  
  // 查找对应账号的用户
  let user;
  if (account) {
    user = usersRes.data.find(u => (u.account || '') === account);
  }
  if (!user) {
    user = usersRes.data[0];
  }

  // 获取家庭信息
  const familyRes = await db.collection('families').doc(familyId).get();
  
  if (!familyRes.data) {
    return { success: false, errMsg: '家庭不存在' };
  }
  
  const family = familyRes.data;

  // 检查用户是否已在家庭中（使用 openid+账号 联合判断）
  const existingMember = findMember(family.members, wxContext.OPENID, user.account || '');
  if (existingMember) {
    return { success: false, errMsg: '您已经在这个家庭中了' };
  }

  // 如果用户已有家庭，先退出
  if (user.familyId) {
    await leaveFamily(wxContext, { account: user.account || '' });
  }

  // 添加成员到家庭
  const newMember = {
    openid: wxContext.OPENID,
    account: user.account || '',
    userId: user._id,
    nickName: user.nickName || '',
    avatarUrl: user.avatarUrl || '',
    role: 'member',
    joinTime: db.serverDate()
  };

  await db.collection('families').doc(familyId).update({
    data: {
      members: _.push(newMember),
      updateTime: db.serverDate()
    }
  });

  // 更新用户，关联家庭，并设置第一个小朋友为当前选择
  const updateData = {
    familyId: familyId,
    familyRole: 'member',
    updateTime: db.serverDate()
  };

  // 如果家庭有小朋友，设置第一个为当前选择
  if (family.children && family.children.length > 0) {
    updateData.currentChildId = family.children[0].id;
  }

  await db.collection('users').doc(user._id).update({
    data: updateData
  });

  return {
    success: true,
    message: '加入家庭成功'
  };
}

// 退出家庭
async function leaveFamily(wxContext, data) {
  const { account } = data || {};
  
  // 获取用户信息
  const users = await getUsersByOpenid(wxContext.OPENID);
  
  if (users.length === 0) {
    return { success: false, errMsg: '用户不存在' };
  }
  
  const user = users.find(u => (u.account || '') === account) || users[0];
  
  if (!user.familyId) {
    return { success: false, errMsg: '您还没有加入家庭' };
  }

  const familyId = user.familyId;

  // 获取家庭信息
  const familyRes = await db.collection('families').doc(familyId).get();
  
  if (!familyRes.data) {
    return { success: false, errMsg: '家庭不存在' };
  }
  
  const family = familyRes.data;

  // 检查只读权限
  if (checkReadOnly(family.members, wxContext.OPENID, account || '')) {
    return { success: false, errMsg: '只读账号不能退出家庭' };
  }

  // 移除成员（使用 openid + account 联合判断）
  const updatedMembers = filterOutMember(family.members, wxContext.OPENID, account || '');

  // 检查是否还有成员
  if (updatedMembers.length === 0) {
    // 删除家庭
    await db.collection('families').doc(familyId).remove();
  } else {
    // 更新家庭
    await db.collection('families').doc(familyId).update({
      data: {
        members: updatedMembers,
        updateTime: db.serverDate()
      }
    });
  }

  // 更新用户，取消家庭关联
  await db.collection('users').doc(user._id).update({
    data: {
      familyId: null,
      familyRole: null,
      updateTime: db.serverDate()
    }
  });

  return {
    success: true,
    message: '退出家庭成功'
  };
}

// 移除成员
async function removeMember(wxContext, data) {
  const { memberOpenid, memberAccount, account } = data;
  
  if (!memberOpenid) {
    return { success: false, errMsg: '请提供成员OpenID' };
  }

  // 获取当前用户信息
  const users = await getUsersByOpenid(wxContext.OPENID);
  
  if (users.length === 0) {
    return { success: false, errMsg: '用户不存在' };
  }
  
  const user = users.find(u => (u.account || '') === account) || users[0];
  
  if (!user.familyId) {
    return { success: false, errMsg: '您还没有加入家庭' };
  }

  const familyId = user.familyId;

  // 获取家庭信息
  const familyRes = await db.collection('families').doc(familyId).get();
  
  if (!familyRes.data) {
    return { success: false, errMsg: '家庭不存在' };
  }
  
  const family = familyRes.data;

  // 检查只读权限
  if (checkReadOnly(family.members, wxContext.OPENID, account || '')) {
    return { success: false, errMsg: '只读账号不能移除成员' };
  }

  // 检查权限
  const currentMember = findMember(family.members, wxContext.OPENID, account || '');
  if (!currentMember) {
    return { success: false, errMsg: '您不在这个家庭中' };
  }

  if (currentMember.role !== 'creator' && currentMember.role !== 'admin') {
    return { success: false, errMsg: '您没有权限移除成员' };
  }

  // 检查被移除的成员是否存在
  const targetMember = findMember(family.members, memberOpenid, memberAccount || '');
  if (!targetMember) {
    return { success: false, errMsg: '成员不存在' };
  }

  // 不能移除创建者
  if (targetMember.role === 'creator') {
    return { success: false, errMsg: '不能移除家庭创建者' };
  }

  // 移除成员（使用 openid + account 联合判断）
  const updatedMembers = filterOutMember(family.members, memberOpenid, memberAccount || '');

  await db.collection('families').doc(familyId).update({
    data: {
      members: updatedMembers,
      updateTime: db.serverDate()
    }
  });

  // 更新被移除的用户（使用 openid + account 联合判断）
  const targetUserRes = await db.collection('users').where({
    _openid: memberOpenid,
    account: memberAccount || ''
  }).get();
  
  if (targetUserRes.data.length > 0) {
    await db.collection('users').doc(targetUserRes.data[0]._id).update({
      data: {
        familyId: null,
        familyRole: null,
        updateTime: db.serverDate()
      }
    });
  }

  return {
    success: true,
    message: '移除成员成功'
  };
}

// 获取家庭信息
async function getFamilyInfo(wxContext, data) {
  const { account } = data || {};
  
  console.log('getFamilyInfo 被调用，account:', account);
  
  // 获取用户信息（支持同一个 openid 的多个账号）
  const users = await getUsersByOpenid(wxContext.OPENID);
  
  if (users.length === 0) {
    return { success: false, errMsg: '用户不存在' };
  }
  
  const user = users.find(u => (u.account || '') === account) || users[0];
  console.log('找到用户:', user, 'familyId:', user.familyId);
  
  if (!user.familyId) {
    return { success: true, family: null, message: '您还没有加入家庭' };
  }

  // 获取家庭信息
  const familyRes = await db.collection('families').doc(user.familyId).get();
  console.log('查询家庭结果:', familyRes);
  
  if (!familyRes.data) {
    return { success: true, family: null, message: '家庭不存在' };
  }

  const family = familyRes.data;
  console.log('返回家庭数据:', family);

  return {
    success: true,
    family: family
  };
}

// 更新成员角色
async function updateMemberRole(wxContext, data) {
  const { memberOpenid, memberAccount, role, account } = data;
  
  if (!memberOpenid || !role) {
    return { success: false, errMsg: '请提供完整信息' };
  }

  if (!['admin', 'member'].includes(role)) {
    return { success: false, errMsg: '无效的角色' };
  }

  // 获取用户信息
  const users = await getUsersByOpenid(wxContext.OPENID);
  
  if (users.length === 0) {
    return { success: false, errMsg: '用户不存在' };
  }
  
  const user = users.find(u => (u.account || '') === account) || users[0];
  
  if (!user.familyId) {
    return { success: false, errMsg: '您还没有加入家庭' };
  }

  const familyId = user.familyId;

  // 获取家庭信息
  const familyRes = await db.collection('families').doc(familyId).get();
  
  if (!familyRes.data) {
    return { success: false, errMsg: '家庭不存在' };
  }
  
  const family = familyRes.data;

  // 检查只读权限
  if (checkReadOnly(family.members, wxContext.OPENID, account || '')) {
    return { success: false, errMsg: '只读账号不能修改成员角色' };
  }

  // 检查权限
  const currentMember = findMember(family.members, wxContext.OPENID, account || '');
  if (!currentMember) {
    return { success: false, errMsg: '您不在这个家庭中' };
  }

  if (currentMember.role !== 'creator') {
    return { success: false, errMsg: '只有创建者可以修改成员角色' };
  }

  // 更新成员角色
  const updatedMembers = family.members.map(m => {
    if (isSameMember(m, memberOpenid, memberAccount || '')) {
      return { ...m, role: role };
    }
    return m;
  });

  await db.collection('families').doc(familyId).update({
    data: {
      members: updatedMembers,
      updateTime: db.serverDate()
    }
  });

  return {
    success: true,
    message: '角色更新成功'
  };
}

// 列出家庭成员
async function listFamilyMembers(wxContext, data) {
  const { account } = data || {};
  
  // 获取用户信息
  const users = await getUsersByOpenid(wxContext.OPENID);
  
  if (users.length === 0) {
    return { success: false, errMsg: '用户不存在' };
  }
  
  const user = users.find(u => (u.account || '') === account) || users[0];
  
  if (!user.familyId) {
    return { success: true, members: [], message: '您还没有加入家庭' };
  }

  // 获取家庭信息
  const familyRes = await db.collection('families').doc(user.familyId).get();
  
  if (!familyRes.data) {
    return { success: false, errMsg: '家庭不存在' };
  }

  return {
    success: true,
    members: familyRes.data.members
  };
}

// 生成邀请码
async function generateInvitationCode(wxContext, data) {
  const { account } = data || {};
  
  // 获取用户信息
  const users = await getUsersByOpenid(wxContext.OPENID);
  
  if (users.length === 0) {
    return { success: false, errMsg: '用户不存在' };
  }
  
  const user = users.find(u => (u.account || '') === account) || users[0];
  
  if (!user.familyId) {
    return { success: false, errMsg: '您还没有加入家庭' };
  }

  const familyId = user.familyId;

  // 获取家庭信息
  const familyRes = await db.collection('families').doc(familyId).get();
  
  if (!familyRes.data) {
    return { success: false, errMsg: '家庭不存在' };
  }
  
  const family = familyRes.data;

  // 检查只读权限
  if (checkReadOnly(family.members, wxContext.OPENID, account || '')) {
    return { success: false, errMsg: '只读账号不能生成邀请码' };
  }

  // 检查权限
  const currentMember = findMember(family.members, wxContext.OPENID, account || '');
  if (!currentMember) {
    return { success: false, errMsg: '您不在这个家庭中' };
  }

  if (currentMember.role !== 'creator' && currentMember.role !== 'admin') {
    return { success: false, errMsg: '您没有权限生成邀请码' };
  }

  // 删除旧的邀请码
  await db.collection('family_invitations').where({
    familyId: familyId,
    _openid: wxContext.OPENID
  }).remove();

  // 生成邀请码
  const code = Math.random().toString(36).substring(2, 8).toUpperCase();
  const expireTime = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7天有效

  await db.collection('family_invitations').add({
    data: {
      familyId: familyId,
      familyName: family.name,
      code: code,
      expireTime: expireTime,
      createTime: db.serverDate(),
      _openid: wxContext.OPENID
    }
  });

  return {
    success: true,
    code: code,
    expireTime: expireTime,
    message: '邀请码生成成功'
  };
}

// 验证邀请码
async function verifyInvitationCode(wxContext, data) {
  const { code } = data;
  
  if (!code) {
    return { success: false, errMsg: '请提供邀请码' };
  }

  // 查询邀请码
  const now = new Date();
  const invitationRes = await db.collection('family_invitations').where({
    code: code,
    expireTime: _.gte(now)
  }).get();

  if (invitationRes.data.length === 0) {
    return { success: false, errMsg: '邀请码无效或已过期' };
  }

  const invitation = invitationRes.data[0];

  // 获取家庭信息
  const familyRes = await db.collection('families').doc(invitation.familyId).get();
  
  if (!familyRes.data) {
    return { success: false, errMsg: '家庭不存在' };
  }

  const family = familyRes.data;

  return {
    success: true,
    familyId: invitation.familyId,
    familyName: family.name,
    message: '邀请码验证成功'
  };
}

// 更新家庭名称
async function updateFamilyName(wxContext, data) {
  const { familyName, account } = data;
  
  if (!familyName) {
    return { success: false, errMsg: '请提供家庭名称' };
  }

  // 获取当前用户信息（需要传入 account 参数）
  const currentAccount = account || '';
  const currentUsers = await getUsersByOpenid(wxContext.OPENID);
  
  if (currentUsers.length === 0) {
    return { success: false, errMsg: '用户不存在' };
  }
  
  const currentUser = currentUsers.find(u => (u.account || '') === currentAccount) || currentUsers[0];
  
  if (!currentUser.familyId) {
    return { success: false, errMsg: '您还没有加入家庭' };
  }

  const familyId = currentUser.familyId;

  // 获取家庭信息
  const familyRes = await db.collection('families').doc(familyId).get();
  
  if (!familyRes.data) {
    return { success: false, errMsg: '家庭不存在' };
  }
  
  const family = familyRes.data;

  // 检查只读权限
  if (checkReadOnly(family.members, wxContext.OPENID, currentAccount)) {
    return { success: false, errMsg: '只读账号不能修改家庭名称' };
  }

  // 检查权限（使用 openid + account 联合判断）
  const currentMember = findMember(family.members, wxContext.OPENID, currentAccount);
  if (!currentMember) {
    return { success: false, errMsg: '您不在这个家庭中' };
  }

  if (currentMember.role !== 'creator') {
    return { success: false, errMsg: '只有家庭创建者可以修改家庭名称' };
  }

  // 更新家庭名称
  await db.collection('families').doc(familyId).update({
    data: {
      name: familyName,
      updateTime: db.serverDate()
    }
  });

  return {
    success: true,
    message: '家庭名称修改成功'
  };
}

// 设置成员只读权限
async function setMemberReadOnly(wxContext, data) {
  const { memberOpenid, memberAccount, readOnly, account } = data;
  
  if (!memberOpenid) {
    return { success: false, errMsg: '请提供成员OpenID' };
  }

  // 获取当前用户信息（需要传入 account 参数）
  const currentAccount = account || '';
  const currentUsers = await getUsersByOpenid(wxContext.OPENID);
  
  if (currentUsers.length === 0) {
    return { success: false, errMsg: '用户不存在' };
  }
  
  const currentUser = currentUsers.find(u => (u.account || '') === currentAccount) || currentUsers[0];
  
  if (!currentUser.familyId) {
    return { success: false, errMsg: '您还没有加入家庭' };
  }

  const familyId = currentUser.familyId;

  // 获取家庭信息
  const familyRes = await db.collection('families').doc(familyId).get();
  
  if (!familyRes.data) {
    return { success: false, errMsg: '家庭不存在' };
  }
  
  const family = familyRes.data;

  // 检查只读权限
  if (checkReadOnly(family.members, wxContext.OPENID, currentAccount)) {
    return { success: false, errMsg: '只读账号不能修改成员权限' };
  }

  // 检查权限（使用 openid + account 联合判断）
  const currentMember = findMember(family.members, wxContext.OPENID, currentAccount);
  if (!currentMember) {
    return { success: false, errMsg: '您不在这个家庭中' };
  }

  if (currentMember.role !== 'creator') {
    return { success: false, errMsg: '只有家庭创建者可以修改成员权限' };
  }

  // 检查被修改的成员是否存在（使用 openid + account 联合判断）
  const targetMember = findMember(family.members, memberOpenid, memberAccount || '');
  if (!targetMember) {
    return { success: false, errMsg: '成员不存在' };
  }

  // 不能修改创建者的权限
  if (targetMember.role === 'creator') {
    return { success: false, errMsg: '不能修改家庭创建者的权限' };
  }

  // 更新成员只读权限
  const updatedMembers = family.members.map(m => {
    if (m.openid === memberOpenid && m.account === (memberAccount || '')) {
      return { ...m, readOnly: readOnly };
    }
    return m;
  });

  await db.collection('families').doc(familyId).update({
    data: {
      members: updatedMembers,
      updateTime: db.serverDate()
    }
  });

  // 同步更新用户表中的权限（使用 openid + account 联合查找）
  const targetUserRes = await db.collection('users').where({
    _openid: memberOpenid,
    account: memberAccount || ''
  }).get();
  
  if (targetUserRes.data.length > 0) {
    await db.collection('users').doc(targetUserRes.data[0]._id).update({
      data: {
        familyReadOnly: readOnly,
        updateTime: db.serverDate()
      }
    });
  }

  return {
    success: true,
    message: readOnly ? '已设置只读权限' : '已取消只读权限'
  };
}

// 解散家庭
async function dissolveFamily(wxContext, data) {
  // 获取当前用户信息（需要传入 account 参数）
  const account = data.account || '';
  const users = await getUsersByOpenid(wxContext.OPENID);
  
  if (users.length === 0) {
    return { success: false, errMsg: '用户不存在' };
  }
  
  // 查找对应账号的用户
  const user = users.find(u => (u.account || '') === account) || users[0];
  
  if (!user.familyId) {
    return { success: false, errMsg: '您还没有加入家庭' };
  }

  const familyId = user.familyId;

  // 获取家庭信息
  const familyRes = await db.collection('families').doc(familyId).get();
  
  if (!familyRes.data) {
    return { success: false, errMsg: '家庭不存在' };
  }
  
  const family = familyRes.data;

  // 检查只读权限
  if (checkReadOnly(family.members, wxContext.OPENID, account)) {
    return { success: false, errMsg: '只读账号不能解散家庭' };
  }

  // 检查权限（使用 openid + account 联合判断）
  const currentMember = findMember(family.members, wxContext.OPENID, account);
  if (!currentMember) {
    return { success: false, errMsg: '您不在这个家庭中' };
  }

  if (currentMember.role !== 'creator') {
    return { success: false, errMsg: '只有家庭创建者可以解散家庭' };
  }

  // 解散家庭：先更新所有成员的家庭关联
  const userUpdatePromises = family.members.map(member => {
    return db.collection('users').where({
      _openid: member.openid,
      account: member.account || ''
    }).get().then(res => {
      if (res.data.length > 0) {
        return db.collection('users').doc(res.data[0]._id).update({
          data: {
            familyId: null,
            familyRole: null,
            familyReadOnly: null,
            updateTime: db.serverDate()
          }
        });
      }
    });
  });

  await Promise.all(userUpdatePromises);

  // 删除家庭
  await db.collection('families').doc(familyId).remove();

  // 删除相关的邀请码
  await db.collection('family_invitations').where({
    familyId: familyId
  }).remove();

  return {
    success: true,
    message: '家庭已解散'
  };
}

// 获取当前 openID 下未加入家庭的其他账号
async function getAvailableAccounts(wxContext, data) {
  const { account = '' } = data;
  
  // 获取当前用户信息（需要传入 account 参数）
  const users = await getUsersByOpenid(wxContext.OPENID);
  
  if (users.length === 0) {
    return { success: false, errMsg: '用户不存在' };
  }
  
  // 查找对应账号的用户
  const user = users.find(u => (u.account || '') === account) || users[0];
  
  if (!user.familyId) {
    return { success: false, errMsg: '您还没有加入家庭' };
  }

  const familyId = user.familyId;

  // 获取家庭信息
  const familyRes = await db.collection('families').doc(familyId).get();
  
  if (!familyRes.data) {
    return { success: false, errMsg: '家庭不存在' };
  }
  
  const family = familyRes.data;

  // 检查只读权限
  if (checkReadOnly(family.members, wxContext.OPENID, account)) {
    return { success: false, errMsg: '只读账号不能添加成员' };
  }

  // 检查权限（使用 openid + account 联合判断）
  const currentMember = findMember(family.members, wxContext.OPENID, account);
  if (!currentMember) {
    return { success: false, errMsg: '您不在这个家庭中' };
  }

  if (currentMember.role !== 'creator') {
    return { success: false, errMsg: '只有家庭创建者可以添加成员' };
  }

  // 找出当前 openID 下未加入该家庭的其他账号
  const availableAccounts = users.filter(u => {
    if (u._id === user._id) return false; // 排除当前账号
    const memberInFamily = findMember(family.members, wxContext.OPENID, u.account || '');
    return !memberInFamily;
  });

  return {
    success: true,
    accounts: availableAccounts.map(u => ({
      _id: u._id,
      nickName: u.nickName || '',
      avatarUrl: u.avatarUrl || '',
      account: u.account || ''
    }))
  };
}

// 添加当前 openID 下的账号到家庭
async function addSameOpenIdMember(wxContext, data) {
  const { targetAccount, account = '' } = data;
  
  if (!targetAccount && targetAccount !== '') {
    return { success: false, errMsg: '请提供要添加的账号' };
  }

  // 获取当前用户信息（需要传入 account 参数）
  const users = await getUsersByOpenid(wxContext.OPENID);
  
  if (users.length === 0) {
    return { success: false, errMsg: '用户不存在' };
  }
  
  // 查找对应账号的用户（当前操作账号）
  const user = users.find(u => (u.account || '') === account) || users[0];
  
  if (!user.familyId) {
    return { success: false, errMsg: '您还没有加入家庭' };
  }

  const familyId = user.familyId;

  // 获取家庭信息
  const familyRes = await db.collection('families').doc(familyId).get();
  
  if (!familyRes.data) {
    return { success: false, errMsg: '家庭不存在' };
  }
  
  const family = familyRes.data;

  // 检查权限（使用 openid + account 联合判断）
  const currentMember = findMember(family.members, wxContext.OPENID, account);
  if (!currentMember) {
    return { success: false, errMsg: '您不在这个家庭中' };
  }

  if (currentMember.role !== 'creator') {
    return { success: false, errMsg: '只有家庭创建者可以添加成员' };
  }

  // 查找要添加的目标账号
  const targetUser = users.find(u => (u.account || '') === targetAccount);
  if (!targetUser) {
    return { success: false, errMsg: '目标账号不存在' };
  }

  // 检查目标账号是否已在家庭中
  const existingMember = findMember(family.members, wxContext.OPENID, targetAccount);
  if (existingMember) {
    return { success: false, errMsg: '该账号已在家庭中' };
  }

  // 如果目标账号已有家庭，先退出
  if (targetUser.familyId) {
    await leaveFamily(wxContext, { account: targetAccount });
  }

  // 添加成员到家庭
  const newMember = {
    openid: wxContext.OPENID,
    account: targetUser.account || '',
    userId: targetUser._id,
    nickName: targetUser.nickName || '',
    avatarUrl: targetUser.avatarUrl || '',
    role: 'member',
    joinTime: db.serverDate()
  };

  await db.collection('families').doc(familyId).update({
    data: {
      members: _.push(newMember),
      updateTime: db.serverDate()
    }
  });

  // 更新目标用户，关联家庭
  await db.collection('users').doc(targetUser._id).update({
    data: {
      familyId: familyId,
      familyRole: 'member',
      updateTime: db.serverDate()
    }
  });

  return {
    success: true,
    message: '添加成员成功'
  };
}
