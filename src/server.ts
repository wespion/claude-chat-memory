import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import * as dotenv from 'dotenv';

// 환경변수 로드
dotenv.config();

// Supabase 클라이언트 초기화
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

// OpenAI 클라이언트 초기화
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!
});

// 채팅 인터페이스
interface Chat {
  id?: string;
  title: string;
  content: string;
  summary?: string;
  category?: string;
  tags?: string[];
  key_insights?: string[];
  action_items?: string[];
  created_at?: string;
  embedding?: number[];
}

// 텍스트를 임베딩 벡터로 변환
async function createEmbedding(text: string): Promise<number[]> {
  try {
    const response = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: text,
      encoding_format: "float"
    });
    return response.data[0].embedding;
  } catch (error) {
    console.error('Embedding 생성 오류:', error);
    throw error;
  }
}

// 채팅 저장
async function saveChat(chat: Chat): Promise<string> {
  try {
    // 임베딩 생성
    const embedding = await createEmbedding(chat.summary || chat.content);
    
    // 데이터베이스에 저장
    const { data, error } = await supabase
      .from('chats')
      .insert({
        title: chat.title,
        content: chat.content,
        summary: chat.summary,
        category: chat.category,
        tags: chat.tags,
        key_insights: chat.key_insights,
        action_items: chat.action_items,
        embedding: embedding
      })
      .select()
      .single();

    if (error) throw error;
    
    console.log('채팅 저장 완료:', data.id);
    return data.id;
  } catch (error) {
    console.error('채팅 저장 오류:', error);
    throw error;
  }
}

// 관련 채팅 검색
async function searchRelatedChats(query: string, limit: number = 5): Promise<any[]> {
  try {
    // 쿼리 임베딩 생성
    const queryEmbedding = await createEmbedding(query);
    
    // 벡터 유사도 검색
    const { data, error } = await supabase.rpc('match_chats', {
      query_embedding: queryEmbedding,
      match_threshold: 0.7,
      match_count: limit
    });

    if (error) throw error;
    
    console.log(`"${query}"에 대한 관련 채팅 ${data.length}개 발견`);
    return data;
  } catch (error) {
    console.error('채팅 검색 오류:', error);
    throw error;
  }
}

// MCP 도구들
const tools = {
  save_chat: {
    name: "save_chat",
    description: "새로운 채팅을 데이터베이스에 저장합니다",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string", description: "채팅 제목" },
        content: { type: "string", description: "전체 채팅 내용" },
        summary: { type: "string", description: "채팅 요약" },
        category: { type: "string", description: "카테고리 (예: career, tech, personal)" },
        tags: { type: "array", items: { type: "string" }, description: "태그들" },
        key_insights: { type: "array", items: { type: "string" }, description: "핵심 인사이트들" },
        action_items: { type: "array", items: { type: "string" }, description: "액션 아이템들" }
      },
      required: ["title", "content"]
    }
  },
  
  search_chats: {
    name: "search_chats",
    description: "현재 질문과 관련된 이전 채팅들을 검색합니다",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "검색할 질문이나 키워드" },
        limit: { type: "number", description: "검색 결과 개수 (기본값: 5)" }
      },
      required: ["query"]
    }
  }
};

// MCP 서버 메인 함수
async function handleToolCall(toolName: string, args: any) {
  switch (toolName) {
    case 'save_chat':
      return await saveChat(args);
      
    case 'search_chats':
      return await searchRelatedChats(args.query, args.limit || 5);
      
    default:
      throw new Error(`알 수 없는 도구: ${toolName}`);
  }
}

// 테스트 함수
async function test() {
  console.log('=== MCP 서버 테스트 시작 ===');
  
  try {
    // 테스트 채팅 저장
    const testChat: Chat = {
      title: "진로 고민 테스트",
      content: "개발자와 기획자 사이에서 고민하고 있습니다. 어떤 길이 맞을까요?",
      summary: "개발 vs 기획 진로 고민",
      category: "career",
      tags: ["진로", "개발", "기획"],
      key_insights: ["두 분야 모두 장단점이 있음"],
      action_items: ["더 많은 정보 수집 필요"]
    };
    
    console.log('1. 테스트 채팅 저장 중...');
    const chatId = await saveChat(testChat);
    console.log('✅ 저장 완료, ID:', chatId);
    
    // 잠시 대기 (임베딩 처리 시간)
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    console.log('2. 관련 채팅 검색 중...');
    const results = await searchRelatedChats("개발자 진로에 대해 고민");
    console.log('✅ 검색 완료:', results.length, '개 결과');
    
    results.forEach((result, index) => {
      console.log(`  ${index + 1}. ${result.title} (유사도: ${result.similarity?.toFixed(3)})`);
    });
    
  } catch (error) {
    console.error('❌ 테스트 실패:', error);
  }
  
  console.log('=== 테스트 완료 ===');
}

// 스크립트 직접 실행 시 테스트 실행
if (require.main === module) {
  test();
}

export { handleToolCall, tools, saveChat, searchRelatedChats };