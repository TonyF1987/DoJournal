const cloud = require('wx-server-sdk');
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});
const db = cloud.database();

// 计算周期日期
function getRecurringDates(recurringDays, endType, endDate, endTimes, startDateStr) {
  const dates = [];
  
  // 确定开始日期
  let startDate;
  if (startDateStr) {
    startDate = new Date(startDateStr);
  } else {
    startDate = new Date();
  }
  startDate.setHours(0, 0, 0, 0);
  
  // 处理日期模式：截止到某个日期
  let endDay;
  if (endType === 'date') {
    endDay = new Date(endDate);
    endDay.setHours(0, 0, 0, 0);
    // 遍历直到日期
    let currentDate = new Date(startDate);
    while (currentDate <= endDay) {
      const dayOfWeek = currentDate.getDay();
      if (recurringDays.includes(dayOfWeek)) {
        dates.push(formatDate(currentDate));
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }
  } else {
    // 次数模式：生成指定次数的作业（包含开始日期那天）
    let targetCount;
    if (endType === 'times') {
      targetCount = endTimes;
    } else {
        // 默认设置半年的最大可能（约180天）
        targetCount = 180;
      }
      
      let currentDate = new Date(startDate);
      while (dates.length < targetCount) {
        const dayOfWeek = currentDate.getDay();
        if (recurringDays.includes(dayOfWeek)) {
          dates.push(formatDate(currentDate));
        }
        currentDate.setDate(currentDate.getDate() + 1);
        // 防止死循环，最多找1000天
        if (dates.length === 0 && currentDate.getTime() - startDate.getTime() > 1000 * 60 * 60 * 24 * 1000) {
          break;
        }
      }
  }
  
  return dates;
}

// 格式化日期
function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const { title, content, type, recurring, recurringDays, recurringEndType, recurringEndDate, recurringEndTimes, images, points, subject, date, childId } = event;

  // 获取用户信息，获取当前小朋友ID
  let currentChildId = childId;
  if (!currentChildId) {
    const userRes = await db.collection('users').where({
      _openid: wxContext.OPENID
    }).get();
    if (userRes.data.length > 0) {
      currentChildId = userRes.data[0].currentChildId;
    }
  }

  if (!recurring) {
    // 非周期作业
    let homeworkDate;
    if (date) {
      homeworkDate = new Date(date);
      homeworkDate = new Date(homeworkDate.getTime() + 8 * 60 * 60 * 1000);
    } else {
      homeworkDate = new Date();
      homeworkDate.setHours(0, 0, 0, 0);
    }

    const res = await db.collection('homework').add({
      data: {
        _openid: wxContext.OPENID,
        childId: currentChildId || '',
        title: title,
        content: content,
        type: type,
        recurring: false,
        recurringDays: [],
        recurringEndType: '',
        recurringEndDate: '',
        recurringEndTimes: 0,
        images: images || [],
        subject: subject || '',
        status: 'pending',
        points: points || 10,
        homeworkDate: date || '',
        checkInTime: null,
        createTime: db.serverDate(),
        updateTime: db.serverDate()
      }
    });

    return {
      success: true,
      homeworkId: res._id,
      count: 1
    };
  } else {
    console.log('创建周期作业，参数:', {
      recurringDays, recurringEndType, recurringEndDate, recurringEndTimes
    });
    
    // 周期作业 - 创建所有日期的作业
    const recurringDates = getRecurringDates(recurringDays, recurringEndType, recurringEndDate, recurringEndTimes, date);
    
    console.log('计算出的周期日期:', recurringDates);
    
    if (recurringDates.length === 0) {
      return {
        success: false,
        errMsg: '没有有效的周期日期'
      };
    }
    
    // 生成一个批次ID，同一批周期作业共享这个ID
    const batchId = Date.now() + '_' + Math.random().toString(36).substr(2, 9);

    let createdCount = 0;
    let mainHomeworkId = null;

    for (let i = 0; i < recurringDates.length; i++) {
      const homeworkData = {
        _openid: wxContext.OPENID,
        childId: currentChildId || '',
        title: title,
        content: content,
        type: type,
        recurring: true, // 所有都是周期作业
        recurringDays: recurringDays || [],
        recurringEndType: recurringEndType || 'never',
        recurringEndDate: recurringEndDate || '',
        recurringEndTimes: recurringEndTimes || 0,
        recurringBatchId: batchId, // 批次ID，用于删除同一批
        images: images || [],
        subject: subject || '',
        status: 'pending',
        points: points || 10,
        homeworkDate: recurringDates[i],
        checkInTime: null,
        createTime: db.serverDate(),
        updateTime: db.serverDate()
      };

      const res = await db.collection('homework').add({
        data: homeworkData
      });
      
      if (i === 0) {
        mainHomeworkId = res._id;
      }
      
      createdCount++;
    }

    console.log(`周期作业创建完成，共创建 ${createdCount} 个作业，批次ID:`, batchId);

    return {
      success: true,
      homeworkId: mainHomeworkId,
      count: createdCount,
      dates: recurringDates
    };
  }
};
