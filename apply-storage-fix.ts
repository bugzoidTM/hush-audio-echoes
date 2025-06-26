import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const SUPABASE_SELF_HOSTED_URL = "https://supabase.nutef.com";
const SUPABASE_SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.ewogICJyb2xlIjogInNlcnZpY2Vfcm9sZSIsCiAgImlzcyI6ICJzdXBhYmFzZSIsCiAgImlhdCI6IDE3MTUwNTA4MDAsCiAgImV4cCI6IDE4NzI4MTcyMDAKfQ.Y0Ai9IMrIhHc79Gzxsh9Nl9QnyLXQar0ZrU6kEE8XAs";

// Usar service_role para ter permissões administrativas
const supabase = createClient(SUPABASE_SELF_HOSTED_URL, SUPABASE_SERVICE_KEY);

async function fixStorageConfiguration() {
  console.log('🔧 CONFIGURANDO STORAGE PARA ÁUDIOS');
  console.log('===================================\n');
  
  try {
    // 1. Criar bucket via código
    console.log('1️⃣ Criando bucket "audio-files"...');
    
    const { data: bucketData, error: bucketError } = await supabase.storage.createBucket('audio-files', {
      public: true,
      fileSizeLimit: 52428800, // 50MB
      allowedMimeTypes: ['audio/webm', 'audio/wav', 'audio/mp3', 'audio/ogg', 'audio/mp4', 'audio/mpeg']
    });
    
    if (bucketError) {
      if (bucketError.message.includes('already exists')) {
        console.log('✅ Bucket já existe');
      } else {
        console.error('❌ Erro ao criar bucket:', bucketError.message);
        
        // Tentar via SQL direto
        console.log('\n2️⃣ Tentando criar via SQL...');
        await createBucketViaSQL();
      }
    } else {
      console.log('✅ Bucket criado com sucesso:', bucketData);
    }
    
    // 3. Configurar políticas de storage
    console.log('\n3️⃣ Configurando políticas RLS para storage...');
    await configurarPoliticasStorage();
    
    // 4. Testar upload
    console.log('\n4️⃣ Testando upload após configuração...');
    await testarUpload();
    
  } catch (error) {
    console.error('❌ Erro geral:', error);
  }
}

async function createBucketViaSQL() {
  const sqlCommands = [
    `INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
     VALUES (
         'audio-files',
         'audio-files', 
         true,
         52428800,
         ARRAY['audio/webm', 'audio/wav', 'audio/mp3', 'audio/ogg', 'audio/mp4', 'audio/mpeg']::text[]
     ) ON CONFLICT (id) DO NOTHING;`
  ];
  
  for (const sql of sqlCommands) {
    try {
      console.log('Executando SQL:', sql.substring(0, 80) + '...');
      const { error } = await supabase.rpc('exec_sql', { sql_query: sql });
      
      if (error) {
        console.error('❌ Erro SQL:', error.message);
      } else {
        console.log('✅ SQL executado com sucesso');
      }
    } catch (error) {
      console.error('❌ Erro ao executar SQL:', error);
    }
  }
}

async function configurarPoliticasStorage() {
  const politicas = [
    {
      nome: "Authenticated users can upload audio files",
      sql: `CREATE POLICY "Authenticated users can upload audio files" ON storage.objects
            FOR INSERT WITH CHECK (
                bucket_id = 'audio-files' 
                AND auth.role() = 'authenticated'
                AND auth.uid()::text = (storage.foldername(name))[1]
            );`
    },
    {
      nome: "Anyone can view audio files", 
      sql: `CREATE POLICY "Anyone can view audio files" ON storage.objects
            FOR SELECT USING (bucket_id = 'audio-files');`
    },
    {
      nome: "Users can delete own audio files",
      sql: `CREATE POLICY "Users can delete own audio files" ON storage.objects
            FOR DELETE USING (
                bucket_id = 'audio-files'
                AND auth.uid()::text = (storage.foldername(name))[1]
            );`
    },
    {
      nome: "Users can update own audio files",
      sql: `CREATE POLICY "Users can update own audio files" ON storage.objects
            FOR UPDATE USING (
                bucket_id = 'audio-files'
                AND auth.uid()::text = (storage.foldername(name))[1]
            );`
    }
  ];
  
  for (const politica of politicas) {
    try {
      console.log(`Criando política: ${politica.nome}`);
      
      // Primeiro, tentar deletar se existir
      const dropSql = `DROP POLICY IF EXISTS "${politica.nome}" ON storage.objects;`;
      await supabase.rpc('exec_sql', { sql_query: dropSql });
      
      // Depois criar a nova
      const { error } = await supabase.rpc('exec_sql', { sql_query: politica.sql });
      
      if (error) {
        console.error(`❌ Erro ao criar política "${politica.nome}":`, error.message);
      } else {
        console.log(`✅ Política "${politica.nome}" criada`);
      }
    } catch (error) {
      console.error(`❌ Erro na política "${politica.nome}":`, error);
    }
  }
}

async function testarUpload() {
  try {
    // Fazer login primeiro
    const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
      email: 'teste@nutef.com',
      password: 'Teste123!'
    });
    
    if (loginError) {
      console.error('❌ Erro no login:', loginError.message);
      return;
    }
    
    console.log('✅ Logado como:', loginData.user?.email);
    
    // Teste de upload
    const testContent = 'Test audio content after configuration';
    const testBlob = new Blob([testContent], { type: 'audio/webm' });
    const fileName = `${loginData.user?.id}/test-after-fix-${Date.now()}.webm`;
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('audio-files')
      .upload(fileName, testBlob);
    
    if (uploadError) {
      console.error('❌ Upload ainda falha:', uploadError.message);
      console.error('Detalhes:', uploadError);
    } else {
      console.log('✅ Upload funcionou! Path:', uploadData?.path);
      
      // Testar URL pública
      const { data: { publicUrl } } = supabase.storage
        .from('audio-files')
        .getPublicUrl(fileName);
      
      console.log('📎 URL pública:', publicUrl);
      
      // Limpar arquivo de teste
      await supabase.storage.from('audio-files').remove([fileName]);
      console.log('🧹 Arquivo de teste removido');
    }
    
    // Logout
    await supabase.auth.signOut();
    
  } catch (error) {
    console.error('❌ Erro no teste:', error);
  }
}

console.log('Iniciando configuração do storage...\n');
fixStorageConfiguration().catch(console.error); 