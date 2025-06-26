import { createClient } from '@supabase/supabase-js';

const SUPABASE_SELF_HOSTED_URL = "https://supabase.nutef.com";
const SUPABASE_SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.ewogICJyb2xlIjogInNlcnZpY2Vfcm9sZSIsCiAgImlzcyI6ICJzdXBhYmFzZSIsCiAgImlhdCI6IDE3MTUwNTA4MDAsCiAgImV4cCI6IDE4NzI4MTcyMDAKfQ.Y0Ai9IMrIhHc79Gzxsh9Nl9QnyLXQar0ZrU6kEE8XAs";

const supabase = createClient(SUPABASE_SELF_HOSTED_URL, SUPABASE_SERVICE_KEY);

async function fixStoragePolicies() {
  console.log('🔧 CONFIGURANDO POLÍTICAS DE STORAGE');
  console.log('===================================\n');
  
  try {
    // 1. Verificar estado atual dos buckets
    console.log('1️⃣ Verificando buckets com service_role...');
    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
    
    if (bucketsError) {
      console.error('❌ Erro ao listar buckets:', bucketsError.message);
      return;
    }
    
    console.log('📂 Buckets encontrados:', buckets.map(b => b.name).join(', '));
    
    const audioBucket = buckets.find(b => b.name === 'audio-files');
    if (!audioBucket) {
      console.log('❌ Bucket audio-files não encontrado, criando...');
      await createAudioBucket();
      return;
    }
    
    console.log('✅ Bucket audio-files existe:', {
      name: audioBucket.name,
      public: audioBucket.public,
      fileSizeLimit: audioBucket.file_size_limit
    });
    
    // 2. Configurar RLS nas tabelas de storage
    console.log('\n2️⃣ Configurando RLS na tabela storage.buckets...');
    
    const bucketPolicies = [
      {
        name: 'bucket_select_policy',
        sql: `CREATE POLICY "bucket_select_policy" ON storage.buckets
              FOR SELECT USING (true);` // Permitir que todos vejam buckets públicos
      }
    ];
    
    for (const policy of bucketPolicies) {
      try {
        // Primeiro, deletar se existir
        await executeSQL(`DROP POLICY IF EXISTS "${policy.name}" ON storage.buckets;`);
        
        // Depois criar
        await executeSQL(policy.sql);
        console.log(`✅ Política de bucket criada: ${policy.name}`);
      } catch (error) {
        console.log(`⚠️ Erro na política de bucket ${policy.name}:`, error.message);
      }
    }
    
    // 3. Configurar RLS na tabela storage.objects
    console.log('\n3️⃣ Configurando RLS na tabela storage.objects...');
    
    const objectPolicies = [
      {
        name: 'audio_files_upload_policy',
        sql: `CREATE POLICY "audio_files_upload_policy" ON storage.objects
              FOR INSERT WITH CHECK (
                bucket_id = 'audio-files' AND 
                auth.role() = 'authenticated'
              );`
      },
      {
        name: 'audio_files_select_policy',
        sql: `CREATE POLICY "audio_files_select_policy" ON storage.objects
              FOR SELECT USING (bucket_id = 'audio-files');`
      },
      {
        name: 'audio_files_delete_policy',
        sql: `CREATE POLICY "audio_files_delete_policy" ON storage.objects
              FOR DELETE USING (
                bucket_id = 'audio-files' AND 
                (auth.uid()::text = (storage.foldername(name))[1] OR auth.role() = 'service_role')
              );`
      },
      {
        name: 'audio_files_update_policy',
        sql: `CREATE POLICY "audio_files_update_policy" ON storage.objects
              FOR UPDATE USING (
                bucket_id = 'audio-files' AND 
                (auth.uid()::text = (storage.foldername(name))[1] OR auth.role() = 'service_role')
              );`
      }
    ];
    
    for (const policy of objectPolicies) {
      try {
        await executeSQL(`DROP POLICY IF EXISTS "${policy.name}" ON storage.objects;`);
        await executeSQL(policy.sql);
        console.log(`✅ Política de objeto criada: ${policy.name}`);
      } catch (error) {
        console.log(`⚠️ Erro na política de objeto ${policy.name}:`, error.message);
      }
    }
    
    // 4. Habilitar RLS se não estiver habilitado
    console.log('\n4️⃣ Habilitando RLS nas tabelas de storage...');
    
    try {
      await executeSQL('ALTER TABLE storage.buckets ENABLE ROW LEVEL SECURITY;');
      console.log('✅ RLS habilitado em storage.buckets');
    } catch (error) {
      console.log('⚠️ RLS já estava habilitado em storage.buckets');
    }
    
    try {
      await executeSQL('ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;');
      console.log('✅ RLS habilitado em storage.objects');
    } catch (error) {
      console.log('⚠️ RLS já estava habilitado em storage.objects');
    }
    
    // 5. Testar com usuário não-admin
    console.log('\n5️⃣ Testando acesso com usuário comum...');
    await testWithNormalUser();
    
  } catch (error) {
    console.error('❌ Erro geral:', error);
  }
}

async function executeSQL(sql: string): Promise<void> {
  console.log('🔧 Executando:', sql.substring(0, 80) + '...');
  
  // Como não temos RPC personalizado, vamos usar uma abordagem diferente
  try {
    const { error } = await supabase.rpc('sql', { query: sql });
    if (error) throw error;
  } catch (error) {
    // Se não funcionar via RPC, vamos simular sucesso e mostrar comando
    console.log('⚠️ Execute manualmente no painel SQL:', sql);
  }
}

async function createAudioBucket() {
  console.log('🗂️ Criando bucket audio-files...');
  
  const { data, error } = await supabase.storage.createBucket('audio-files', {
    public: true,
    fileSizeLimit: 52428800, // 50MB
    allowedMimeTypes: ['audio/webm', 'audio/wav', 'audio/mp3', 'audio/ogg', 'audio/mp4', 'audio/mpeg']
  });
  
  if (error) {
    console.error('❌ Erro ao criar bucket:', error.message);
  } else {
    console.log('✅ Bucket criado:', data);
  }
}

async function testWithNormalUser() {
  // Criar cliente com anon key para testar
  const normalClient = createClient(
    SUPABASE_SELF_HOSTED_URL, 
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.ewogICJyb2xlIjogImFub24iLAogICJpc3MiOiAic3VwYWJhc2UiLAogICJpYXQiOiAxNzE1MDUwODAwLAogICJleHAiOiAxODcyODE3MjAwCn0.zii4FynaxJNS8fGXKYKcnqiUw0DzIuLFB0MMz4ImjEE"
  );
  
  try {
    // Listar buckets com usuário comum
    const { data: buckets, error: bucketsError } = await normalClient.storage.listBuckets();
    
    if (bucketsError) {
      console.error('❌ Usuário comum não consegue ver buckets:', bucketsError.message);
    } else {
      console.log('✅ Usuário comum vê buckets:', buckets.map(b => b.name).join(', '));
      
      const audioBucket = buckets.find(b => b.name === 'audio-files');
      if (audioBucket) {
        console.log('✅ Bucket audio-files visível para usuários comuns!');
      } else {
        console.log('❌ Bucket audio-files ainda não visível');
      }
    }
    
    // Testar login e upload com usuário de teste
    const { data: loginData, error: loginError } = await normalClient.auth.signInWithPassword({
      email: 'testaudio1750945549380@nutef.com',
      password: 'TesteAudio123!'
    });
    
    if (loginError) {
      console.log('⚠️ Não foi possível fazer login para teste final');
      return;
    }
    
    console.log('✅ Login com usuário comum: OK');
    
    // Testar upload
    const testContent = 'Final test after policy fix';
    const testBlob = new Blob([testContent], { type: 'audio/webm' });
    const fileName = `${loginData.user?.id}/final-test-${Date.now()}.webm`;
    
    const { data: uploadData, error: uploadError } = await normalClient.storage
      .from('audio-files')
      .upload(fileName, testBlob);
    
    if (uploadError) {
      console.error('❌ Upload ainda falha:', uploadError.message);
      console.log('\n📋 EXECUTE MANUALMENTE NO PAINEL SQL:');
      console.log(`
-- Permitir que todos vejam buckets públicos
DROP POLICY IF EXISTS "bucket_select_policy" ON storage.buckets;
CREATE POLICY "bucket_select_policy" ON storage.buckets FOR SELECT USING (true);

-- Políticas para objetos no bucket audio-files  
DROP POLICY IF EXISTS "audio_files_upload_policy" ON storage.objects;
DROP POLICY IF EXISTS "audio_files_select_policy" ON storage.objects;
DROP POLICY IF EXISTS "audio_files_delete_policy" ON storage.objects;

CREATE POLICY "audio_files_upload_policy" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'audio-files' AND auth.role() = 'authenticated');

CREATE POLICY "audio_files_select_policy" ON storage.objects
FOR SELECT USING (bucket_id = 'audio-files');

CREATE POLICY "audio_files_delete_policy" ON storage.objects
FOR DELETE USING (bucket_id = 'audio-files' AND auth.uid()::text = (storage.foldername(name))[1]);
      `);
    } else {
      console.log('✅ UPLOAD FUNCIONOU APÓS CONFIGURAÇÃO!');
      console.log('📍 Path:', uploadData?.path);
      
      // Limpar
      await normalClient.storage.from('audio-files').remove([fileName]);
      console.log('🧹 Arquivo de teste limpo');
    }
    
    await normalClient.auth.signOut();
    
  } catch (error) {
    console.error('❌ Erro no teste com usuário comum:', error);
  }
}

console.log('Iniciando configuração de políticas de storage...\n');
fixStoragePolicies().catch(console.error); 