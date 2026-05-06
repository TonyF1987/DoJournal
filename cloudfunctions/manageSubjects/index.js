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
