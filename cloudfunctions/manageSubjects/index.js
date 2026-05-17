const cloud = require('wx-server-sdk');
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});
const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const { action, data, account } = event;

  // 获取用户信息（支持同一个 openid 的多个账号）
  const usersRes = await db.collection('users').where({
    _openid: wxContext.OPENID
  }).get();

  if (usersRes.data.length === 0) {
    return {
      success: false,
      errMsg: '用户不存在'
    };
  }

  // 找到对应账号的用户
  let user;
  if (account) {
    user = usersRes.data.find(u => (u.account || '') === account);
  }
  if (!user) {
    user = usersRes.data[0];
  }

  // 检查是否是只读权限（使用 openid + account 联合判断）
  let isReadOnly = false;
  try {
    // 如果用户有家庭，检查是否是只读
    if (user.familyId) {
      const familyRes = await db.collection('families').doc(user.familyId).get();
      
      if (familyRes.data) {
        const family = familyRes.data;
        const members = family.members || [];
        const currentMember = members.find(m => m.openid === wxContext.OPENID && m.account === (user.account || ''));
        
        if (currentMember && currentMember.readOnly) {
          isReadOnly = true;
        }
      }
    }
  } catch (err) {
    console.error('检查权限失败:', err);
  }
  
  if (isReadOnly) {
    return { success: false, errMsg: '您只有只读权限，无法修改科目' };
  }

  try {
    const userId = user._id;
    const familyId = user.familyId;
    
    if (action === 'updateSubjects') {
      const { childId, subjects } = data;
      
      if (familyId) {
        // 有家庭，更新家庭数据
        const familyRes = await db.collection('families').doc(familyId).get();
        if (!familyRes.data) {
          return {
            success: false,
            errMsg: '家庭不存在'
          };
        }
        
        const family = familyRes.data;
        const familyChildren = family.children || [];
        
        const updatedFamilyChildren = familyChildren.map(c => {
          if (c.id === childId) {
            return { ...c, subjects: subjects };
          }
          return c;
        });
        
        await db.collection('families').doc(familyId).update({
          data: { children: updatedFamilyChildren, updateTime: db.serverDate() }
        });
      } else {
        // 没有家庭，更新用户数据
        const children = user.children || [];
        const updatedChildren = children.map(c => {
          if (c.id === childId) {
            return { ...c, subjects: subjects };
          }
          return c;
        });
        
        await db.collection('users').doc(userId).update({
          data: { children: updatedChildren, updateTime: db.serverDate() }
        });
      }
      
      return { success: true };
    }
    
    return {
      success: false,
      errMsg: '未知操作'
    };
  } catch (err) {
    console.error('操作失败:', err);
    return {
      success: false,
      errMsg: err.message || '操作失败'
    };
  }
};
