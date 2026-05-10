const cloud = require('wx-server-sdk');
const crypto = require('crypto');
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});
const db = cloud.database();
const _ = db.command;

// 密码哈希 - 使用SHA256 + 盐值
function hashPassword(password, salt = '') {
  const defaultSalt = 'do-journal-2024-secure-salt';
  const finalSalt = salt || defaultSalt;
  const hash = crypto.createHash('sha256');
  hash.update(password + finalSalt);
  return hash.digest('hex');
}

// 验证密码
function verifyPassword(password, hashedPassword, salt = '') {
  const defaultSalt = 'do-journal-2024-secure-salt';
  const finalSalt = salt || defaultSalt;
  const hash = crypto.createHash('sha256');
  hash.update(password + finalSalt);
  return hash.digest('hex') === hashedPassword;
}

// 查找用户（支持手机号或账号）
async function findUserByIdentifier(identifier) {
  // 先按手机号查找
  const userRes = await db.collection('users').where({
    phoneNumber: identifier
  }).get();
  
  if (userRes.data.length > 0) {
    return userRes.data[0];
  }
  
  // 如果没找到，再按账号查找（添加account字段支持）
  const userRes2 = await db.collection('users').where({
    account: identifier
  }).get();
  
  if (userRes2.data.length > 0) {
    return userRes2.data[0];
  }
  
  return null;
}

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const { action, phoneNumber, code, password } = event;

  try {
    if (action === 'checkUser') {
      // 检查用户是否已注册（支持手机号或账号）
      const user = await findUserByIdentifier(phoneNumber);

      return {
        success: true,
        isRegistered: !!user
      };
    }

    if (action === 'sendCode') {
      // 发送验证码（个人小程序使用模拟验证码 123456）
      // 实际项目中这里需要调用短信服务
      return {
        success: true,
        message: '验证码已发送'
      };
    }

    if (action === 'verifyCode') {
      // 验证验证码
      if (code !== '123456') {
        return {
          success: false,
          errMsg: '验证码错误'
        };
      }
      return {
        success: true
      };
    }

    if (action === 'register') {
      // 注册新用户（支持手机号或账号注册）
      const existingUser = await findUserByIdentifier(phoneNumber);

      if (existingUser) {
        return {
          success: false,
          errMsg: '该手机号或账号已注册'
        };
      }

      // 对密码进行哈希处理
      const hashedPassword = password ? hashPassword(password) : '';

      // 如果有微信授权的信息，使用微信的昵称
      const nickName = event.nickName || '微信用户';
      const avatarUrl = event.avatarUrl || '';
      
      console.log('注册用户信息:', { nickName, avatarUrl });

      // 判断是手机号还是账号
      const isPhone = /^1[3-9]\d{9}$/.test(phoneNumber);
      
      // 创建用户记录
      const addRes = await db.collection('users').add({
        data: {
          _openid: wxContext.OPENID,
          phoneNumber: isPhone ? phoneNumber : '',
          account: isPhone ? '' : phoneNumber,
          password: hashedPassword,
          nickName: nickName,
          avatarUrl: avatarUrl,
          unionId: wxContext.UNIONID || '',
          children: [],
          currentChildId: '',
          createTime: db.serverDate(),
          updateTime: db.serverDate()
        }
      });

      // 获取刚创建的用户信息
      const newUserRes = await db.collection('users').doc(addRes._id).get();

      return {
        success: true,
        userId: addRes._id,
        userInfo: newUserRes.data,
        message: '注册成功'
      };
    }

    if (action === 'loginByCode') {
      // 验证码登录
      const userRes = await db.collection('users').where({
        phoneNumber: phoneNumber
      }).get();

      if (userRes.data.length === 0) {
        return {
          success: false,
          errMsg: '该手机号未注册'
        };
      }

      if (code !== '123456') {
        return {
          success: false,
          errMsg: '验证码错误'
        };
      }

      // 更新 openid
      await db.collection('users').doc(userRes.data[0]._id).update({
        data: {
          _openid: wxContext.OPENID,
          updateTime: db.serverDate()
        }
      });

      return {
        success: true,
        userInfo: userRes.data[0],
        message: '登录成功'
      };
    }

    if (action === 'loginByPassword') {
      // 密码登录（支持手机号或账号）
      console.log('登录参数:', { 
        nickName: event.nickName, 
        avatarUrl: event.avatarUrl 
      });
      
      const user = await findUserByIdentifier(phoneNumber);

      if (!user) {
        return {
          success: false,
          errMsg: '该手机号或账号未注册'
        };
      }

      // 验证密码哈希
      if (user.password && !verifyPassword(password, user.password)) {
        return {
          success: false,
          errMsg: '密码错误'
        };
      }

      // 如果有微信昵称，更新昵称（无论是否是默认值）
      const updateData = {
        _openid: wxContext.OPENID,
        updateTime: db.serverDate()
      };
      if (event.nickName) {
        updateData.nickName = event.nickName;
      }
      if (event.avatarUrl) {
        updateData.avatarUrl = event.avatarUrl;
      }
      
      console.log('更新用户信息:', updateData);

      // 更新 openid 和可能的昵称头像
      await db.collection('users').doc(user._id).update({
        data: updateData
      });

      // 重新获取更新后的用户信息
      const updatedUserRes = await db.collection('users').doc(user._id).get();
      
      const updatedUser = updatedUserRes.data;
      
      // 如果用户有家庭，同时更新家庭中的成员信息
      if (updatedUser && updatedUser.familyId && (event.nickName || event.avatarUrl)) {
        try {
          const familyRes = await db.collection('families').doc(updatedUser.familyId).get();
          if (familyRes.data) {
            const updatedMembers = familyRes.data.members.map(member => {
              if (member.openid === wxContext.OPENID) {
                return {
                  ...member,
                  nickName: event.nickName || member.nickName,
                  avatarUrl: event.avatarUrl || member.avatarUrl
                };
              }
              return member;
            });
            
            await db.collection('families').doc(updatedUser.familyId).update({
              data: {
                members: updatedMembers,
                updateTime: db.serverDate()
              }
            });
          }
        } catch (err) {
          console.error('更新家庭成员信息失败:', err);
        }
      }

      return {
        success: true,
        userInfo: updatedUser,
        message: '登录成功'
      };
    }

    if (action === 'setPassword') {
      // 设置密码
      const userRes = await db.collection('users').where({
        _openid: wxContext.OPENID
      }).get();

      if (userRes.data.length === 0) {
        return {
          success: false,
          errMsg: '用户不存在'
        };
      }

      // 对密码进行哈希处理
      const hashedPassword = password ? hashPassword(password) : '';

      await db.collection('users').doc(userRes.data[0]._id).update({
        data: {
          password: hashedPassword,
          updateTime: db.serverDate()
        }
      });

      return {
        success: true,
        message: '密码设置成功'
      };
    }

    if (action === 'updateProfile') {
      // 更新用户资料（昵称、头像）
      const userRes = await db.collection('users').where({
        _openid: wxContext.OPENID
      }).get();

      if (userRes.data.length === 0) {
        return {
          success: false,
          errMsg: '用户不存在'
        };
      }

      const updateData = {
        updateTime: db.serverDate()
      };

      if (event.nickName) {
        updateData.nickName = event.nickName;
      }
      if (event.avatarUrl) {
        updateData.avatarUrl = event.avatarUrl;
      }

      await db.collection('users').doc(userRes.data[0]._id).update({
        data: updateData
      });

      return {
        success: true,
        message: '资料更新成功'
      };
    }

    return {
      success: false,
      errMsg: '未知操作'
    };

  } catch (err) {
    console.error('认证失败:', err);
    return {
      success: false,
      errMsg: err.message || '操作失败'
    };
  }
};