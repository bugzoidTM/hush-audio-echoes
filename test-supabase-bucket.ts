import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://supabase.nutef.com";
const SUPABASE_SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.ewogICJyb2xlIjogInNlcnZpY2Vfcm9sZSIsCiAgImlzcyI6ICJzdXBhYmFzZSIsCiAgImlhdCI6IDE3MTUwNTA4MDAsCiAgImV4cCI6IDE4NzI4MTcyMDAKfQ.Y0Ai9IMrIhHc79Gzxsh9Nl9QnyLXQar0ZrU6kEE8XAs";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function testSupabaseBucket() {
  console.log('🔍 TESTANDO BUCKET "SUPABASE" ESPERADO');
  console.log('=' .repeat(50));

  console.log('💡 DIAGNÓSTICO:');
  console.log('Docker-compose tem: GLOBAL_S3_BUCKET=supabase');
  console.log('Isso significa que o Storage procura por um bucket "supabase"');
  console.log('E os buckets públicos ficam dentro dele como pastas/prefixos');
  console.log('');

  // Tentar criar bucket "supabase" via API
  console.log('1️⃣ Tentando criar bucket "supabase"...');
  try {
    const { data, error } = await supabase.storage.createBucket('supabase', {
      public: true,
      fileSizeLimit: 52428800
    });
    
    if (error) {
      if (error.message.includes('already exists')) {
        console.log('✅ Bucket "supabase" já existe');
      } else {
        console.log('❌ Erro ao criar "supabase":', error.message);
      }
    } else {
      console.log('✅ Bucket "supabase" criado:', data);
    }
  } catch (err) {
    console.log('❌ Erro na criação:', err);
  }

  // Testar upload no bucket "supabase"
  console.log('\n2️⃣ Testando upload no bucket "supabase"...');
  try {
    const testData = new Uint8Array([1, 2, 3, 4, 5]);
    const fileName = `test-supabase-${Date.now()}.txt`;
    
    const { data, error } = await supabase.storage
      .from('supabase')
      .upload(fileName, testData, {
        contentType: 'text/plain',
        upsert: false
      });
    
    if (error) {
      console.log('❌ Upload em "supabase" falhou:', error.message);
    } else {
      console.log('✅ Upload em "supabase" FUNCIONOU!');
      console.log('📁 Arquivo:', data.path);
      
      // Testar URL pública
      const { data: publicUrl } = supabase.storage
        .from('supabase')
        .getPublicUrl(fileName);
      
      console.log('🔗 URL:', publicUrl.publicUrl);
      
      // Limpar
      await supabase.storage
        .from('supabase')
        .remove([fileName]);
      console.log('🗑️ Arquivo removido');
    }
    
  } catch (err) {
    console.log('❌ Erro no upload:', err);
  }

  // Testar uploads nos buckets originais após criar "supabase"
  console.log('\n3️⃣ Testando buckets originais após criar "supabase"...');
  for (const bucketName of ['public', 'audio-posts', 'audio-files']) {
    try {
      const testData = new Uint8Array([1, 2, 3]);
      const fileName = `test-${Date.now()}.txt`;
      
      const { data, error } = await supabase.storage
        .from(bucketName)
        .upload(fileName, testData, {
          contentType: 'text/plain',
          upsert: false
        });
      
      if (error) {
        console.log(`❌ ${bucketName}: ${error.message}`);
      } else {
        console.log(`✅ ${bucketName}: FUNCIONOU!`);
        
        // Limpar
        await supabase.storage
          .from(bucketName)
          .remove([fileName]);
      }
      
    } catch (err) {
      console.log(`❌ ${bucketName}: Erro -`, err);
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log('🎯 SOLUÇÃO:');
  console.log('1. Crie um bucket "supabase" no MinIO');
  console.log('2. Configure como público');
  console.log('3. Reinicie o container storage');
  console.log('4. OU altere GLOBAL_S3_BUCKET no docker-compose');
}

testSupabaseBucket(); 