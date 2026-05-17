// 云函数入口文件
const cloud = require('wx-server-sdk')
const OcrApi = require('@alicloud/ocr-api20210707')
const OpenapiClient = require('@alicloud/openapi-client')
const TeaUtil = require('@alicloud/tea-util')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

// 创建阿里云 OCR 客户端
function createAliyunOCRClient() {
  const accessKeyId = process.env.ALIYUN_OCR_ACCESS_KEY_ID || ''
  const accessKeySecret = process.env.ALIYUN_OCR_ACCESS_KEY_SECRET || ''

  if (!accessKeyId || !accessKeySecret) {
    throw new Error('阿里云 OCR 凭证未配置，请在环境变量中配置 ALIYUN_OCR_ACCESS_KEY_ID 和 ALIYUN_OCR_ACCESS_KEY_SECRET')
  }

  const config = new OpenapiClient.Config({
    accessKeyId: accessKeyId,
    accessKeySecret: accessKeySecret,
    endpoint: 'ocr-api.cn-hangzhou.aliyuncs.com'
  })

  return new OcrApi.default(config)
}

// 调用阿里云OCR服务
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const { imgUrl } = event;
  const db = cloud.database();

  try {
    // 检查是否是只读权限
    try {
      // 首先获取用户信息
      const userRes = await db.collection('users').where({
        _openid: wxContext.OPENID
      }).get();

      if (userRes.data && userRes.data.length > 0) {
        const user = userRes.data[0];

        // 如果用户有家庭，检查是否是只读
        if (user.familyId) {
          const familyRes = await db.collection('families').doc(user.familyId).get();
          
          if (familyRes.data) {
            const family = familyRes.data;
            const members = family.members || [];
            const currentMember = members.find(m => m.openid === wxContext.OPENID);
            
            if (currentMember && currentMember.readOnly) {
              return {
                errCode: -4,
                errMsg: '您只有只读权限，无法使用OCR功能',
                items: []
              };
            }
          }
        }
      }
    } catch (err) {
      console.error('检查权限失败:', err);
    }
    console.log('开始OCR识别,图片URL:', imgUrl)

    // 如果imgUrl是云存储的fileID,获取临时URL
    let imageUrl = imgUrl
    if (imgUrl.startsWith('cloud://')) {
      const fileResult = await cloud.getTempFileURL({
        fileList: [imgUrl]
      })
      imageUrl = fileResult.fileList[0].tempFileURL
    }

    console.log('临时图片 URL:', imageUrl)
    
    // 创建阿里云 OCR 客户端
    const client = createAliyunOCRClient()
        
    // 读取图片文件流
    let bodyStream = null
    if (imageUrl && imageUrl.startsWith('http')) {
      // 如果是 HTTP URL，需要先下载
      const https = require('https')
      const http = require('http')
              
      bodyStream = await new Promise((resolve, reject) => {
        const lib = imageUrl.startsWith('https') ? https : http
        lib.get(imageUrl, (res) => {
          const chunks = []
          res.on('data', (chunk) => chunks.push(chunk))
          res.on('end', () => {
            const buffer = Buffer.concat(chunks)
            console.log('图片下载完成，buffer 大小:', buffer.length)
            // 创建可读流
            const { Readable } = require('stream')
            resolve(Readable.from(buffer))
          })
        }).on('error', (err) => {
          console.error('图片下载失败:', err)
          reject(err)
        })
      })
      
      console.log('图片流已加载，类型:', typeof bodyStream)
    } else {
      console.error('无效的图片 URL:', imageUrl)
      throw new Error('无效的图片 URL: ' + imageUrl)
    }
    
    // 使用 RecognizeAllTextRequest 进行文字识别
    console.log('准备创建 OCR 请求，type: Advanced, Body 存在:', !!bodyStream)
    //console.log('OcrApi 结构:', Object.keys(OcrApi))
    
    // 直接使用 OcrApi 导出的 RecognizeAllTextRequest
    const recognizeAllTextRequest = new OcrApi.RecognizeAllTextRequest({
      type: 'Advanced',
      body: bodyStream
    })
    
    console.log('OCR 请求已创建')
    

    const runtime = new TeaUtil.RuntimeOptions({
      readTimeout: 30000,
      connectTimeout: 10000
    })

    const ocrResponse = await client.recognizeAllTextWithOptions(recognizeAllTextRequest, runtime)

    console.log('阿里云OCR完整响应:', JSON.stringify(ocrResponse, null, 2))
    
    // 调试：打印响应体结构
    console.log('OCR响应体结构分析:')
    console.log('- body存在:', !!ocrResponse.body)
    console.log('- body类型:', typeof ocrResponse.body)
    if (ocrResponse.body) {
      console.log('- body.keys:', Object.keys(ocrResponse.body))
      console.log('- data字段存在:', !!ocrResponse.body.data)
      if (ocrResponse.body.data) {
        console.log('- data类型:', Array.isArray(ocrResponse.body.data) ? '数组' : typeof ocrResponse.body.data)
        if (Array.isArray(ocrResponse.body.data) && ocrResponse.body.data.length > 0) {
          console.log('- 第一个元素结构:', Object.keys(ocrResponse.body.data[0]))
        }
      }
    }

    // 转换结果格式以兼容前端
    let items = [];
    
    // 处理RecognizeAllText的响应格式
    if (ocrResponse.body) {
      const body = ocrResponse.body;
      console.log('RecognizeAllText响应结构:', JSON.stringify(body, null, 2));
      
      // 阿里云OCR返回的data可能是小写或大写，也可能是JSON字符串
      // 优先使用 body.data（有小写的情况）
      let dataObj = body.data || body.Data;
      
      // 如果data/Data是字符串，解析它
      if (typeof dataObj === 'string') {
        try {
          dataObj = JSON.parse(dataObj);
          console.log('data解析后:', JSON.stringify(dataObj, null, 2));
        } catch (e) {
          console.error('data解析失败:', e);
        }
      }
      
      if (dataObj) {
        // 优先使用 content 字段（文字汇总）
        if (dataObj.content) {
          items = dataObj.content.split('\n').map((text, index) => ({
            text: text,
            pos: {
              left_top: { x: 0, y: 0 },
              right_top: { x: 0, y: 0 },
              right_bottom: { x: 0, y: 0 },
              left_bottom: { x: 0, y: 0 }
            }
          }));
        }
        // 次选 prism_wordsInfo 字段
        else if (dataObj.prism_wordsInfo && Array.isArray(dataObj.prism_wordsInfo)) {
          items = dataObj.prism_wordsInfo.map(wordInfo => ({
            text: wordInfo.word || '',
            pos: {
              left_top: { x: wordInfo.pos?.[0]?.x || 0, y: wordInfo.pos?.[0]?.y || 0 },
              right_top: { x: wordInfo.pos?.[1]?.x || 0, y: wordInfo.pos?.[1]?.y || 0 },
              right_bottom: { x: wordInfo.pos?.[2]?.x || 0, y: wordInfo.pos?.[2]?.y || 0 },
              left_bottom: { x: wordInfo.pos?.[3]?.x || 0, y: wordInfo.pos?.[3]?.y || 0 }
            }
          }));
        }
        // 兼容 subImages 格式（高精版返回）
        else if (dataObj.subImages && Array.isArray(dataObj.subImages)) {
          const allTexts = [];
          for (const subImg of dataObj.subImages) {
            if (subImg.blockInfo && subImg.blockInfo.blockDetails) {
              for (const block of subImg.blockInfo.blockDetails) {
                if (block.blockContent) {
                  allTexts.push(block.blockContent);
                }
              }
            }
          }
          items = allTexts.map(text => ({
            text: text,
            pos: {
              left_top: { x: 0, y: 0 },
              right_top: { x: 0, y: 0 },
              right_bottom: { x: 0, y: 0 },
              left_bottom: { x: 0, y: 0 }
            }
          }));
        }
      }
    }
    
    console.log('最终提取的items数量:', items.length)

    return {
      errCode: 0,
      errMsg: 'ok',
      items: items
    }

  } catch (err) {
    console.error('OCR识别失败:', err)
    console.error('错误堆栈:', err.stack)

    // 判断是否是凭证未配置错误
    if (err.message && err.message.includes('阿里云OCR凭证未配置')) {
      return {
        errCode: -2,
        errMsg: '阿里云OCR凭证未配置',
        items: [],
        notice: '请在云函数环境变量中配置ALIYUN_OCR_ACCESS_KEY_ID和ALIYUN_OCR_ACCESS_KEY_SECRET'
      }
    }

    // 判断是否是服务未开通错误
    if (err.code === 'ocrServiceNotOpen' || (err.message && err.message.includes('You have not activated the OCR service'))) {
      return {
        errCode: -3,
        errMsg: 'OCR服务未开通',
        items: [],
        notice: '请先在阿里云控制台开通OCR服务，或使用手动输入方式添加作业'
      }
    }

    return {
      errCode: -1,
      errMsg: err.message || 'OCR识别失败',
      items: [],
      notice: 'OCR服务调用失败: ' + err.message
    }
  }
}
