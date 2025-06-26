import { createClient } from '@supabase/supabase-js';

const SUPABASE_SELF_HOSTED_URL = "https://supabase.nutef.com";
const SUPABASE_SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.ewogICJyb2xlIjogInNlcnZpY2Vfcm9sZSIsCiAgImlzcyI6ICJzdXBhYmFzZSIsCiAgImlhdCI6IDE3MTUwNTA4MDAsCiAgImV4cCI6IDE4NzI4MTcyMDAKfQ.Y0Ai9IMrIhHc79Gzxsh9Nl9QnyLXQar0ZrU6kEE8XAs";

const supabase = createClient(SUPABASE_SELF_HOSTED_URL, SUPABASE_SERVICE_KEY);

async function createAudioBucketManually() {
  console.log('🗂️ CRIANDO BUCKET DE ÁUDIO MANUALMENTE');
  console.log('====================================\n');
  
  try {
    // 1. Verificar buckets existentes
    console.log('1️⃣ Verificando buckets existentes...');
    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
    
    if (bucketsError) {
      console.error('❌ Erro ao listar buckets:', bucketsError.message);
      return;
    }
    
    console.log('📂 Buckets atuais:', buckets.map(b => b.name).join(', ') || 'Nenhum');
    
    const audioBucket = buckets.find(b => b.name === 'audio-files');
    if (audioBucket) {
      console.log('✅ Bucket "audio-files" já existe!');
      return;
    }
    
    // 2. Criar bucket via SQL
    console.log('\n2️⃣ Criando bucket via SQL...');
    
    const createBucketSQL = `
      INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
      VALUES (
          'audio-files',
          'audio-files', 
          true,
          52428800, -- 50MB
          ARRAY['audio/webm', 'audio/wav', 'audio/mp3', 'audio/ogg', 'audio/mp4', 'audio/mpeg']
      ) ON CONFLICT (id) DO NOTHING;
    `;
    
    console.log('Executando SQL:', createBucketSQL.trim());
    
    const { data: sqlResult, error: sqlError } = await supabase
      .from('storage.buckets')
      .insert({
        id: 'audio-files',
        name: 'audio-files',
        public: true,
        file_size_limit: 52428800,
        allowed_mime_types: ['audio/webm', 'audio/wav', 'audio/mp3', 'audio/ogg', 'audio/mp4', 'audio/mpeg']
      });
    
    if (sqlError) {
      console.error('❌ Erro via insert:', sqlError.message);
      
      // Tentar via API de storage
      console.log('\n3️⃣ Tentando via API de storage...');
      const { data: bucketData, error: bucketError } = await supabase.storage.createBucket('audio-files', {
        public: true,
        fileSizeLimit: 52428800,
        allowedMimeTypes: ['audio/webm', 'audio/wav', 'audio/mp3', 'audio/ogg', 'audio/mp4', 'audio/mpeg']
      });
      
      if (bucketError) {
        console.error('❌ Erro via API:', bucketError.message);
        return;
      }
      
      console.log('✅ Bucket criado via API:', bucketData);
    } else {
      console.log('✅ Bucket criado via SQL:', sqlResult);
    }
    
    // 4. Configurar políticas básicas
    console.log('\n4️⃣ Configurando políticas RLS...');
    
    const policies = [
      {
        name: 'allow_authenticated_uploads',
        sql: `CREATE POLICY "allow_authenticated_uploads" ON storage.objects
              FOR INSERT WITH CHECK (
                bucket_id = 'audio-files' AND 
                auth.role() = 'authenticated'
              );`
      },
      {
        name: 'allow_public_downloads',
        sql: `CREATE POLICY "allow_public_downloads" ON storage.objects
              FOR SELECT USING (bucket_id = 'audio-files');`
      },
      {
        name: 'allow_user_deletes',
        sql: `CREATE POLICY "allow_user_deletes" ON storage.objects
              FOR DELETE USING (
                bucket_id = 'audio-files' AND 
                auth.uid()::text = (storage.foldername(name))[1]
              );`
      }
    ];
    
    for (const policy of policies) {
      try {
        console.log(`Criando política: ${policy.name}`);
        
        // Como não temos função exec_sql, vamos tentar executar manualmente
        const { error } = await supabase.rpc('sql', { 
          query: policy.sql 
        });
        
        if (error) {
          console.log(`⚠️ Política ${policy.name} não criada:`, error.message);
        } else {
          console.log(`✅ Política ${policy.name} criada`);
        }
      } catch (error) {
        console.log(`⚠️ Erro na política ${policy.name}:`, error.message);
      }
    }
    
    // 5. Verificar se bucket foi criado
    console.log('\n5️⃣ Verificando resultado...');
    const { data: newBuckets, error: newBucketsError } = await supabase.storage.listBuckets();
    
    if (newBucketsError) {
      console.error('❌ Erro ao verificar buckets:', newBucketsError.message);
      return;
    }
    
    const createdBucket = newBuckets.find(b => b.name === 'audio-files');
    if (createdBucket) {
      console.log('✅ BUCKET CRIADO COM SUCESSO!');
      console.log('📊 Detalhes:', {
        name: createdBucket.name,
        public: createdBucket.public,
        fileSizeLimit: createdBucket.file_size_limit,
        allowedMimeTypes: createdBucket.allowed_mime_types
      });
      
      // 6. Testar upload básico
      console.log('\n6️⃣ Testando upload básico...');
      await testBasicUpload();
      
    } else {
      console.log('❌ Bucket não foi criado');
    }
    
  } catch (error) {
    console.error('❌ Erro geral:', error);
  }
}

async function testBasicUpload() {
  try {
    // Login com usuário de teste
    const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
      email: 'testaudio1750945549380@nutef.com',
      password: 'TesteAudio123!'
    });
    
    if (loginError) {
      console.log('⚠️ Não foi possível fazer login para teste');
      return;
    }
    
    console.log('👤 Logado como:', loginData.user?.email);
    
    const testContent = 'Basic upload test after bucket creation';
    const testBlob = new Blob([testContent], { type: 'audio/webm' });
    const fileName = `${loginData.user?.id}/basic-test-${Date.now()}.webm`;
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('audio-files')
      .upload(fileName, testBlob);
    
    if (uploadError) {
      console.error('❌ Upload ainda falha:', uploadError.message);
      
      if (uploadError.message.includes('row-level security')) {
        console.log('\n📋 EXECUTE ESTAS POLÍTICAS MANUALMENTE NO PAINEL SQL:');
        console.log(`
DROP POLICY IF EXISTS "allow_authenticated_uploads" ON storage.objects;
DROP POLICY IF EXISTS "allow_public_downloads" ON storage.objects;
DROP POLICY IF EXISTS "allow_user_deletes" ON storage.objects;

CREATE POLICY "allow_authenticated_uploads" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'audio-files' AND auth.role() = 'authenticated');

CREATE POLICY "allow_public_downloads" ON storage.objects
  FOR SELECT USING (bucket_id = 'audio-files');

CREATE POLICY "allow_user_deletes" ON storage.objects
  FOR DELETE USING (bucket_id = 'audio-files' AND auth.uid()::text = (storage.foldername(name))[1]);
        `);
      }
      
    } else {
      console.log('✅ Upload funcionou! Path:', uploadData?.path);
      
      // Limpar arquivo de teste
      await supabase.storage.from('audio-files').remove([fileName]);
      console.log('🧹 Arquivo de teste removido');
    }
    
    await supabase.auth.signOut();
    
  } catch (error) {
    console.error('❌ Erro no teste:', error);
  }
}

console.log('Iniciando criação do bucket de áudio...\n');
createAudioBucketManually().catch(console.error); 