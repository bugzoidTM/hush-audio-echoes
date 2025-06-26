import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://supabase.nutef.com";
const SUPABASE_SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.ewogICJyb2xlIjogInNlcnZpY2Vfcm9sZSIsCiAgImlzcyI6ICJzdXBhYmFzZSIsCiAgImlhdCI6IDE3MTUwNTA4MDAsCiAgImV4cCI6IDE4NzI4MTcyMDAKfQ.Y0Ai9IMrIhHc79Gzxsh9Nl9QnyLXQar0ZrU6kEE8XAs";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function diagnoseMinio() {
  console.log('🔍 DIAGNÓSTICO COMPLETO S3/MinIO');
  console.log('=' .repeat(50));

  // 1. Testar endpoint do Storage API
  console.log('\n1️⃣ Testando Storage API...');
  try {
    const response = await fetch(`${SUPABASE_URL}/storage/v1/bucket`, {
      headers: {
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'apikey': SUPABASE_SERVICE_KEY
      }
    });
    
    console.log('📊 Status:', response.status);
    if (response.ok) {
      const buckets = await response.json();
      console.log('✅ API Buckets:', buckets.map((b: any) => b.name));
    } else {
      console.log('❌ API Error:', await response.text());
    }
  } catch (err) {
    console.log('❌ Storage API falhou:', err);
  }

  // 2. Testar endpoint S3 direto
  console.log('\n2️⃣ Testando MinIO S3 direto...');
  const s3Endpoints = [
    'https://s3.nutef.com',
    'https://minio.nutef.com',
    'https://supabase.nutef.com/storage/v1/s3'
  ];

  for (const endpoint of s3Endpoints) {
    try {
      const response = await fetch(endpoint);
      console.log(`📊 ${endpoint}: ${response.status}`);
    } catch (err: any) {
      console.log(`❌ ${endpoint}: ${err.message}`);
    }
  }

  // 3. Testar criação de bucket via API crua
  console.log('\n3️⃣ Testando criação via API crua...');
  try {
    const testBucket = `test-debug-${Date.now()}`;
    
    const response = await fetch(`${SUPABASE_URL}/storage/v1/bucket`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'apikey': SUPABASE_SERVICE_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        id: testBucket,
        name: testBucket,
        public: true
      })
    });

    console.log('📊 Criação bucket status:', response.status);
    if (response.ok) {
      const result = await response.json();
      console.log('✅ Bucket criado:', result);
      
      // Tentar upload via API crua
      console.log('\n4️⃣ Testando upload via API crua...');
      const uploadResponse = await fetch(`${SUPABASE_URL}/storage/v1/object/${testBucket}/test.txt`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
          'apikey': SUPABASE_SERVICE_KEY,
          'Content-Type': 'text/plain'
        },
        body: 'Hello MinIO'
      });
      
      console.log('📊 Upload status:', uploadResponse.status);
      if (uploadResponse.ok) {
        console.log('✅ Upload funcionou!');
      } else {
        const error = await uploadResponse.text();
        console.log('❌ Upload falhou:', error);
      }
      
    } else {
      const error = await response.text();
      console.log('❌ Criação falhou:', error);
    }
  } catch (err) {
    console.log('❌ Erro na criação crua:', err);
  }

  // 5. Verificar configuração do Storage
  console.log('\n5️⃣ Verificando configuração do Storage...');
  try {
    const configResponse = await fetch(`${SUPABASE_URL}/storage/v1/bucket`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'apikey': SUPABASE_SERVICE_KEY
      }
    });
    
    if (configResponse.ok) {
      const buckets = await configResponse.json();
      console.log('📋 Configuração atual:');
      buckets.forEach((bucket: any) => {
        console.log(`  - ${bucket.name}: público=${bucket.public}, limite=${bucket.file_size_limit}`);
      });
    }
  } catch (err) {
    console.log('❌ Erro ao verificar config:', err);
  }

  // 6. Testar via Supabase client com debug
  console.log('\n6️⃣ Debug do Supabase Client...');
  
  // Tentar listar objetos em bucket existente
  for (const bucketName of ['public', 'audio-posts', 'audio-files']) {
    try {
      console.log(`\n📂 Testando bucket: ${bucketName}`);
      
      // Listar arquivos
      const { data: files, error: listError } = await supabase.storage
        .from(bucketName)
        .list('', { limit: 1 });
      
      if (listError) {
        console.log(`❌ Erro ao listar ${bucketName}:`, listError.message);
        if (listError.message.includes('JWT')) {
          console.log('🔑 Possível problema de autenticação');
        }
      } else {
        console.log(`✅ Listagem ${bucketName}: OK (${files?.length || 0} arquivos)`);
      }

      // Tentar upload mínimo
      const testData = new Uint8Array([1]);
      const { error: uploadError } = await supabase.storage
        .from(bucketName)
        .upload(`debug-${Date.now()}.txt`, testData, {
          contentType: 'text/plain',
          upsert: false
        });
      
      if (uploadError) {
        console.log(`❌ Upload ${bucketName}:`, uploadError.message);
        console.log(`📋 Erro detalhado:`, uploadError);
      } else {
        console.log(`✅ Upload ${bucketName}: SUCCESS!`);
      }
      
    } catch (err) {
      console.log(`❌ Erro geral ${bucketName}:`, err);
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log('🏁 Diagnóstico concluído');
}

diagnoseMinio(); 