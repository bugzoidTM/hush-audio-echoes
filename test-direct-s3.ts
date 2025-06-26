import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://supabase.nutef.com";
const SUPABASE_SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.ewogICJyb2xlIjogInNlcnZpY2Vfcm9sZSIsCiAgImlzcyI6ICJzdXBhYmFzZSIsCiAgImlhdCI6IDE3MTUwNTA4MDAsCiAgImV4cCI6IDE4NzI4MTcyMDAKfQ.Y0Ai9IMrIhHc79Gzxsh9Nl9QnyLXQar0ZrU6kEE8XAs";

// Credenciais do MinIO do docker-compose
const MINIO_ENDPOINT = "https://s3.nutef.com";
const MINIO_ACCESS_KEY = "LEIWdZz58Q886CM5g1Il";
const MINIO_SECRET_KEY = "evCOblozSP80OMGQOXJVRfsjWeKj7Dgj4cF4yVsH";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function testDirectS3() {
  console.log('🔍 TESTE DIRETO S3/MinIO');
  console.log('=' .repeat(50));

  // Testar conexão direta com MinIO S3
  console.log('\n1️⃣ Testando conexão direta S3...');
  
  const s3Endpoints = [
    'https://s3.nutef.com',
    'https://minio.nutef.com',
    'https://supabase.nutef.com:9000'
  ];

  for (const endpoint of s3Endpoints) {
    try {
      const response = await fetch(endpoint);
      console.log(`📊 ${endpoint}: Status ${response.status}`);
      
      if (response.status === 403) {
        console.log('   ✅ MinIO está respondendo (403 = sem auth)');
      }
    } catch (err: any) {
      console.log(`❌ ${endpoint}: ${err.message}`);
    }
  }

  // Testar listagem de buckets via S3 API
  console.log('\n2️⃣ Testando S3 ListBuckets...');
  try {
    const listResponse = await fetch(`${MINIO_ENDPOINT}`, {
      method: 'GET',
      headers: {
        'Host': 's3.nutef.com'
      }
    });
    
    console.log(`📊 ListBuckets Status: ${listResponse.status}`);
    const responseText = await listResponse.text();
    console.log(`📋 Response preview: ${responseText.substring(0, 200)}...`);
    
  } catch (err) {
    console.log('❌ Erro no ListBuckets:', err);
  }

  // Verificar se o Supabase consegue ver os buckets no MinIO
  console.log('\n3️⃣ Debug da configuração Supabase Storage...');
  
  // Tentar listar buckets via Storage API
  try {
    const response = await fetch(`${SUPABASE_URL}/storage/v1/bucket`, {
      headers: {
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'apikey': SUPABASE_SERVICE_KEY
      }
    });
    
    if (response.ok) {
      const buckets = await response.json();
      console.log('✅ Buckets no Supabase:', buckets.map((b: any) => b.name));
      
      // Para cada bucket, tentar operações básicas
      for (const bucket of buckets) {
        if (['public', 'audio-posts', 'audio-files'].includes(bucket.name)) {
          console.log(`\n📂 Testando bucket: ${bucket.name}`);
          
          // Tentar listar objetos
          try {
            const { data: objects, error: listError } = await supabase.storage
              .from(bucket.name)
              .list('', { limit: 1 });
              
            if (listError) {
              console.log(`❌ Erro ao listar ${bucket.name}:`, listError.message);
            } else {
              console.log(`✅ Listagem ${bucket.name}: ${objects?.length || 0} objetos`);
            }
          } catch (err) {
            console.log(`❌ Erro na listagem ${bucket.name}:`, err);
          }

          // Tentar upload simples
          const testData = new Uint8Array([1, 2, 3, 4, 5]);
          const fileName = `test-direct-${Date.now()}.txt`;
          
          try {
            const { data: uploadData, error: uploadError } = await supabase.storage
              .from(bucket.name)
              .upload(fileName, testData, {
                contentType: 'text/plain',
                upsert: false
              });
            
            if (uploadError) {
              console.log(`❌ Upload ${bucket.name}:`, uploadError.message);
              console.log(`📋 Detalhes:`, {
                statusCode: uploadError.statusCode,
                error: uploadError.error,
                message: uploadError.message
              });
            } else {
              console.log(`✅ Upload ${bucket.name}: SUCCESS!`);
              console.log(`📁 Arquivo: ${uploadData.path}`);
              
              // Tentar gerar URL pública
              const { data: urlData } = supabase.storage
                .from(bucket.name)
                .getPublicUrl(fileName);
              
              console.log(`🔗 URL pública: ${urlData.publicUrl}`);
              
              // Testar se a URL funciona
              try {
                const urlResponse = await fetch(urlData.publicUrl);
                console.log(`📊 URL Status: ${urlResponse.status}`);
              } catch (err) {
                console.log(`❌ Erro ao acessar URL:`, err);
              }
            }
          } catch (err) {
            console.log(`❌ Erro geral upload ${bucket.name}:`, err);
          }
        }
      }
      
    } else {
      console.log('❌ Erro na Storage API:', await response.text());
    }
    
  } catch (err) {
    console.log('❌ Erro na Storage API:', err);
  }

  console.log('\n' + '='.repeat(50));
  console.log('🏁 Teste direto concluído');
  
  // Mostrar informações de debug
  console.log('\n📋 INFORMAÇÕES DE DEBUG:');
  console.log(`Supabase URL: ${SUPABASE_URL}`);
  console.log(`MinIO S3 Endpoint: ${MINIO_ENDPOINT}`);
  console.log(`Access Key: ${MINIO_ACCESS_KEY}`);
  console.log(`Secret Key: ${MINIO_SECRET_KEY.substring(0, 8)}...`);
}

testDirectS3(); 