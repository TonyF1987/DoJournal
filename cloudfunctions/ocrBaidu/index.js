// 百度云函数入口文件
const cloud = require('wx-server-sdk')
const axios = require('axios')
const qs = require('querystring')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

// 获取百度OCR Access Token
async function getAccessToken() {
  const API_KEY = process.env.BAIDU_OCR_API_KEY || ''
  const SECRET_KEY = process.env.BAIDU_OCR_SECRET_KEY || ''

  if (!API_KEY || !SECRET_KEY) {
    throw new Error('百度OCR凭证未配置，请在环境变量中配置 BAIDU_OCR_API_KEY 和 BAIDU_OCR_SECRET_KEY')
  }

  try {
    const response = await axios.post(
      'https://aip.baidubce.com/oauth/2.0/token',
      qs.stringify({
        grant_type: 'client_credentials',
        client_id: API_KEY,
        client_secret: SECRET_KEY
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    )

    return response.data.access_token
  } catch (err) {
    console.error('获取AccessToken失败:', err.response?.data || err.message)
    throw new Error('获取百度OCR访问令牌失败')
  }
}

// 调用百度OCR手写文字识别
async function recognizeHandwriting(imageBase64, accessToken) {
  try {
    const response = await axios.post(
      `https://aip.baidubce.com/rest/2.0/ocr/v1/handwriting?access_token=${accessToken}`,
      qs.stringify({
        image: imageBase64,
        recognize_granularity: 'small' // 小粒度识别，更精确
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        timeout: 30000
      }
    )

    return response.data
  } catch (err) {
    console.error('手写识别API调用失败:', err.response?.data || err.message)
    throw err
  }
}

// 调用百度OCR通用文字识别（高精度版）
async function recognizeGeneral(imageBase64, accessToken) {
  try {
    const response = await axios.post(
      `https://aip.baidubce.com/rest/2.0/ocr/v1/accurate_basic?access_token=${accessToken}`,
      qs.stringify({
        image: imageBase64,
        detect_direction: 'true', // 检测文字方向
        probability: 'true' // 返回置信度
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        timeout: 30000
      }
    )

    return response.data
  } catch (err) {
    console.error('通用识别API调用失败:', err.response?.data || err.message)
    throw err
  }
}

// 图片转Base64
async function imageToBase64(imageUrl) {
  return new Promise((resolve, reject) => {
    const https = require('https')
    const http = require('http')
    
    const url = imageUrl
    const lib = url.startsWith('https') ? https : http
    
    lib.get(url, (res) => {
      const chunks = []
      res.on('data', (chunk) => chunks.push(chunk))
      res.on('end', () => {
        const buffer = Buffer.concat(chunks)
        const base64 = buffer.toString('base64')
        resolve(base64)
      })
    }).on('error', (err) => {
      reject(err)
    })
  })
}

// 主函数
exports.main = async (event, context) => {
  const { imgUrl, mode = 'auto' } = event

  try {
    console.log('开始百度OCR识别,图片URL:', imgUrl, '模式:', mode)

    // 如果imgUrl是云存储的fileID,获取临时URL
    let imageUrl = imgUrl
    if (imgUrl.startsWith('cloud://')) {
      const fileResult = await cloud.getTempFileURL({
        fileList: [imgUrl]
      })
      imageUrl = fileResult.fileList[0].tempFileURL
    }

    console.log('临时图片 URL:', imageUrl)

    // 获取Access Token
    const accessToken = await getAccessToken()
    console.log('Access Token获取成功')

    // 图片转Base64
    const imageBase64 = await imageToBase64(imageUrl)
    console.log('图片转Base64完成，长度:', imageBase64.length)

    let ocrResult

    // 根据模式选择识别方式
    if (mode === 'handwriting') {
      // 手写模式
      console.log('使用手写识别模式')
      ocrResult = await recognizeHandwriting(imageBase64, accessToken)
    } else if (mode === 'general') {
      // 通用模式（高精度）
      console.log('使用通用高精度识别模式')
      ocrResult = await recognizeGeneral(imageBase64, accessToken)
    } else {
      // 自动模式：同时调用手写和通用，合并结果
      console.log('使用自动模式，同时调用手写和通用识别')
      
      const [handwritingResult, generalResult] = await Promise.allSettled([
        recognizeHandwriting(imageBase64, accessToken),
        recognizeGeneral(imageBase64, accessToken)
      ])

      // 合并结果
      const allWords = []
      
      if (handwritingResult.status === 'fulfilled' && handwritingResult.value.words_result) {
        handwritingResult.value.words_result.forEach(item => {
          allWords.push({
            text: item.words,
            location: item.location,
            probability: item.probability?.average || 0.8,
            source: 'handwriting'
          })
        })
      }
      
      if (generalResult.status === 'fulfilled' && generalResult.value.words_result) {
        generalResult.value.words_result.forEach(item => {
          // 检查是否已存在相似位置的文字
          const isDuplicate = allWords.some(existing => 
            Math.abs(existing.location?.left - item.location?.left) < 20 &&
            Math.abs(existing.location?.top - item.location?.top) < 20
          )
          
          if (!isDuplicate) {
            allWords.push({
              text: item.words,
              location: item.location,
              probability: item.probability?.average || 0.9,
              source: 'general'
            })
          }
        })
      }
      
      // 按位置排序
      allWords.sort((a, b) => {
        const rowDiff = (a.location?.top || 0) - (b.location?.top || 0)
        if (Math.abs(rowDiff) < 20) {
          return (a.location?.left || 0) - (b.location?.left || 0)
        }
        return rowDiff
      })
      
      ocrResult = {
        words_result: allWords.map(item => ({
          words: item.text,
          location: item.location,
          probability: { average: item.probability }
        })),
        words_result_num: allWords.length,
        log_id: Date.now(),
        direction: 0
      }
    }

    console.log('OCR识别完成，结果数量:', ocrResult.words_result?.length || 0)
    
    // 转换结果格式以兼容前端
    const items = (ocrResult.words_result || []).map((item, index) => ({
      text: item.words || '',
      pos: {
        left_top: { 
          x: item.location?.left || 0, 
          y: item.location?.top || 0 
        },
        right_top: { 
          x: (item.location?.left || 0) + (item.location?.width || 0), 
          y: item.location?.top || 0 
        },
        right_bottom: { 
          x: (item.location?.left || 0) + (item.location?.width || 0), 
          y: (item.location?.top || 0) + (item.location?.height || 0) 
        },
        left_bottom: { 
          x: item.location?.left || 0, 
          y: (item.location?.top || 0) + (item.location?.height || 0) 
        }
      },
      probability: item.probability?.average || 0.9,
      source: item.source || 'baidu'
    }))

    return {
      errCode: 0,
      errMsg: 'ok',
      items: items,
      mode: mode,
      provider: 'baidu'
    }

  } catch (err) {
    console.error('百度OCR识别失败:', err)
    console.error('错误堆栈:', err.stack)

    // 判断是否是凭证未配置错误
    if (err.message && err.message.includes('百度OCR凭证未配置')) {
      return {
        errCode: -2,
        errMsg: '百度OCR凭证未配置',
        items: [],
        notice: '请在云函数环境变量中配置 BAIDU_OCR_API_KEY 和 BAIDU_OCR_SECRET_KEY'
      }
    }

    // 判断是否是服务未开通错误
    if (err.message && err.message.includes('未开通')) {
      return {
        errCode: -3,
        errMsg: '百度OCR服务未开通',
        items: [],
        notice: '请先在百度云控制台开通OCR服务'
      }
    }

    return {
      errCode: -1,
      errMsg: err.message || '百度OCR识别失败',
      items: [],
      notice: '百度OCR服务调用失败: ' + err.message
    }
  }
}