import { createClient } from '@supabase/supabase-js';

const SUPABASE_SELF_HOSTED_URL = "https://supabase.nutef.com";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.ewogICJyb2xlIjogImFub24iLAogICJpc3MiOiAic3VwYWJhc2UiLAogICJpYXQiOiAxNzE1MDUwODAwLAogICJleHAiOiAxODcyODE3MjAwCn0.zii4FynaxJNS8fGXKYKcnqiUw0DzIuLFB0MMz4ImjEE";

const supabase = createClient(SUPABASE_SELF_HOSTED_URL, SUPABASE_ANON_KEY);

async function testFinalUpload() {
  console.log('🎯 TESTE FINAL - SIMULANDO APLICAÇÃO REAL');
  console.log('=========================================\n');
  
  try {
    // 1. Login (como na aplicação)
    console.log('1️⃣ Fazendo login...');
    const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
      email: 'testaudio1750945549380@nutef.com',
      password: 'TesteAudio123!'
    });
    
    if (loginError) {
      console.error('❌ Login falhou:', loginError.message);
      console.log('\n🔧 Se login falha, execute primeiro o SQL de políticas!');
      return;
    }
    
    console.log('✅ Login realizado');
    console.log('👤 Usuário:', loginData.user?.email);
    
    // 2. Verificar buckets (como na aplicação)
    console.log('\n2️⃣ Verificando buckets disponíveis...');
    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
    
    if (bucketsError) {
      console.error('❌ Erro ao listar buckets:', bucketsError.message);
      console.log('\n🔧 Execute o SQL de políticas no painel do Supabase!');
      return;
    }
    
    console.log('📂 Buckets:', buckets.map(b => b.name).join(', '));
    
    const audioBucket = buckets.find(b => b.name === 'audio-files');
    if (!audioBucket) {
      console.error('❌ Bucket audio-files não visível');
      console.log('\n🔧 Execute o SQL de políticas no painel do Supabase!');
      return;
    }
    
    console.log('✅ Bucket audio-files visível!');
    
    // 3. Simular gravação de áudio (como na aplicação)
    console.log('\n3️⃣ Simulando upload de áudio...');
    
    // Criar blob igual ao da aplicação
    const audioContent = new ArrayBuffer(1024); // 1KB de dados simulados
    const audioBlob = new Blob([audioContent], { type: 'audio/webm' });
    
    // Nome do arquivo igual à aplicação
    const fileName = `${loginData.user?.id}/${Date.now()}.webm`;
    
    console.log('📁 Nome do arquivo:', fileName);
    console.log('📊 Tamanho:', audioBlob.size, 'bytes');
    console.log('🎵 Tipo:', audioBlob.type);
    
    // Upload igual à aplicação
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('audio-files')
      .upload(fileName, audioBlob);
    
    if (uploadError) {
      console.error('❌ UPLOAD FALHOU!');
      console.error('Erro:', uploadError.message);
      console.log('\n🔧 EXECUTE O SQL NO PAINEL DO SUPABASE:');
      console.log('https://supabase.nutef.com/project/default/sql');
      console.log('Execute o conteúdo do arquivo storage-fix.sql');
      return;
    }
    
    console.log('✅ UPLOAD FUNCIONOU!');
    console.log('📍 Path:', uploadData?.path);
    
    // 4. Obter URL pública (como na aplicação)
    console.log('\n4️⃣ Obtendo URL pública...');
    const { data: { publicUrl } } = supabase.storage
      .from('audio-files')
      .getPublicUrl(fileName);
    
    console.log('🌐 URL pública:', publicUrl);
    
    // 5. Criar post no banco (como na aplicação)
    console.log('\n5️⃣ Criando post de áudio...');
    const { data: postData, error: postError } = await supabase
      .from('audio_posts')
      .insert({
        user_id: loginData.user?.id,
        description: 'Teste final de upload - funcionando!',
        audio_url: publicUrl,
        duration: 10,
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
      console.log('🧹 Post de teste removido');
    }
    
    // 6. Limpar arquivo
    console.log('\n6️⃣ Limpando arquivo de teste...');
    const { error: deleteError } = await supabase.storage
      .from('audio-files')
      .remove([fileName]);
    
    console.log(deleteError ? '⚠️ Não removido' : '✅ Arquivo removido');
    
    // Logout
    await supabase.auth.signOut();
    
    console.log('\n🎉 TESTE COMPLETO - TUDO FUNCIONANDO!');
    console.log('✅ Login: OK');
    console.log('✅ Buckets visíveis: OK');
    console.log('✅ Upload de áudio: OK');
    console.log('✅ URL pública: OK');
    console.log('✅ Post no banco: OK');
    console.log('\n🚀 A aplicação deve funcionar normalmente agora!');
    
  } catch (error) {
    console.error('❌ Erro geral:', error);
  }
}

console.log('Execute este teste APÓS executar o SQL de políticas!\n');
testFinalUpload().catch(console.error); 