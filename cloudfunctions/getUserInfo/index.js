const cloud = require('wx-server-sdk');
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});
const db = cloud.database();

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const { action, account, nickName, avatarUrl } = event;
  console.log('getUserInfo 被调用，action:', action, 'account:', account);

  try {
    // 如果是更新用户资料的操作
    if (action === 'updateProfile') {
      const updateData = {};
      if (nickName) {
        updateData.nickName = nickName;
      }
      if (avatarUrl) {
        updateData.avatarUrl = avatarUrl;
      }
      
      // 查找要更新的用户（通过 account 区分）
      const usersRes = await db.collection('users').where({
        _openid: wxContext.OPENID
      }).get();
      
      if (!usersRes.data || usersRes.data.length === 0) {
        return {
          success: false,
          errMsg: '用户不存在'
        };
      }
      
      // 找到对应账号的用户
      let targetUser;
      if (account) {
        targetUser = usersRes.data.find(u => (u.account || '') === account);
      }
      if (!targetUser) {
        targetUser = usersRes.data[0];
      }
      
      // 更新用户记录
      await db.collection('users').doc(targetUser._id).update({
        data: {
          ...updateData,
          updateTime: db.serverDate()
        }
      });

      // 返回更新后的用户信息
      const updatedUserRes = await db.collection('users').doc(targetUser._id).get();
      let userInfo = updatedUserRes.data;
      
      // 如果用户有家庭，同时更新家庭中的成员信息
      if (userInfo && userInfo.familyId) {
        try {
          // 获取家庭信息
          const familyRes = await db.collection('families').doc(userInfo.familyId).get();
          
          if (familyRes.data) {
            // 更新家庭中的成员信息（使用 openid + account 联合判断）
            const updatedMembers = familyRes.data.members.map(member => {
              if (member.openid === wxContext.OPENID && member.account === (userInfo.account || '')) {
                return {
                  ...member,
                  nickName: nickName || member.nickName,
                  avatarUrl: avatarUrl || member.avatarUrl
                };
              }
              return member;
            });
            
            // 更新家庭
            await db.collection('families').doc(userInfo.familyId).update({
              data: {
                members: updatedMembers,
                updateTime: db.serverDate()
              }
            });
            
            // 加载家庭数据
            userInfo = {
              ...userInfo,
              children: familyRes.data.children || []
            };
          }
        } catch (err) {
          console.error('更新家庭成员信息失败:', err);
        }
      }

      return {
        success: true,
        userInfo: userInfo
      };
    }

    // 查找用户记录（支持同一个 openid 的多个账号）
    const usersRes = await db.collection('users').where({
      _openid: wxContext.OPENID
    }).get();

    console.log('查询到用户列表:', usersRes.data);

    if (!usersRes.data || usersRes.data.length === 0) {
      return {
        success: false,
        errMsg: '用户不存在'
      };
    }

    // 如果指定了 account 则查找对应账号，否则使用第一个
    let userInfo;
    if (account) {
      userInfo = usersRes.data.find(u => (u.account || '') === account);
      console.log('根据account查找用户:', account, '找到:', userInfo);
    }
    if (!userInfo) {
      userInfo = usersRes.data[0];
      console.log('使用第一个用户:', userInfo);
    }

    // 如果用户有家庭，加载家庭数据
    if (userInfo && userInfo.familyId) {
      try {
        const familyRes = await db.collection('families').doc(userInfo.familyId).get();
        if (familyRes.data) {
          // 将家庭的小朋友数据和成员信息合并到用户信息中
          userInfo = {
            ...userInfo,
            children: familyRes.data.children || [],
            familyMembers: familyRes.data.members || []
          };
        }
      } catch (err) {
        console.error('加载家庭数据失败:', err);
      }
    }

    console.log('getUserInfo 返回数据，userInfo:', userInfo, 'allAccounts:', usersRes.data);

    return {
      success: true,
      userInfo: userInfo,
      allAccounts: usersRes.data
    };
  } catch (err) {
    console.error('获取用户信息失败:', err);
    return {
      success: false,
      errMsg: err.message || '获取用户信息失败'
    };
  }
};
