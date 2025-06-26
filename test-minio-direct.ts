import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://supabase.nutef.com";
const SUPABASE_SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.ewogICJyb2xlIjogInNlcnZpY2Vfcm9sZSIsCiAgImlzcyI6ICJzdXBhYmFzZSIsCiAgImlhdCI6IDE3MTUwNTA4MDAsCiAgImV4cCI6IDE4NzI4MTcyMDAKfQ.Y0Ai9IMrIhHc79Gzxsh9Nl9QnyLXQar0ZrU6kEE8XAs";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function checkStorageEndpoint() {
  console.log('🔍 Verificando endpoints do storage...');
  
  try {
    // Testar endpoint do storage diretamente
    const response = await fetch(`${SUPABASE_URL}/storage/v1/bucket`, {
      headers: {
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('📊 Status HTTP:', response.status);
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Buckets no Supabase Storage API:', data.map((b: any) => b.name));
    } else {
      const error = await response.text();
      console.log('❌ Erro na API:', error);
    }
    
  } catch (err) {
    console.log('❌ Erro de conectividade:', err);
  }
}

async function testMinioDirectly() {
  console.log('\n🎯 Testando MinIO S3 diretamente...');
  
  try {
    // Testar endpoint S3 do MinIO diretamente
    const s3Endpoint = 'https://s3.nutef.com'; // baseado no seu docker-compose
    
    const response = await fetch(s3Endpoint, {
      method: 'GET'
    });
    
    console.log('📊 MinIO S3 Status:', response.status);
    console.log('🔗 MinIO S3 Headers:', Object.fromEntries(response.headers.entries()));
    
  } catch (err) {
    console.log('❌ Erro ao conectar no MinIO S3:', err);
  }
}

async function createBucketViaAPI() {
  console.log('\n🪣 Tentando criar buckets via API...');
  
  const buckets = ['public', 'audio-posts', 'audio-files'];
  
  for (const bucketName of buckets) {
    try {
      console.log(`\n📦 Criando bucket: ${bucketName}`);
      
      const { data, error } = await supabase.storage.createBucket(bucketName, {
        public: true,
        fileSizeLimit: 52428800 // 50MB
      });
      
      if (error) {
        if (error.message.includes('already exists')) {
          console.log(`✅ Bucket '${bucketName}' já existe`);
        } else {
          console.log(`❌ Erro ao criar '${bucketName}':`, error.message);
          console.log('📋 Detalhes:', error);
        }
      } else {
        console.log(`✅ Bucket '${bucketName}' criado:`, data);
      }
      
    } catch (err) {
      console.log(`❌ Erro com bucket '${bucketName}':`, err);
    }
  }
}

async function forceCreateBucketTest() {
  console.log('\n🔨 Teste de criação forçada...');
  
  try {
    // Tentar criar um bucket com nome único
    const testBucketName = `test-bucket-${Date.now()}`;
    
    const { data, error } = await supabase.storage.createBucket(testBucketName, {
      public: true
    });
    
    if (error) {
      console.log('❌ Erro ao criar bucket de teste:', error.message);
      console.log('📋 Detalhes completos:', error);
    } else {
      console.log('✅ Bucket de teste criado com sucesso:', data);
      
      // Tentar fazer upload nele
      const testData = new Uint8Array([1, 2, 3]);
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from(testBucketName)
        .upload('test.txt', testData);
      
      if (uploadError) {
        console.log('❌ Erro no upload de teste:', uploadError.message);
      } else {
        console.log('✅ Upload de teste funcionou:', uploadData);
      }
      
      // Limpar bucket de teste
      await supabase.storage.deleteBucket(testBucketName);
      console.log('🗑️ Bucket de teste removido');
    }
    
  } catch (err) {
    console.log('❌ Erro no teste forçado:', err);
  }
}

async function main() {
  console.log('🚀 Diagnóstico completo do MinIO...');
  console.log('=' .repeat(50));
  
  await checkStorageEndpoint();
  await testMinioDirectly();
  await createBucketViaAPI();
  await forceCreateBucketTest();
  
  console.log('\n' + '='.repeat(50));
  console.log('✅ Diagnóstico concluído!');
  console.log('\n💡 Se ainda não funcionar, crie os buckets manualmente na interface web do MinIO');
}

main(); 