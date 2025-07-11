const Anthropic = require('@anthropic-ai/sdk');

const anthropic = new Anthropic({
  apiKey: process.env.CLAUDE_API_KEY,
});

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const { content } = req.body;
    
    if (!content) {
      return res.status(400).json({ 
        success: false, 
        message: '분석할 내용이 필요합니다.' 
      });
    }

    // Claude로 채팅 내용 분석
    const response = await anthropic.messages.create({
      model: "claude-3-haiku-20240307",
      max_tokens: 1000,
      messages: [{
  role: "user",
  content: `다음 대화를 시간순으로 분석하여 주요 진행과정, 기술적 문제와 해결책을 중심으로 정리해주세요:

대화 내용:
${content}

분석할 때 다음을 포함해주세요:
1. 전체 프로젝트의 목적과 목표
2. 사용된 주요 기술 스택들  
3. 발생한 문제들과 해결 방법
4. 최종 성취한 결과
5. 핵심 배운 점들

JSON 형식으로만 반환하세요:
{
  "title": "프로젝트 제목 (목적 중심으로)",
  "summary": "시간순 진행과정과 주요 성과 (300자 이내)", 
  "category": "tech|project|career|study|personal|other 중 하나",
  "tags": ["구체적인 기술명과 키워드들"],
  "key_insights": ["기술적 배운점과 중요한 발견들"],
  "action_items": ["완성된 것과 다음 할 일들"]
}

JSON만 반환하고 다른 설명은 하지 마세요.`
}]
    });

    const analysisText = response.content[0].text;
    
    let analysis;
    try {
      analysis = JSON.parse(analysisText);
    } catch (parseError) {
      analysis = {
        title: "채팅 분석",
        summary: "분석 중 오류 발생", 
        category: "other",
        tags: ["채팅"],
        key_insights: ["분석 재시도 필요"],
        action_items: ["내용 확인 후 재분석"]
      };
    }
    
    res.json({
      success: true,
      message: 'Claude 분석이 완료되었습니다.',
      data: analysis
    });
  } catch (error) {
    console.error('Claude 분석 오류:', error);
    res.status(500).json({
      success: false,
      message: 'Claude 분석 중 오류가 발생했습니다.',
      error: error.message
    });
  }
};

// const OpenAI = require('openai');

// const openai = new OpenAI({
//   apiKey: process.env.OPENAI_API_KEY
// });

// module.exports = async (req, res) => {
//   if (req.method !== 'POST') {
//     return res.status(405).json({ message: 'Method not allowed' });
//   }

//   try {
//     const { content } = req.body;
    
//     if (!content) {
//       return res.status(400).json({ 
//         success: false, 
//         message: '분석할 내용이 필요합니다.' 
//       });
//     }

//     // GPT로 채팅 내용 분석
//     const response = await openai.chat.completions.create({
//       model: "gpt-4o-mini",
//       messages: [{
//         role: "user",
//         content: `다음 Claude 채팅 내용을 분석해서 JSON 형태로 반환해주세요:

// 채팅 내용:
// ${content}

// 다음 형식으로 분석해주세요:
// {
//   "title": "적절한 제목 (50자 이내)",
//   "summary": "핵심 내용 요약 (200자 이내)", 
//   "category": "career|tech|personal|study|project|other 중 하나",
//   "tags": ["관련", "키워드", "배열"],
//   "key_insights": ["핵심 깨달음이나 인사이트들"],
//   "action_items": ["실행해야 할 구체적인 액션 아이템들"]
// }

// JSON만 반환하고 다른 설명은 하지 마세요.`
//       }],
//       temperature: 0.3
//     });

//     const analysisText = response.choices[0].message.content;
    
//     let analysis;
//     try {
//       analysis = JSON.parse(analysisText);
//     } catch (parseError) {
//       // JSON 파싱 실패 시 기본값
//       analysis = {
//         title: "AI 분석 제목",
//         summary: "AI 분석 요약", 
//         category: "other",
//         tags: ["AI", "분석"],
//         key_insights: ["AI 분석 중 오류 발생"],
//         action_items: ["수동으로 내용을 정리해주세요"]
//       };
//     }
    
//     res.json({
//       success: true,
//       message: 'AI 분석이 완료되었습니다.',
//       data: analysis
//     });
//   } catch (error) {
//     console.error('AI 분석 오류:', error);
//     res.status(500).json({
//       success: false,
//       message: 'AI 분석 중 오류가 발생했습니다.',
//       error: error.message
//     });
//   }
// };