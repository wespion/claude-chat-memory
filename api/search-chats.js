const { createClient } = require('@supabase/supabase-js');
const OpenAI = require('openai');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const { q: query, limit = 5, threshold = 0.5 } = req.query;
    
    if (!query) {
      return res.status(400).json({
        success: false,
        message: '검색어가 필요합니다.'
      });
    }

    // 쿼리 임베딩 생성
    const response = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: query,
      encoding_format: "float"
    });

    const queryEmbedding = response.data[0].embedding;
    
    // 벡터 유사도 검색
    const { data, error } = await supabase.rpc('match_chats', {
      query_embedding: queryEmbedding,
      match_threshold: parseFloat(threshold),
      match_count: parseInt(limit)
    });

    if (error) throw error;
    
    res.json({
      success: true,
      message: `"${query}"에 대한 검색 결과입니다.`,
      data: data.map((chat) => ({
        id: chat.id,
        title: chat.title,
        summary: chat.summary || chat.content.substring(0, 100) + '...',
        category: chat.category,
        tags: chat.tags,
        key_insights: chat.key_insights,
        action_items: chat.action_items,
        created_at: chat.created_at,
        similarity: Math.round(chat.similarity * 100) / 100
      }))
    });
  } catch (error) {
    console.error('검색 오류:', error);
    res.status(500).json({
      success: false,
      message: '검색 중 오류가 발생했습니다.',
      error: error.message
    });
  }
};