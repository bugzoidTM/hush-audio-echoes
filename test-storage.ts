import { createClient } from '@supabase/supabase-js';

const SUPABASE_SELF_HOSTED_URL = "https://supabase.nutef.com";
const SUPABASE_SELF_HOSTED_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.ewogICJyb2xlIjogImFub24iLAogICJpc3MiOiAic3VwYWJhc2UiLAogICJpYXQiOiAxNzE1MDUwODAwLAogICJleHAiOiAxODcyODE3MjAwCn0.zii4FynaxJNS8fGXKYKcnqiUw0DzIuLFB0MMz4ImjEE";

const supabase = createClient(SUPABASE_SELF_HOSTED_URL, SUPABASE_SELF_HOSTED_ANON_KEY);

async function testStorageBucket() {
  console.log('🗂️ Testando bucket de storage...\n');
  
  try {
    // 1. Verificar se bucket existe
    console.log('1️⃣ Verificando buckets disponíveis...');
    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
    
    if (bucketsError) {
      console.error('❌ Erro ao listar buckets:', bucketsError.message);
      return;
    }
    
    console.log('✅ Buckets encontrados:', buckets?.map(b => b.name).join(', ') || 'Nenhum');
    
    const audioBucket = buckets?.find(bucket => bucket.name === 'audio-files');
    if (!audioBucket) {
      console.log('⚠️ Bucket "audio-files" não encontrado! Tentando criar...');
      await createAudioBucket();
      return;
    }
    
    console.log('✅ Bucket "audio-files" encontrado:', audioBucket);
    
    // 2. Testar upload de arquivo pequeno
    console.log('\n2️⃣ Testando upload de arquivo de teste...');
    
    const testContent = 'Test audio file content';
    const testBlob = new Blob([testContent], { type: 'audio/webm' });
    const fileName = `test/${Date.now()}.webm`;
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('audio-files')
      .upload(fileName, testBlob);
    
    if (uploadError) {
      console.error('❌ Erro no upload:', uploadError.message);
      console.error('Detalhes:', uploadError);
      
      if (uploadError.message.includes('new row violates row-level security')) {
        console.log('\n🔧 PROBLEMA: Políticas RLS muito restritivas');
        console.log('Vou verificar as políticas de storage...');
        await checkStoragePolicies();
      }
      
      return;
    }
    
    console.log('✅ Upload realizado com sucesso:', uploadData?.path);
    
    // 3. Testar URL pública
    console.log('\n3️⃣ Testando URL pública...');
    const { data: { publicUrl } } = supabase.storage
      .from('audio-files')
      .getPublicUrl(fileName);
    
    console.log('📎 URL pública:', publicUrl);
    
    // Testar se a URL é acessível
    try {
      const response = await fetch(publicUrl);
      console.log('✅ URL acessível:', response.ok ? 'Sim' : 'Não');
      console.log('Status:', response.status, response.statusText);
    } catch (error) {
      console.log('❌ Erro ao acessar URL:', error.message);
    }
    
    // 4. Limpar arquivo de teste
    console.log('\n4️⃣ Limpando arquivo de teste...');
    const { error: deleteError } = await supabase.storage
      .from('audio-files')
      .remove([fileName]);
    
    if (deleteError) {
      console.log('⚠️ Não foi possível deletar arquivo de teste:', deleteError.message);
    } else {
      console.log('✅ Arquivo de teste removido');
    }
    
  } catch (error) {
    console.error('❌ Erro geral no teste de storage:', error);
  }
}

async function createAudioBucket() {
  console.log('🛠️ Criando bucket "audio-files"...');
  
  try {
    const { data, error } = await supabase.storage.createBucket('audio-files', {
      public: true,
      fileSizeLimit: 52428800, // 50MB
      allowedMimeTypes: ['audio/*']
    });
    
    if (error) {
      console.error('❌ Erro ao criar bucket:', error.message);
      
      if (error.message.includes('already exists')) {
        console.log('ℹ️ Bucket já existe, continuando...');
        return;
      }
      
      return;
    }
    
    console.log('✅ Bucket criado com sucesso:', data);
    
    // Configurar políticas básicas
    await setupStoragePolicies();
    
  } catch (error) {
    console.error('❌ Erro ao criar bucket:', error);
  }
}

async function setupStoragePolicies() {
  console.log('🔒 Configurando políticas de storage...');
  
  const policies = [
    {
      name: 'Allow authenticated uploads',
      operation: 'INSERT',
      definition: `bucket_id = 'audio-files' AND auth.role() = 'authenticated'`
    },
    {
      name: 'Allow public downloads',
      operation: 'SELECT', 
      definition: `bucket_id = 'audio-files'`
    },
    {
      name: 'Allow users to delete own files',
      operation: 'DELETE',
      definition: `bucket_id = 'audio-files' AND auth.uid()::text = (storage.foldername(name))[1]`
    }
  ];
  
  console.log('ℹ️ Políticas a serem configuradas:');
  policies.forEach(policy => {
    console.log(`  - ${policy.name}: ${policy.operation}`);
  });
  
  console.log('⚠️ Configure essas políticas manualmente no painel admin do Supabase');
}

async function checkStoragePolicies() {
  console.log('🔍 Verificando políticas de storage existentes...');
  
  try {
    // Tentar fazer upload com usuário autenticado fictício
    console.log('Testando com token de usuário...');
    
    // Primeiro vamos fazer login com o usuário de teste
    const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
      email: 'teste@nutef.com',
      password: 'Teste123!'
    });
    
    if (loginError) {
      console.log('⚠️ Não foi possível fazer login para testar políticas');
      return;
    }
    
    console.log('✅ Logado como:', loginData.user?.email);
    
    // Tentar upload novamente com usuário autenticado
    const testContent = 'Authenticated test';
    const testBlob = new Blob([testContent], { type: 'audio/webm' });
    const fileName = `${loginData.user?.id}/test-${Date.now()}.webm`;
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('audio-files')
      .upload(fileName, testBlob);
    
    if (uploadError) {
      console.error('❌ Upload ainda falha mesmo autenticado:', uploadError.message);
    } else {
      console.log('✅ Upload funciona quando autenticado!');
      
      // Limpar
      await supabase.storage.from('audio-files').remove([fileName]);
    }
    
    // Fazer logout
    await supabase.auth.signOut();
    
  } catch (error) {
    console.error('❌ Erro ao verificar políticas:', error);
  }
}

console.log('🗂️ TESTE DE STORAGE - SUPABASE SELF-HOSTED');
console.log('==========================================\n');

testStorageBucket().catch(console.error); 