const cloud = require('wx-server-sdk');
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});
const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const { action, child } = event;

  // 获取用户信息
  const userRes = await db.collection('users').where({
    _openid: wxContext.OPENID
  }).get();

  if (userRes.data.length === 0) {
    return {
      success: false,
      errMsg: '用户不存在'
    };
  }

  const user = userRes.data[0];
  const userId = user._id;

  // 检查是否有家庭
  let children, currentChildId, dataSource;
  
  if (user.familyId) {
    // 使用家庭数据
    const familyRes = await db.collection('families').doc(user.familyId).get();
    if (familyRes.data) {
      children = familyRes.data.children || [];
      currentChildId = user.currentChildId;
      dataSource = 'family';
    } else {
      children = user.children || [];
      currentChildId = user.currentChildId;
      dataSource = 'user';
    }
  } else {
    // 使用用户数据
    children = user.children || [];
    currentChildId = user.currentChildId;
    dataSource = 'user';
  }

  switch (action) {
    case 'add':
      // 添加小朋友
      const newChild = {
        id: Date.now().toString(),
        name: child.name || '小宝贝',
        avatarUrl: child.avatarUrl || '',
        gender: child.gender || '',
        birthDate: child.birthDate || '',
        schoolStage: child.schoolStage || '',
        points: 0,
        streak: 0,
        lastCheckInDate: '',
        punishedPoints: 0,
        totalPoints: 0,
        todayPoints: 0,
        weekPoints: 0,
        monthPoints: 0,
        todayConsume: 0,
        weekConsume: 0,
        monthConsume: 0,
        totalConsume: 0,
        subjects: [],
        rewards: [],
        violations: [],
        createTime: db.serverDate()
      };
      children.push(newChild);
      
      // 如果是第一个小朋友，设为当前小朋友
      if (children.length === 1) {
        currentChildId = newChild.id;
      }
      break;

    case 'update':
      // 更新小朋友信息
      const updateIndex = children.findIndex(c => c.id === child.id);
      if (updateIndex >= 0) {
        // 只更新基础信息，保留科目、积分等重要数据
        const updatedChild = {
          ...children[updateIndex],
          name: child.name !== undefined ? child.name : children[updateIndex].name,
          avatarUrl: child.avatarUrl !== undefined ? child.avatarUrl : children[updateIndex].avatarUrl,
          gender: child.gender !== undefined ? child.gender : children[updateIndex].gender,
          birthDate: child.birthDate !== undefined ? child.birthDate : children[updateIndex].birthDate,
          schoolStage: child.schoolStage !== undefined ? child.schoolStage : children[updateIndex].schoolStage,
          updateTime: db.serverDate()
        };
        children[updateIndex] = updatedChild;
      }
      break;

    case 'delete':
      // 删除小朋友（保留积分相关的数据需要考虑）
      children = children.filter(c => c.id !== child.id);
      
      // 如果删除的是当前小朋友，自动切换到第一个
      if (currentChildId === child.id && children.length > 0) {
        currentChildId = children[0].id;
      }
      break;

    case 'switch':
      // 切换当前小朋友
      const exist = children.find(c => c.id === child.id);
      if (exist) {
        currentChildId = child.id;
      }
      break;

    case 'list':
      // 返回列表，不需要更新
      return {
        success: true,
        children: children,
        currentChildId: currentChildId
      };
  }

  // 更新数据库
  if (dataSource === 'family') {
    // 更新家庭数据
    await db.collection('families').doc(user.familyId).update({
      data: {
        children: children,
        updateTime: db.serverDate()
      }
    });
    
    // 只更新用户的当前小朋友ID
    await db.collection('users').doc(userId).update({
      data: {
        currentChildId: currentChildId,
        updateTime: db.serverDate()
      }
    });
  } else {
    // 更新用户数据
    await db.collection('users').doc(userId).update({
      data: {
        children: children,
        currentChildId: currentChildId,
        updateTime: db.serverDate()
      }
    });
  }

  return {
    success: true,
    children: children,
    currentChildId: currentChildId,
    dataSource: dataSource
  };
};
