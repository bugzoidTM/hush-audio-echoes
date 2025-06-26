import { createClient } from '@supabase/supabase-js';

const SUPABASE_SELF_HOSTED_URL = "https://supabase.nutef.com";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.ewogICJyb2xlIjogImFub24iLAogICJpc3MiOiAic3VwYWJhc2UiLAogICJpYXQiOiAxNzE1MDUwODAwLAogICJleHAiOiAxODcyODE3MjAwCn0.zii4FynaxJNS8fGXKYKcnqiUw0DzIuLFB0MMz4ImjEE";

const supabase = createClient(SUPABASE_SELF_HOSTED_URL, SUPABASE_ANON_KEY);

async function testWithWorkingBucket() {
  console.log('🔄 TESTANDO COM BUCKET QUE FUNCIONA');
  console.log('==================================\n');
  
  try {
    // Login
    const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
      email: 'testaudio1750945549380@nutef.com',
      password: 'TesteAudio123!'
    });
    
    if (loginError) {
      console.error('❌ Login falhou:', loginError.message);
      return;
    }
    
    console.log('✅ Login realizado');
    
    // Testar upload no bucket audio-posts
    console.log('\n1️⃣ Testando upload no bucket "audio-posts"...');
    
    const testContent = 'Test audio in audio-posts bucket';
    const testBlob = new Blob([testContent], { type: 'audio/webm' });
    const fileName = `${loginData.user?.id}/test-audio-posts-${Date.now()}.webm`;
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('audio-posts')
      .upload(fileName, testBlob);
    
    if (uploadError) {
      console.error('❌ Upload falhou no audio-posts:', uploadError.message);
    } else {
      console.log('✅ UPLOAD FUNCIONOU no bucket "audio-posts"!');
      console.log('📍 Path:', uploadData?.path);
      
      // Obter URL pública
      const { data: { publicUrl } } = supabase.storage
        .from('audio-posts')
        .getPublicUrl(fileName);
      
      console.log('🌐 URL pública:', publicUrl);
      
      // Testar se a URL é acessível
      try {
        const response = await fetch(publicUrl);
        console.log('✅ URL acessível:', response.ok);
      } catch (error) {
        console.log('❌ URL não acessível:', error.message);
      }
      
      // Limpar arquivo
      await supabase.storage.from('audio-posts').remove([fileName]);
      console.log('🧹 Arquivo removido');
    }
    
    // Testar bucket public também
    console.log('\n2️⃣ Testando upload no bucket "public"...');
    
    const fileName2 = `audio/${loginData.user?.id}/test-public-${Date.now()}.webm`;
    
    const { data: uploadData2, error: uploadError2 } = await supabase.storage
      .from('public')
      .upload(fileName2, testBlob);
    
    if (uploadError2) {
      console.error('❌ Upload falhou no public:', uploadError2.message);
    } else {
      console.log('✅ UPLOAD FUNCIONOU no bucket "public"!');
      console.log('📍 Path:', uploadData2?.path);
      
      // Limpar
      await supabase.storage.from('public').remove([fileName2]);
      console.log('🧹 Arquivo removido');
    }
    
    await supabase.auth.signOut();
    
    console.log('\n💡 SOLUÇÃO TEMPORÁRIA:');
    console.log('Use o bucket "audio-posts" ou "public" até que o "audio-files" seja corrigido');
    console.log('Modifique o código da aplicação para usar um desses buckets');
    
  } catch (error) {
    console.error('❌ Erro geral:', error);
  }
}

console.log('Testando com buckets que funcionam...\n');
testWithWorkingBucket().catch(console.error); 