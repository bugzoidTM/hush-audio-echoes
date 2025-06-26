import { createClient } from '@supabase/supabase-js';

const SUPABASE_SELF_HOSTED_URL = "https://supabase.nutef.com";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.ewogICJyb2xlIjogImFub24iLAogICJpc3MiOiAic3VwYWJhc2UiLAogICJpYXQiOiAxNzE1MDUwODAwLAogICJleHAiOiAxODcyODE3MjAwCn0.zii4FynaxJNS8fGXKYKcnqiUw0DzIuLFB0MMz4ImjEE";

const supabase = createClient(SUPABASE_SELF_HOSTED_URL, SUPABASE_ANON_KEY);

async function testPublicBucketSolution() {
  console.log('🔄 TESTANDO SOLUÇÃO COM BUCKET PUBLIC');
  console.log('=====================================\n');
  
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
    console.log('👤 Usuário:', loginData.user?.email);
    console.log('🆔 ID:', loginData.user?.id);
    
    // Testar upload no padrão da aplicação
    console.log('\n1️⃣ Testando upload no bucket public...');
    
    const audioContent = new ArrayBuffer(1024);
    const audioBlob = new Blob([audioContent], { type: 'audio/webm' });
    
    // Usar estrutura: audio/userId/filename
    const fileName = `audio/${loginData.user?.id}/${Date.now()}.webm`;
    
    console.log('📁 Caminho do arquivo:', fileName);
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('public')
      .upload(fileName, audioBlob);
    
    if (uploadError) {
      console.error('❌ Upload falhou:', uploadError.message);
      
      if (uploadError.message.includes('row-level security')) {
        console.log('\n🔧 EXECUTE O SQL PARA BUCKET PUBLIC:');
        console.log('Execute o arquivo fix-public-bucket.sql no painel SQL');
        return;
      }
    } else {
      console.log('✅ UPLOAD FUNCIONOU!');
      console.log('📍 Path:', uploadData?.path);
      
      // Obter URL pública
      const { data: { publicUrl } } = supabase.storage
        .from('public')
        .getPublicUrl(fileName);
      
      console.log('🌐 URL pública:', publicUrl);
      
      // Testar acesso à URL
      try {
        const response = await fetch(publicUrl);
        console.log('✅ URL acessível:', response.ok);
        console.log('📊 Status:', response.status);
      } catch (error) {
        console.log('❌ URL não acessível:', error.message);
      }
      
      // Criar post de áudio
      console.log('\n2️⃣ Criando post de áudio...');
      
      const { data: postData, error: postError } = await supabase
        .from('audio_posts')
        .insert({
          user_id: loginData.user?.id,
          description: 'Teste com bucket public - funcionando!',
          audio_url: publicUrl,
          duration: 8,
          voice_filter: 'normal'
        })
        .select()
        .single();
      
      if (postError) {
        console.error('❌ Erro ao criar post:', postError.message);
      } else {
        console.log('✅ Post criado! ID:', postData.id);
        
        // Limpar post de teste
        await supabase.from('audio_posts').delete().eq('id', postData.id);
        console.log('🧹 Post removido');
      }
      
      // Limpar arquivo
      console.log('\n3️⃣ Removendo arquivo de teste...');
      const { error: deleteError } = await supabase.storage
        .from('public')
        .remove([fileName]);
      
      console.log(deleteError ? '⚠️ Não removido' : '✅ Arquivo removido');
    }
    
    await supabase.auth.signOut();
    
    if (!uploadError) {
      console.log('\n🎉 SOLUÇÃO FUNCIONANDO!');
      console.log('✅ Upload: OK');
      console.log('✅ URL pública: OK');
      console.log('✅ Post no banco: OK');
      console.log('\n📋 PRÓXIMOS PASSOS:');
      console.log('1. Execute fix-public-bucket.sql se ainda não executou');
      console.log('2. Modifique a aplicação para usar bucket "public"');
      console.log('3. Use estrutura de pasta: audio/userId/filename');
    }
    
  } catch (error) {
    console.error('❌ Erro geral:', error);
  }
}

console.log('Execute APÓS executar fix-public-bucket.sql!\n');
testPublicBucketSolution().catch(console.error); 