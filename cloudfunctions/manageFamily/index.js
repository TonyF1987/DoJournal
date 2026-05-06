const cloud = require('wx-server-sdk');
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});
const db = cloud.database();
const _ = db.command;

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
  
  const { familyName } = data;
  
  if (!familyName) {
    console.log('家庭名称为空');
    return { success: false, errMsg: '请输入家庭名称' };
  }

  // 检查用户是否已有家庭
  const userRes = await db.collection('users').where({
    _openid: wxContext.OPENID
  }).get();
  
  console.log('查询到用户:', userRes.data.length);
  
  if (userRes.data.length === 0) {
    return { success: false, errMsg: '用户不存在' };
  }
  
  const user = userRes.data[0];
  
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
  const { familyId, invitationCode } = data;
  
  if (!familyId) {
    return { success: false, errMsg: '请提供家庭ID' };
  }

  // 获取家庭信息
  const familyRes = await db.collection('families').doc(familyId).get();
  
  if (!familyRes.data) {
    return { success: false, errMsg: '家庭不存在' };
  }
  
  const family = familyRes.data;

  // 检查用户是否已在家庭中
  const existingMember = family.members.find(m => m.openid === wxContext.OPENID);
  if (existingMember) {
    return { success: false, errMsg: '您已经在这个家庭中了' };
  }

  // 获取用户信息
  const userRes = await db.collection('users').where({
    _openid: wxContext.OPENID
  }).get();
  
  if (userRes.data.length === 0) {
    return { success: false, errMsg: '用户不存在' };
  }
  
  const user = userRes.data[0];

  // 如果用户已有家庭，先退出
  if (user.familyId) {
    await leaveFamily(wxContext, {});
  }

  // 添加成员到家庭
  const newMember = {
    openid: wxContext.OPENID,
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

  // 更新用户，关联家庭
  await db.collection('users').doc(user._id).update({
    data: {
      familyId: familyId,
      familyRole: 'member',
      updateTime: db.serverDate()
    }
  });

  return {
    success: true,
    message: '加入家庭成功'
  };
}

// 退出家庭
async function leaveFamily(wxContext, data) {
  // 获取用户信息
  const userRes = await db.collection('users').where({
    _openid: wxContext.OPENID
  }).get();
  
  if (userRes.data.length === 0) {
    return { success: false, errMsg: '用户不存在' };
  }
  
  const user = userRes.data[0];
  
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

  // 移除成员
  const updatedMembers = family.members.filter(m => m.openid !== wxContext.OPENID);

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
  const { memberOpenid } = data;
  
  if (!memberOpenid) {
    return { success: false, errMsg: '请提供成员OpenID' };
  }

  // 获取用户信息
  const userRes = await db.collection('users').where({
    _openid: wxContext.OPENID
  }).get();
  
  if (userRes.data.length === 0) {
    return { success: false, errMsg: '用户不存在' };
  }
  
  const user = userRes.data[0];
  
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

  // 检查权限
  const currentMember = family.members.find(m => m.openid === wxContext.OPENID);
  if (!currentMember) {
    return { success: false, errMsg: '您不在这个家庭中' };
  }

  if (currentMember.role !== 'creator' && currentMember.role !== 'admin') {
    return { success: false, errMsg: '您没有权限移除成员' };
  }

  // 检查被移除的成员是否存在
  const targetMember = family.members.find(m => m.openid === memberOpenid);
  if (!targetMember) {
    return { success: false, errMsg: '成员不存在' };
  }

  // 不能移除创建者
  if (targetMember.role === 'creator') {
    return { success: false, errMsg: '不能移除家庭创建者' };
  }

  // 移除成员
  const updatedMembers = family.members.filter(m => m.openid !== memberOpenid);

  await db.collection('families').doc(familyId).update({
    data: {
      members: updatedMembers,
      updateTime: db.serverDate()
    }
  });

  // 更新被移除的用户
  const targetUserRes = await db.collection('users').where({
    _openid: memberOpenid
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
  // 获取用户信息
  const userRes = await db.collection('users').where({
    _openid: wxContext.OPENID
  }).get();
  
  if (userRes.data.length === 0) {
    return { success: false, errMsg: '用户不存在' };
  }
  
  const user = userRes.data[0];
  
  if (!user.familyId) {
    return { success: true, family: null, message: '您还没有加入家庭' };
  }

  // 获取家庭信息
  const familyRes = await db.collection('families').doc(user.familyId).get();
  
  if (!familyRes.data) {
    return { success: true, family: null, message: '家庭不存在' };
  }

  return {
    success: true,
    family: familyRes.data
  };
}

// 更新成员角色
async function updateMemberRole(wxContext, data) {
  const { memberOpenid, role } = data;
  
  if (!memberOpenid || !role) {
    return { success: false, errMsg: '请提供完整信息' };
  }

  if (!['admin', 'member'].includes(role)) {
    return { success: false, errMsg: '无效的角色' };
  }

  // 获取用户信息
  const userRes = await db.collection('users').where({
    _openid: wxContext.OPENID
  }).get();
  
  if (userRes.data.length === 0) {
    return { success: false, errMsg: '用户不存在' };
  }
  
  const user = userRes.data[0];
  
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

  // 检查权限
  const currentMember = family.members.find(m => m.openid === wxContext.OPENID);
  if (!currentMember) {
    return { success: false, errMsg: '您不在这个家庭中' };
  }

  if (currentMember.role !== 'creator') {
    return { success: false, errMsg: '只有创建者可以修改成员角色' };
  }

  // 更新成员角色
  const updatedMembers = family.members.map(m => {
    if (m.openid === memberOpenid) {
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
  // 获取用户信息
  const userRes = await db.collection('users').where({
    _openid: wxContext.OPENID
  }).get();
  
  if (userRes.data.length === 0) {
    return { success: false, errMsg: '用户不存在' };
  }
  
  const user = userRes.data[0];
  
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
  // 获取用户信息
  const userRes = await db.collection('users').where({
    _openid: wxContext.OPENID
  }).get();
  
  if (userRes.data.length === 0) {
    return { success: false, errMsg: '用户不存在' };
  }
  
  const user = userRes.data[0];
  
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

  // 检查权限
  const currentMember = family.members.find(m => m.openid === wxContext.OPENID);
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
