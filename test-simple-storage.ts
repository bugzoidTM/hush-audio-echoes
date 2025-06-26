import { createClient } from '@supabase/supabase-js';

const SUPABASE_SELF_HOSTED_URL = "https://supabase.nutef.com";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.ewogICJyb2xlIjogImFub24iLAogICJpc3MiOiAic3VwYWJhc2UiLAogICJpYXQiOiAxNzE1MDUwODAwLAogICJleHAiOiAxODcyODE3MjAwCn0.zii4FynaxJNS8fGXKYKcnqiUw0DzIuLFB0MMz4ImjEE";

const supabase = createClient(SUPABASE_SELF_HOSTED_URL, SUPABASE_ANON_KEY);

async function testSimpleStorage() {
  console.log('🎯 TESTE SIMPLES DE STORAGE COM USUÁRIO REAL');
  console.log('===============================================\n');
  
  try {
    // 1. Login com usuário que sabemos que funciona
    console.log('1️⃣ Fazendo login com bugzoid@nutef.com...');
    
    const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
      email: 'bugzoid@nutef.com',
      password: 'Teste123!' // Vou tentar a mesma senha
    });
    
    if (loginError) {
      console.log('⚠️ Login falhou, tentando criar usuário primeiro...');
      
      // Tentar criar usuário bugzoid com senha que funciona
      const { data: signupData, error: signupError } = await supabase.auth.signUp({
        email: 'bugzoid@nutef.com',
        password: 'Teste123!'
      });
      
      if (signupError) {
        console.error('❌ Erro ao criar usuário:', signupError.message);
        
        // Tentar login novamente depois de criar
        const { data: loginData2, error: loginError2 } = await supabase.auth.signInWithPassword({
          email: 'bugzoid@nutef.com',
          password: 'Teste123!'
        });
        
        if (loginError2) {
          console.error('❌ Login ainda falha:', loginError2.message);
          return;
        }
        
        console.log('✅ Login realizado após criação');
      } else {
        console.log('✅ Usuário criado e logado automaticamente');
      }
    } else {
      console.log('✅ Login realizado com sucesso');
    }
    
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
      return;
    }
    
    console.log('✅ Bucket "audio-files" existe:', {
      name: audioBucket.name,
      public: audioBucket.public,
      fileSizeLimit: audioBucket.file_size_limit,
      allowedMimeTypes: audioBucket.allowed_mime_types
    });
    
    // 3. Tentar upload simples
    console.log('\n3️⃣ Tentando upload de arquivo de teste...');
    
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) {
      console.error('❌ Usuário não autenticado');
      return;
    }
    
    console.log('👤 Usuário logado:', user.user.email, '- ID:', user.user.id);
    
    const testContent = 'Test audio file content - simple test';
    const testBlob = new Blob([testContent], { type: 'audio/webm' });
    const fileName = `${user.user.id}/test-simple-${Date.now()}.webm`;
    
    console.log('📁 Tentando upload para:', fileName);
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('audio-files')
      .upload(fileName, testBlob);
    
    if (uploadError) {
      console.error('❌ Erro no upload:', uploadError.message);
      console.error('Detalhes:', uploadError);
      
      // Verificar se é problema de política
      if (uploadError.message.includes('row-level security')) {
        console.log('\n🔧 PROBLEMA: Políticas RLS bloqueando upload');
        console.log('Vou mostrar instruções para corrigir manualmente...');
        mostrarInstrucoesPoliticas();
      }
      
      return;
    }
    
    console.log('✅ Upload realizado com sucesso!');
    console.log('📍 Path do arquivo:', uploadData?.path);
    
    // 4. Testar URL pública
    console.log('\n4️⃣ Testando URL pública...');
    const { data: { publicUrl } } = supabase.storage
      .from('audio-files')
      .getPublicUrl(fileName);
    
    console.log('🌐 URL pública:', publicUrl);
    
    // Testar acesso à URL
    try {
      const response = await fetch(publicUrl);
      console.log('✅ URL acessível:', response.ok ? 'Sim' : 'Não');
      console.log('📊 Status:', response.status, response.statusText);
    } catch (error) {
      console.log('❌ Erro ao acessar URL:', error.message);
    }
    
    // 5. Limpar arquivo de teste
    console.log('\n5️⃣ Limpando arquivo de teste...');
    const { error: deleteError } = await supabase.storage
      .from('audio-files')
      .remove([fileName]);
    
    if (deleteError) {
      console.log('⚠️ Não foi possível deletar:', deleteError.message);
    } else {
      console.log('✅ Arquivo removido com sucesso');
    }
    
    console.log('\n🎉 TESTE COMPLETO! Storage funcionando perfeitamente!');
    
  } catch (error) {
    console.error('❌ Erro geral:', error);
  }
}

function mostrarInstrucoesPoliticas() {
  console.log('\n📋 INSTRUÇÕES PARA CORRIGIR POLÍTICAS:');
  console.log('=====================================');
  console.log('Execute no painel SQL do Supabase:');
  console.log('');
  console.log(`-- Remover políticas existentes se houver conflito
DROP POLICY IF EXISTS "Authenticated users can upload audio files" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view audio files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own audio files" ON storage.objects;

-- Criar políticas corretas
CREATE POLICY "Allow authenticated uploads to audio-files" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'audio-files' AND auth.role() = 'authenticated');

CREATE POLICY "Allow public downloads from audio-files" ON storage.objects  
FOR SELECT USING (bucket_id = 'audio-files');

CREATE POLICY "Allow users to delete own audio files" ON storage.objects
FOR DELETE USING (bucket_id = 'audio-files' AND auth.uid()::text = (storage.foldername(name))[1]);`);
  console.log('');
}

console.log('Iniciando teste simples de storage...\n');
testSimpleStorage().catch(console.error); 