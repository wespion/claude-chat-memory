import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

console.log('환경변수 확인:');
console.log('SUPABASE_URL:', process.env.SUPABASE_URL);
console.log('SUPABASE_ANON_KEY 앞 10자:', process.env.SUPABASE_ANON_KEY?.substring(0, 10));

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

async function testBasicConnection() {
  console.log('=== Supabase 기본 연결 테스트 ===');
  
  try {
    // 가장 간단한 테스트 - 테이블 존재 확인
    const { data, error } = await supabase
      .from('chats')
      .select('count', { count: 'exact', head: true });

    console.log('쿼리 결과:', { data, error });
    
    if (error) {
      console.error('Supabase 오류:', error.message);
      console.error('오류 코드:', error.code);
      console.error('오류 상세:', error.details);
    } else {
      console.log('✅ 연결 성공! 테이블 접근 가능');
    }
    
  } catch (error) {
    console.error('❌ 예외 발생:', error);
  }
}

testBasicConnection();