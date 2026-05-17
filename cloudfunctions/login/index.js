const cloud = require('wx-server-sdk');
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});
const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const { account, userInfo: eventUserInfo } = event;

  // 获取用户信息（支持同一个 openid 的多个账号）
  let users = await db.collection('users').where({
    _openid: wxContext.OPENID
  }).get();

  let userId;
  let isNewUser = false;
  let user;

  if (users.data.length === 0) {
    // 新用户，创建用户记录
    const defaultChild = {
      id: Date.now().toString(),
      name: '小宝贝',
      avatarUrl: eventUserInfo ? eventUserInfo.avatarUrl : '',
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
        nickName: eventUserInfo ? eventUserInfo.nickName : '',
        avatarUrl: eventUserInfo ? eventUserInfo.avatarUrl : '',
        phoneNumber: eventUserInfo ? eventUserInfo.phoneNumber : '',
        account: account || '',
        unionId: wxContext.UNIONID || '',
        children: [defaultChild],
        currentChildId: defaultChild.id,
        createTime: db.serverDate(),
        updateTime: db.serverDate()
      }
    });
    userId = addRes._id;
    isNewUser = true;
    
    // 获取刚创建的用户信息
    const newUserRes = await db.collection('users').doc(userId).get();
    user = newUserRes.data;
  } else {
    // 如果指定了 account 则查找对应账号，否则使用第一个
    if (account) {
      const targetUser = users.data.find(u => (u.account || '') === account);
      if (targetUser) {
        userId = targetUser._id;
        user = targetUser;
      } else {
        // 如果找不到指定账号，使用第一个
        userId = users.data[0]._id;
        user = users.data[0];
      }
    } else {
      userId = users.data[0]._id;
      user = users.data[0];
    }
    
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
        if (eventUserInfo || needUpdate) {
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
      if (eventUserInfo || needUpdate) {
        const updateData = {
          updateTime: db.serverDate()
        };
        
        if (eventUserInfo) {
          if (eventUserInfo.nickName) {
            updateData.nickName = eventUserInfo.nickName;
          }
          if (eventUserInfo.avatarUrl) {
            updateData.avatarUrl = eventUserInfo.avatarUrl;
          }
          if (eventUserInfo.phoneNumber) {
            updateData.phoneNumber = eventUserInfo.phoneNumber;
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
    
    // 重新获取更新后的用户信息
    const updatedUserRes = await db.collection('users').doc(userId).get();
    user = updatedUserRes.data;
  }

  // 加载用户信息（已经获取到了 user）
  let userInfo = user;

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

  // 获取同一个 openid 下的所有账号信息
  const allUsersRes = await db.collection('users').where({
    _openid: wxContext.OPENID
  }).get();
  const allUsers = allUsersRes.data;

  // 如果当前用户没有设置 currentChildId，或者是新账号，尝试使用创建者的当前小孩
  if (!userInfo.currentChildId || isNewUser) {
    let creatorCurrentChildId = null;

    if (userInfo.familyId) {
      // 有家庭，查找家庭创建者账号
      const familyRes = await db.collection('families').doc(userInfo.familyId).get();
      if (familyRes.data) {
        const family = familyRes.data;
        const creatorMember = family.members.find(m => m.role === 'creator');
        if (creatorMember) {
          // 找到创建者账号，获取其 currentChildId
          const creatorUser = allUsers.find(u => 
            (u.account || '') === (creatorMember.account || '')
          );
          if (creatorUser && creatorUser.currentChildId) {
            creatorCurrentChildId = creatorUser.currentChildId;
          }
        }
      }
    } else {
      // 没有家庭，使用第一个账号的 currentChildId
      if (allUsers.length &gt; 0) {
        creatorCurrentChildId = allUsers[0].currentChildId;
      }
    }

    // 如果找到了创建者的当前小孩，并且该小孩存在，则使用它
    if (creatorCurrentChildId) {
      const children = userInfo.children || [];
      const childExists = children.some(c =&gt; c.id === creatorCurrentChildId);
      if (childExists) {
        // 更新当前用户的 currentChildId
        await db.collection('users').doc(userId).update({
          data: {
            currentChildId: creatorCurrentChildId,
            updateTime: db.serverDate()
          }
        });
        // 更新 userInfo
        userInfo.currentChildId = creatorCurrentChildId;
      }
    }
  }

  return {
    openid: wxContext.OPENID,
    userId: userId,
    isNewUser: isNewUser,
    userInfo: userInfo,
    allAccounts: allUsers
  };
};
