const cloud = require('wx-server-sdk');
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});
const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const { homeworkId, deleteMode = 'single' } = event;

  if (!homeworkId) {
    return {
      success: false,
      errMsg: '作业ID不能为空'
    };
  }

  try {
    const homeworkRes = await db.collection('homework').doc(homeworkId).get();
    const homework = homeworkRes.data;

    if (!homework) {
      return {
        success: false,
        errMsg: '作业不存在'
      };
    }

    if (homework._openid !== wxContext.OPENID) {
      return {
        success: false,
        errMsg: '无权限删除此作业'
      };
    }

    console.log('删除作业:', {
      homeworkId,
      deleteMode,
      isRecurring: homework.recurring,
      title: homework.title,
      homeworkDate: homework.homeworkDate
    });

    if (deleteMode === 'all') {
      console.log('执行删除所有周期作业');
      
      // 删除同一批的周期作业：
      // 优先使用 recurringBatchId（新创建的有这个字段）
      // 如果没有，再用周期属性匹配（兼容旧数据）
      
      if (homework.recurringBatchId) {
        // 有批次ID，用批次ID匹配最准确
        const query = {
          _openid: wxContext.OPENID,
          recurringBatchId: homework.recurringBatchId
        };
        
        const allHomeworkRes = await db.collection('homework').where(query).get();
        
        console.log('通过批次ID找到匹配的作业数量:', allHomeworkRes.data.length);
        
        if (allHomeworkRes.data.length > 0) {
          const deletePromises = allHomeworkRes.data.map(hw => 
            db.collection('homework').doc(hw._id).remove()
          );
          await Promise.all(deletePromises);
          
          return {
            success: true,
            count: allHomeworkRes.data.length
          };
        }
      } else if (homework.recurring) {
        // 没有批次ID但有周期属性，用周期属性匹配（兼容旧数据）
        const query = {
          _openid: wxContext.OPENID,
          childId: homework.childId || '',
          title: homework.title,
          subject: homework.subject || '',
          content: homework.content,
          recurringDays: homework.recurringDays || []
        };
        
        // 加上结束类型匹配，避免错删
        if (homework.recurringEndType) {
          query.recurringEndType = homework.recurringEndType;
        }
        if (homework.recurringEndDate) {
          query.recurringEndDate = homework.recurringEndDate;
        }
        if (homework.recurringEndTimes) {
          query.recurringEndTimes = homework.recurringEndTimes;
        }

        const allHomeworkRes = await db.collection('homework').where(query).get();
        
        console.log('通过周期属性找到匹配的作业数量:', allHomeworkRes.data.length);
        
        if (allHomeworkRes.data.length > 0) {
          const deletePromises = allHomeworkRes.data.map(hw => 
            db.collection('homework').doc(hw._id).remove()
          );
          await Promise.all(deletePromises);
          
          return {
            success: true,
            count: allHomeworkRes.data.length
          };
        }
      } else {
        // 不是周期作业，只删除这一条
        console.log('这不是周期作业，只删除当前一条');
      }
    } else if (deleteMode === 'single-convert') {
      console.log('执行删除并转换为普通作业:', homeworkId);
      
      if (homework.recurringBatchId) {
        // 找到同一批次的所有作业
        const query = {
          _openid: wxContext.OPENID,
          recurringBatchId: homework.recurringBatchId
        };
        
        const allHomeworkRes = await db.collection('homework').where(query).get();
        const allHomework = allHomeworkRes.data;
        
        console.log('找到同一批次作业数量:', allHomework.length);
        
        // 1. 先更新其他作业，清除周期设置
        const updatePromises = allHomework
          .filter(hw => hw._id !== homeworkId)
          .map(hw => {
            return db.collection('homework').doc(hw._id).update({
              data: {
                recurring: false,
                recurringDays: [],
                recurringEndType: '',
                recurringEndDate: '',
                recurringEndTimes: 0,
                recurringBatchId: ''
              }
            });
          });
        
        await Promise.all(updatePromises);
        
        // 2. 删除当前作业
        await db.collection('homework').doc(homeworkId).remove();
        
        return {
          success: true,
          count: 1,
          convertedCount: updatePromises.length
        };
      } else if (homework.recurring) {
        // 没有批次ID但有周期属性，先尝试找到其他作业（兼容旧数据）
        const query = {
          _openid: wxContext.OPENID,
          childId: homework.childId || '',
          title: homework.title,
          subject: homework.subject || '',
          content: homework.content,
          recurringDays: homework.recurringDays || []
        };
        
        if (homework.recurringEndType) {
          query.recurringEndType = homework.recurringEndType;
        }
        if (homework.recurringEndDate) {
          query.recurringEndDate = homework.recurringEndDate;
        }
        if (homework.recurringEndTimes) {
          query.recurringEndTimes = homework.recurringEndTimes;
        }

        const allHomeworkRes = await db.collection('homework').where(query).get();
        const allHomework = allHomeworkRes.data;
        
        console.log('通过周期属性找到作业数量:', allHomework.length);
        
        // 1. 更新其他作业，清除周期设置
        const updatePromises = allHomework
          .filter(hw => hw._id !== homeworkId)
          .map(hw => {
            return db.collection('homework').doc(hw._id).update({
              data: {
                recurring: false,
                recurringDays: [],
                recurringEndType: '',
                recurringEndDate: '',
                recurringEndTimes: 0
              }
            });
          });
        
        await Promise.all(updatePromises);
        
        // 2. 删除当前作业
        await db.collection('homework').doc(homeworkId).remove();
        
        return {
          success: true,
          count: 1,
          convertedCount: updatePromises.length
        };
      } else {
        // 不是周期作业，只删除这一条
        console.log('这不是周期作业，只删除当前一条');
        await db.collection('homework').doc(homeworkId).remove();
        return {
          success: true,
          count: 1
        };
      }
    }

    // 默认只删除当前这一个作业
    console.log('仅删除单个作业:', homeworkId, '日期:', homework.homeworkDate);
    await db.collection('homework').doc(homeworkId).remove();

    return {
      success: true,
      count: 1
    };
  } catch (err) {
    console.error('删除作业失败:', err);
    return {
      success: false,
      errMsg: err.message || '删除失败'
    };
  }
};
