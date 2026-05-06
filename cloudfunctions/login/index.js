const cloud = require('wx-server-sdk');
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});
const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();

  // 获取用户信息
  let userRes = await db.collection('users').where({
    _openid: wxContext.OPENID
  }).get();

  let userId;
  let isNewUser = false;

  if (userRes.data.length === 0) {
    // 新用户，创建用户记录
    const defaultChild = {
      id: Date.now().toString(),
      name: '小宝贝',
      avatarUrl: event.userInfo ? event.userInfo.avatarUrl : '',
      gender: '',
      birthDate: '',
      schoolStage: '',
      points: 0,
      streak: 0,
      lastCheckInDate: '',
      subjects: [],
      rewards: [],
      violations: [],
      createTime: db.serverDate()
    };
    
    let addRes = await db.collection('users').add({
      data: {
        _openid: wxContext.OPENID,
        nickName: event.userInfo ? event.userInfo.nickName : '',
        avatarUrl: event.userInfo ? event.userInfo.avatarUrl : '',
        phoneNumber: event.userInfo ? event.userInfo.phoneNumber : '',
        unionId: wxContext.UNIONID || '',
        children: [defaultChild],
        currentChildId: defaultChild.id,
        createTime: db.serverDate(),
        updateTime: db.serverDate()
      }
    });
    userId = addRes._id;
    isNewUser = true;
  } else {
    userId = userRes.data[0]._id;
    const user = userRes.data[0];
    
    if (user.familyId) {
      // 有家庭，检查并更新家庭中的小朋友数据
      const familyRes = await db.collection('families').doc(user.familyId).get();
      if (familyRes.data) {
        const family = familyRes.data;
        
        // 检查并初始化每个小朋友的数据
        let needUpdate = false;
        
        const updatedChildren = (family.children || []).map(child => {
          let changed = false;
          
          // 如果没有 subjects 数组，添加空数组
          if (!child.subjects) {
            child = { ...child, subjects: [] };
            changed = true;
          }
          
          // 如果没有 rewards 数组，添加空数组
          if (!child.rewards) {
            child = { ...child, rewards: [] };
            changed = true;
          }
          
          // 如果没有 violations 数组，添加空数组
          if (!child.violations) {
            child = { ...child, violations: [] };
            changed = true;
          }
          
          if (changed) {
            needUpdate = true;
          }
          
          return child;
        });
        
        // 更新家庭信息（如果需要）
        if (event.userInfo || needUpdate) {
          const updateData = {
            updateTime: db.serverDate()
          };
          
          if (needUpdate) {
            updateData.children = updatedChildren;
          }
          
          await db.collection('families').doc(user.familyId).update({
            data: updateData
          });
        }
      }
    } else {
      // 没有家庭，检查并更新用户中的小朋友数据
      
      // 检查并初始化每个小朋友的数据
      let needUpdate = false;
      
      const updatedChildren = (user.children || []).map(child => {
        let changed = false;
        
        // 如果没有 subjects 数组，添加空数组
        if (!child.subjects) {
          child = { ...child, subjects: [] };
          changed = true;
        }
        
        // 如果没有 rewards 数组，添加空数组
        if (!child.rewards) {
          child = { ...child, rewards: [] };
          changed = true;
        }
        
        // 如果没有 violations 数组，添加空数组
        if (!child.violations) {
          child = { ...child, violations: [] };
          changed = true;
        }
        
        if (changed) {
          needUpdate = true;
        }
        
        return child;
      });
      
      // 更新用户信息（如果有）
      if (event.userInfo || needUpdate) {
        const updateData = {
          updateTime: db.serverDate()
        };
        
        if (event.userInfo) {
          if (event.userInfo.nickName) {
            updateData.nickName = event.userInfo.nickName;
          }
          if (event.userInfo.avatarUrl) {
            updateData.avatarUrl = event.userInfo.avatarUrl;
          }
          if (event.userInfo.phoneNumber) {
            updateData.phoneNumber = event.userInfo.phoneNumber;
          }
          if (wxContext.UNIONID) {
            updateData.unionId = wxContext.UNIONID;
          }
        }
        
        if (needUpdate) {
          updateData.children = updatedChildren;
        }
        
        await db.collection('users').doc(userId).update({
          data: updateData
        });
      }
    }
  }

  // 获取完整的用户信息返回
  const updatedUserRes = await db.collection('users').doc(userId).get();
  let userInfo = updatedUserRes.data;

  // 如果用户有家庭，加载家庭数据
  if (userInfo.familyId) {
    const familyRes = await db.collection('families').doc(userInfo.familyId).get();
    if (familyRes.data) {
      // 将家庭的小朋友数据合并到用户信息中返回
      userInfo = {
        ...userInfo,
        children: familyRes.data.children || []
      };
    }
  }

  return {
    openid: wxContext.OPENID,
    userId: userId,
    isNewUser: isNewUser,
    userInfo: userInfo
  };
};
