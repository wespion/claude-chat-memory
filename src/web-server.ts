import express from 'express';
import cors from 'cors';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import * as dotenv from 'dotenv';

// 환경변수 로드
dotenv.config();

// 클라이언트 초기화
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!
});

const app = express();
const PORT = 3000;

// 미들웨어
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// 임베딩 생성 함수
async function createEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
    encoding_format: "float"
  });
  return response.data[0].embedding;
}

// API 라우트들

// 채팅 저장
app.post('/api/save-chat', async (req, res) => {
  try {
    const { title, content, summary, category, tags, key_insights, action_items } = req.body;
    
    if (!title || !content) {
      return res.status(400).json({ 
        success: false, 
        message: '제목과 내용은 필수입니다.' 
      });
    }

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

const embedding = await createEmbedding(searchableText);
    
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
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

// 채팅 검색
app.get('/api/search-chats', async (req, res) => {
  try {
    const { q: query, limit = 5, threshold = 0.5 } = req.query;
    
    if (!query || typeof query !== 'string') {
      return res.status(400).json({
        success: false,
        message: '검색어가 필요합니다.'
      });
    }

    // 쿼리 임베딩 생성
    const queryEmbedding = await createEmbedding(query);
    
    // 벡터 유사도 검색
    const { data, error } = await supabase.rpc('match_chats', {
      query_embedding: queryEmbedding,
      match_threshold: parseFloat(threshold as string),
      match_count: parseInt(limit as string)
    });

    if (error) throw error;
    
    res.json({
      success: true,
      message: `"${query}"에 대한 검색 결과입니다.`,
      data: data.map((chat: any) => ({
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
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

// 모든 채팅 목록
app.get('/api/chats', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('chats')
      .select('id, title, summary, category, tags, created_at')
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) throw error;
    
    res.json({
      success: true,
      data
    });
  } catch (error) {
    console.error('목록 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '목록 조회 중 오류가 발생했습니다.'
    });
  }
});

// 특정 채팅 상세 조회
app.get('/api/chats/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const { data, error } = await supabase
      .from('chats')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    
    if (!data) {
      return res.status(404).json({
        success: false,
        message: '채팅을 찾을 수 없습니다.'
      });
    }
    
    res.json({
      success: true,
      data
    });
  } catch (error) {
    console.error('상세 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '상세 조회 중 오류가 발생했습니다.'
    });
  }
});

// 북마클릿용 POST 엔드포인트
app.post('/api/save-from-bookmarklet', async (req, res) => {
  try {
    const { title, content } = req.body;
    
    // HTML 페이지에 데이터 미리 입력해서 반환
    const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <script>
        window.onload = function() {
          window.opener.postMessage({
            type: 'BOOKMARKLET_DATA',
            title: ${JSON.stringify(title)},
            content: ${JSON.stringify(content)}
          }, 'https://claude-chat-memory-mm1l.vercel.app');
          window.close();
        }
      </script>
    </head>
    <body>데이터 전송 중...</body>
    </html>`;
    
    res.send(html);
  } catch (error) {
    res.status(500).send('오류가 발생했습니다.');
  }
});

// 서버 시작
app.listen(PORT, () => {
  console.log(`🚀 서버가 http://localhost:${PORT} 에서 실행 중입니다!`);
  console.log(`💾 채팅 저장: POST /api/save-chat`);
  console.log(`🔍 채팅 검색: GET /api/search-chats?q=검색어`);
  console.log(`📋 채팅 목록: GET /api/chats`);
});

// AI 자동 분석 엔드포인트
app.post('/api/analyze-chat', async (req, res) => {
  try {
    const { content } = req.body;
    
    if (!content) {
      return res.status(400).json({ 
        success: false, 
        message: '분석할 내용이 필요합니다.' 
      });
    }

    // GPT로 채팅 내용 분석
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{
        role: "user",
        content: `다음 Claude 채팅 내용을 분석해서 JSON 형태로 반환해주세요:

채팅 내용:
${content}

다음 형식으로 분석해주세요:
{
  "title": "적절한 제목 (50자 이내)",
  "summary": "핵심 내용 요약 (200자 이내)", 
  "category": "career|tech|personal|study|project|other 중 하나",
  "tags": ["관련", "키워드", "배열"],
  "key_insights": ["핵심 깨달음이나 인사이트들"],
  "action_items": ["실행해야 할 구체적인 액션 아이템들"]
}

JSON만 반환하고 다른 설명은 하지 마세요.`
      }],
      temperature: 0.3
    });

    const analysisText = response.choices[0].message.content;
    let analysis;
try {
  analysis = JSON.parse(analysisText);
} catch (parseError) {
  // JSON 파싱 실패 시 기본값
  analysis = {
    title: "AI 분석 제목",
    summary: "AI 분석 요약", 
    category: "other",
    tags: ["AI", "분석"],
    key_insights: ["AI 분석 중 오류 발생"],
    action_items: ["수동으로 내용을 정리해주세요"]
  };
}
    
    res.json({
      success: true,
      message: 'AI 분석이 완료되었습니다.',
      data: analysis
    });
  } catch (error) {
    console.error('AI 분석 오류:', error);
    res.status(500).json({
      success: false,
      message: 'AI 분석 중 오류가 발생했습니다.',
      error: error instanceof Error ? error.message : String(error)
    });
  }
});