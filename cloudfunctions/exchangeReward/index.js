const cloud = require('wx-server-sdk');
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});
const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const { childId, rewardId, points, account } = event;

  // 获取用户信息（支持同一个 openid 的多个账号）
  const usersRes = await db.collection('users').where({
    _openid: wxContext.OPENID
  }).get();

  // 找到对应账号的用户
  let user;
  if (usersRes.data.length > 0) {
    if (account) {
      user = usersRes.data.find(u => (u.account || '') === account);
    }
    if (!user) {
      user = usersRes.data[0];
    }
  }

  // 检查是否是只读权限（使用 openid + account 联合判断）
  let isReadOnly = false;
  try {
    if (user) {
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
    }
  } catch (err) {
    console.error('检查权限失败:', err);
  }
  
  if (isReadOnly) {
    return { success: false, errMsg: '您只有只读权限，无法兑换奖励' };
  }

  try {
    if (!user) {
      return {
        success: false,
        errMsg: '用户不存在'
      };
    }

    const userId = user._id;
    const familyId = user.familyId;
    
    // 找到当前小朋友
    let currentChild = null;
    if (familyId) {
      // 有家庭，从家庭数据查找
      const familyRes = await db.collection('families').doc(familyId).get();
      if (familyRes.data && familyRes.data.children) {
        currentChild = familyRes.data.children.find(c => c.id === childId);
      }
    } else {
      // 没有家庭，从用户数据查找
      if (user.children) {
        currentChild = user.children.find(c => c.id === childId);
      }
    }
    
    if (!currentChild) {
      return {
        success: false,
        errMsg: '小朋友不存在'
      };
    }
    
    // 检查积分是否足够
    if ((currentChild.points || 0) < points) {
      return {
        success: false,
        errMsg: '积分不足'
      };
    }
    
    // 找到奖励信息
    let reward = null;
    if (currentChild.rewards) {
      reward = currentChild.rewards.find(r => r.id === rewardId);
    }
    
    // 计算新积分
    const newPoints = (currentChild.points || 0) - points;
    const newPunishedPoints = (currentChild.punishedPoints || 0) + points;
    
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
          return { ...c, points: newPoints, punishedPoints: newPunishedPoints };
        }
        return c;
      });
      
      // 同时更新家庭数据和添加积分记录
      await Promise.all([
        db.collection('families').doc(familyId).update({
          data: { children: updatedFamilyChildren, updateTime: db.serverDate() }
        }),
        db.collection('point_records').add({
          data: {
            _openid: wxContext.OPENID,
            type: 'reward',
            name: reward ? reward.name : '兑换奖励',
            description: reward ? reward.description : '',
            points: points,
            icon: reward ? reward.icon : '🎁',
            createTime: db.serverDate(),
            childId: childId
          }
        })
      ]);
    } else {
      // 没有家庭，更新用户数据
      const children = user.children || [];
      const updatedChildren = children.map(c => {
        if (c.id === childId) {
          return { ...c, points: newPoints, punishedPoints: newPunishedPoints };
        }
        return c;
      });
      
      // 同时更新用户数据和添加积分记录
      await Promise.all([
        db.collection('users').doc(userId).update({
          data: { children: updatedChildren, updateTime: db.serverDate() }
        }),
        db.collection('point_records').add({
          data: {
            _openid: wxContext.OPENID,
            type: 'reward',
            name: reward ? reward.name : '兑换奖励',
            description: reward ? reward.description : '',
            points: points,
            icon: reward ? reward.icon : '🎁',
            createTime: db.serverDate(),
            childId: childId
          }
        })
      ]);
    }
    
    return {
      success: true,
      remainingPoints: newPoints
    };
  } catch (err) {
    console.error('兑换失败:', err);
    return {
      success: false,
      errMsg: err.message || '兑换失败'
    };
  }
};
