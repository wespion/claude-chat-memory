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
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const { title, content, summary, category, tags, key_insights, action_items } = req.body;
    
    // 임베딩 생성
    const searchableText = [
      title,
      summary || '',
      content,
      ...(tags || []),
      ...(key_insights || []),
      ...(action_items || []),
      category || ''
    ].filter(text => text && text.trim()).join(' ');

    const response = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: searchableText,
      encoding_format: "float"
    });

    const embedding = response.data[0].embedding;
    
    // 데이터베이스에 저장
    const { data, error } = await supabase
      .from('chats')
      .insert({
        title,
        content,
        summary,
        category,
        tags: tags || [],
        key_insights: key_insights || [],
        action_items: action_items || [],
        embedding
      })
      .select()
      .single();

    if (error) throw error;
    
    res.json({
      success: true,
      message: '채팅이 성공적으로 저장되었습니다.',
      data: {
        id: data.id,
        title: data.title,
        created_at: data.created_at
      }
    });
  } catch (error) {
    console.error('저장 오류:', error);
    res.status(500).json({
      success: false,
      message: '저장 중 오류가 발생했습니다.',
      error: error.message
    });
  }
};