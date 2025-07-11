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