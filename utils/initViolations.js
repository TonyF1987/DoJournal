// 违规行为数据库初始化脚本
// 这是一些常见的违规行为示例，您可以根据需要自定义

const db = wx.cloud.database();

// 默认违规行为数据
const defaultViolations = [
  {
    name: '迟到',
    points: 5,
    icon: '⚠️',
    description: '上学迟到或不按时完成作业',
    isCustom: false,
    createTime: db.serverDate()
  },
  {
    name: '未完成作业',
    points: 10,
    icon: '❌',
    description: '未按时完成指定作业',
    isCustom: false,
    createTime: db.serverDate()
  },
  {
    name: '不认真听讲',
    points: 5,
    icon: '😠',
    description: '上课不认真听讲或注意力不集中',
    isCustom: false,
    createTime: db.serverDate()
  },
  {
    name: '忘记带物品',
    points: 5,
    icon: '💢',
    description: '忘记带课本、文具或其他必要物品',
    isCustom: false,
    createTime: db.serverDate()
  },
  {
    name: '表现差',
    points: 20,
    icon: '🚫',
    description: '整体表现不佳或存在严重行为问题',
    isCustom: false,
    createTime: db.serverDate()
  }
];

// 初始化违规行为数据库
async function initViolations() {
  // 检查是否已初始化
  const existing = await db.collection('violations').count();
  if (existing.total > 0) {
    console.log('违规行为数据库已初始化');
    return;
  }

  // 批量添加默认违规行为
  const addPromises = defaultViolations.map(violation => 
    db.collection('violations').add({ data: violation })
  );

  await Promise.all(addPromises);
  console.log('违规行为数据库初始化成功');
}

// 导出初始化函数
module.exports = {
  initViolations,
  defaultViolations
};