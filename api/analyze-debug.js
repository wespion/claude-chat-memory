const Anthropic = require('@anthropic-ai/sdk');

module.exports = async (req, res) => {
  try {
    // 환경변수 확인
    if (!process.env.CLAUDE_API_KEY) {
      return res.json({ error: 'Claude API key missing' });
    }
    
    // 간단한 테스트
    const anthropic = new Anthropic({
      apiKey: process.env.CLAUDE_API_KEY,
    });

    const response = await anthropic.messages.create({
      model: "claude-3-haiku-20240307",
      max_tokens: 100,
      messages: [{
        role: "user",
        content: "Hello, just say 'working'"
      }]
    });

    res.json({ 
      success: true, 
      response: response.content[0].text,
      api_key_prefix: process.env.CLAUDE_API_KEY?.substring(0, 10)
    });
  } catch (error) {
    res.json({ error: error.message, stack: error.stack });
  }
};