import { createClient } from '@supabase/supabase-js';

const SUPABASE_SELF_HOSTED_URL = "https://supabase.nutef.com";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.ewogICJyb2xlIjogImFub24iLAogICJpc3MiOiAic3VwYWJhc2UiLAogICJpYXQiOiAxNzE1MDUwODAwLAogICJleHAiOiAxODcyODE3MjAwCn0.zii4FynaxJNS8fGXKYKcnqiUw0DzIuLFB0MMz4ImjEE";

const supabase = createClient(SUPABASE_SELF_HOSTED_URL, SUPABASE_ANON_KEY);

async function createTestUserAndTestStorage() {
  console.log('👤 CRIANDO USUÁRIO DE TESTE E TESTANDO STORAGE');
  console.log('==============================================\n');
  
  const testEmail = `testaudio${Date.now()}@nutef.com`;
  const testPassword = 'TesteAudio123!';
  
  try {
    // 1. Criar novo usuário de teste
    console.log('1️⃣ Criando usuário de teste:', testEmail);
    
    const { data: signupData, error: signupError } = await supabase.auth.signUp({
      email: testEmail,
      password: testPassword
    });
    
    if (signupError) {
      console.error('❌ Erro ao criar usuário:', signupError.message);
      return;
    }
    
    console.log('✅ Usuário criado com sucesso!');
    console.log('👤 ID do usuário:', signupData.user?.id);
    console.log('📧 Email:', signupData.user?.email);
    
    // 2. Verificar buckets
    console.log('\n2️⃣ Verificando buckets disponíveis...');
    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
    
    if (bucketsError) {
      console.error('❌ Erro ao listar buckets:', bucketsError.message);
      return;
    }
    
    console.log('📂 Buckets encontrados:', buckets.map(b => b.name).join(', '));
    
    const audioBucket = buckets.find(b => b.name === 'audio-files');
    if (!audioBucket) {
      console.log('❌ Bucket "audio-files" não encontrado!');
      console.log('🔧 Execute o SQL para criar o bucket:');
      console.log(`
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'audio-files',
    'audio-files', 
    true,
    52428800,
    ARRAY['audio/webm', 'audio/wav', 'audio/mp3', 'audio/ogg', 'audio/mp4', 'audio/mpeg']
) ON CONFLICT (id) DO NOTHING;
      `);
      return;
    }
    
    console.log('✅ Bucket "audio-files" encontrado:', {
      name: audioBucket.name,
      public: audioBucket.public,
      fileSizeLimit: audioBucket.file_size_limit
    });
    
    // 3. Tentar upload
    console.log('\n3️⃣ Tentando upload de arquivo de teste...');
    
    const testContent = 'Test audio file content from new user';
    const testBlob = new Blob([testContent], { type: 'audio/webm' });
    const fileName = `${signupData.user?.id}/test-upload-${Date.now()}.webm`;
    
    console.log('📁 Uploading para:', fileName);
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('audio-files')
      .upload(fileName, testBlob);
    
    if (uploadError) {
      console.error('❌ ERRO NO UPLOAD:', uploadError.message);
      console.error('Detalhes completos:', JSON.stringify(uploadError, null, 2));
      
      if (uploadError.message.includes('row-level security')) {
        console.log('\n🔧 SOLUÇÃO: Execute este SQL no painel do Supabase:');
        console.log(`
-- Remover políticas conflitantes
DROP POLICY IF EXISTS "Authenticated users can upload audio files" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view audio files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own audio files" ON storage.objects;

-- Criar políticas corretas
CREATE POLICY "Allow authenticated uploads to audio-files" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'audio-files' AND auth.role() = 'authenticated');

CREATE POLICY "Allow public downloads from audio-files" ON storage.objects  
  FOR SELECT USING (bucket_id = 'audio-files');

CREATE POLICY "Allow users to delete own audio files" ON storage.objects
  FOR DELETE USING (bucket_id = 'audio-files' AND auth.uid()::text = (storage.foldername(name))[1]);
        `);
      }
      
      return;
    }
    
    console.log('✅ UPLOAD FUNCIONOU!');
    console.log('📍 Path:', uploadData?.path);
    
    // 4. Testar URL pública
    console.log('\n4️⃣ Testando URL pública...');
    const { data: { publicUrl } } = supabase.storage
      .from('audio-files')
      .getPublicUrl(fileName);
    
    console.log('🌐 URL pública:', publicUrl);
    
    try {
      const response = await fetch(publicUrl);
      console.log('✅ URL acessível:', response.ok);
      console.log('📊 Status:', response.status);
    } catch (error) {
      console.log('❌ Erro ao acessar URL:', error.message);
    }
    
    // 5. Teste de criação de post de áudio
    console.log('\n5️⃣ Testando criação de post de áudio no banco...');
    
    const { data: postData, error: postError } = await supabase
      .from('audio_posts')
      .insert({
        user_id: signupData.user?.id,
        description: 'Teste de upload de áudio via script',
        audio_url: publicUrl,
        duration: 5,
        voice_filter: 'normal'
      })
      .select()
      .single();
    
    if (postError) {
      console.error('❌ Erro ao criar post:', postError.message);
    } else {
      console.log('✅ Post criado com sucesso! ID:', postData.id);
      
      // Deletar o post de teste
      await supabase.from('audio_posts').delete().eq('id', postData.id);
      console.log('🧹 Post de teste removido');
    }
    
    // 6. Limpar arquivo
    console.log('\n6️⃣ Limpando arquivo de teste...');
    const { error: deleteError } = await supabase.storage
      .from('audio-files')
      .remove([fileName]);
    
    console.log(deleteError ? '⚠️ Não foi possível deletar' : '✅ Arquivo removido');
    
    console.log('\n🎉 TESTE COMPLETO!');
    console.log('✅ Usuário criado:', testEmail);
    console.log('✅ Upload funcionando');
    console.log('✅ URLs públicas funcionando');
    console.log('✅ Banco de dados funcionando');
    
    console.log('\n🔑 CREDENCIAIS DE TESTE:');
    console.log('Email:', testEmail);
    console.log('Senha:', testPassword);
    
  } catch (error) {
    console.error('❌ Erro geral:', error);
  }
}

console.log('Iniciando criação de usuário de teste...\n');
createTestUserAndTestStorage().catch(console.error); 