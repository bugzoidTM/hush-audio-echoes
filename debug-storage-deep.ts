import { createClient } from '@supabase/supabase-js';

const SUPABASE_SELF_HOSTED_URL = "https://supabase.nutef.com";
const SUPABASE_SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.ewogICJyb2xlIjogInNlcnZpY2Vfcm9sZSIsCiAgImlzcyI6ICJzdXBhYmFzZSIsCiAgImlhdCI6IDE3MTUwNTA4MDAsCiAgImV4cCI6IDE4NzI4MTcyMDAKfQ.Y0Ai9IMrIhHc79Gzxsh9Nl9QnyLXQar0ZrU6kEE8XAs";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.ewogICJyb2xlIjogImFub24iLAogICJpc3MiOiAic3VwYWJhc2UiLAogICJpYXQiOiAxNzE1MDUwODAwLAogICJleHAiOiAxODcyODE3MjAwCn0.zii4FynaxJNS8fGXKYKcnqiUw0DzIuLFB0MMz4ImjEE";

async function debugStorageDeep() {
  console.log('🔍 DIAGNÓSTICO PROFUNDO DO STORAGE');
  console.log('=================================\n');
  
  // Cliente admin
  const adminClient = createClient(SUPABASE_SELF_HOSTED_URL, SUPABASE_SERVICE_KEY);
  // Cliente normal
  const normalClient = createClient(SUPABASE_SELF_HOSTED_URL, SUPABASE_ANON_KEY);
  
  try {
    console.log('1️⃣ Verificando buckets com SERVICE_ROLE...');
    const { data: adminBuckets, error: adminError } = await adminClient.storage.listBuckets();
    
    if (adminError) {
      console.error('❌ Erro admin:', adminError.message);
      return;
    }
    
    console.log('📂 Buckets (admin):', adminBuckets.map(b => ({
      name: b.name,
      id: b.id,
      public: b.public,
      fileSizeLimit: b.file_size_limit
    })));
    
    console.log('\n2️⃣ Verificando buckets com ANON...');
    const { data: normalBuckets, error: normalError } = await normalClient.storage.listBuckets();
    
    if (normalError) {
      console.error('❌ Erro anon:', normalError.message);
    } else {
      console.log('📂 Buckets (anon):', normalBuckets.map(b => ({
        name: b.name,
        id: b.id,
        public: b.public
      })));
    }
    
    console.log('\n3️⃣ Verificando políticas RLS...');
    
    // Verificar políticas na tabela buckets
    const { data: bucketPolicies, error: bucketPoliciesError } = await adminClient
      .from('pg_policies')
      .select('*')
      .eq('schemaname', 'storage')
      .eq('tablename', 'buckets');
    
    if (bucketPoliciesError) {
      console.log('⚠️ Não foi possível verificar políticas de buckets');
    } else {
      console.log('🔒 Políticas em storage.buckets:');
      bucketPolicies.forEach(policy => {
        console.log(`  - ${policy.policyname}: ${policy.cmd}`);
      });
    }
    
    // Verificar políticas na tabela objects
    const { data: objectPolicies, error: objectPoliciesError } = await adminClient
      .from('pg_policies')
      .select('*')
      .eq('schemaname', 'storage')
      .eq('tablename', 'objects');
    
    if (objectPoliciesError) {
      console.log('⚠️ Não foi possível verificar políticas de objects');
    } else {
      console.log('🔒 Políticas em storage.objects:');
      objectPolicies.forEach(policy => {
        console.log(`  - ${policy.policyname}: ${policy.cmd}`);
      });
    }
    
    console.log('\n4️⃣ Testando acesso direto ao bucket...');
    
    // Login com usuário de teste
    const { data: loginData, error: loginError } = await normalClient.auth.signInWithPassword({
      email: 'testaudio1750945549380@nutef.com',
      password: 'TesteAudio123!'
    });
    
    if (loginError) {
      console.error('❌ Login falhou:', loginError.message);
      return;
    }
    
    console.log('✅ Login OK, testando acesso direto...');
    
    // Tentar listar arquivos no bucket (isso pode revelar o problema)
    const { data: files, error: listError } = await normalClient.storage
      .from('audio-files')
      .list('', { limit: 1 });
    
    if (listError) {
      console.error('❌ Erro ao listar arquivos:', listError.message);
      console.log('Código:', listError.name);
      
      if (listError.message.includes('NoSuchBucket')) {
        console.log('\n🚨 PROBLEMA IDENTIFICADO: Bucket não existe no storage backend');
        console.log('Isso pode indicar:');
        console.log('1. Bucket não foi criado corretamente');
        console.log('2. Storage backend não está sincronizado');
        console.log('3. Configuração de storage no Supabase self-hosted');
      }
    } else {
      console.log('✅ Listagem funcionou:', files?.length, 'arquivos');
    }
    
    console.log('\n5️⃣ Tentando recriar bucket via API...');
    
    // Tentar deletar e recriar bucket
    const { error: deleteError } = await adminClient.storage.deleteBucket('audio-files');
    if (deleteError && !deleteError.message.includes('not found')) {
      console.log('⚠️ Erro ao deletar bucket:', deleteError.message);
    } else {
      console.log('🗑️ Bucket deletado (ou não existia)');
    }
    
    // Recriar bucket
    const { data: newBucket, error: createError } = await adminClient.storage.createBucket('audio-files', {
      public: true,
      fileSizeLimit: 52428800, // 50MB
      allowedMimeTypes: ['audio/webm', 'audio/wav', 'audio/mp3', 'audio/ogg', 'audio/mp4', 'audio/mpeg']
    });
    
    if (createError) {
      console.error('❌ Erro ao recriar bucket:', createError.message);
    } else {
      console.log('✅ Bucket recriado:', newBucket);
      
      // Testar upload imediatamente após criação
      console.log('\n6️⃣ Testando upload após recriação...');
      
      const testContent = 'Test after bucket recreation';
      const testBlob = new Blob([testContent], { type: 'audio/webm' });
      const fileName = `${loginData.user?.id}/test-recreation-${Date.now()}.webm`;
      
      const { data: uploadData, error: uploadError } = await normalClient.storage
        .from('audio-files')
        .upload(fileName, testBlob);
      
      if (uploadError) {
        console.error('❌ Upload ainda falha:', uploadError.message);
        
        if (uploadError.message.includes('NoSuchBucket')) {
          console.log('\n🔧 SOLUÇÃO ALTERNATIVA:');
          console.log('O problema pode ser na configuração do storage backend.');
          console.log('Verifique se o Supabase self-hosted está configurado corretamente.');
          console.log('Pode ser necessário reiniciar os containers do storage.');
        }
      } else {
        console.log('✅ UPLOAD FUNCIONOU APÓS RECRIAÇÃO!');
        console.log('📍 Path:', uploadData?.path);
        
        // Limpar
        await normalClient.storage.from('audio-files').remove([fileName]);
        console.log('🧹 Arquivo de teste removido');
      }
    }
    
    await normalClient.auth.signOut();
    
  } catch (error) {
    console.error('❌ Erro geral:', error);
  }
}

console.log('Iniciando diagnóstico profundo...\n');
debugStorageDeep().catch(console.error); 