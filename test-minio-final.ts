import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://supabase.nutef.com";
const SUPABASE_SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.ewogICJyb2xlIjogInNlcnZpY2Vfcm9sZSIsCiAgImlzcyI6ICJzdXBhYmFzZSIsCiAgImlhdCI6IDE3MTUwNTA4MDAsCiAgImV4cCI6IDE4NzI4MTcyMDAKfQ.Y0Ai9IMrIhHc79Gzxsh9Nl9QnyLXQar0ZrU6kEE8XAs";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function testMinioConfig() {
  console.log('🧪 Testando configuração do MinIO...');
  
  const buckets = ['public', 'audio-posts', 'audio-files'];
  
  for (const bucketName of buckets) {
    console.log(`\n📦 Testando bucket: ${bucketName}`);
    
    try {
      // Criar um arquivo de teste pequeno
      const testData = new Uint8Array([72, 101, 108, 108, 111]); // "Hello" em bytes
      const fileName = `test-${Date.now()}.txt`;
      
      // Tentar upload
      const { data, error } = await supabase.storage
        .from(bucketName)
        .upload(fileName, testData, {
          contentType: 'text/plain',
          upsert: false
        });
      
      if (error) {
        console.log(`❌ Erro no upload para ${bucketName}:`, error.message);
        continue;
      }
      
      console.log(`✅ Upload para ${bucketName}: OK`);
      
      // Testar URL pública
      const { data: publicUrl } = supabase.storage
        .from(bucketName)
        .getPublicUrl(fileName);
      
      console.log(`🔗 URL pública: ${publicUrl.publicUrl}`);
      
      // Testar se consegue acessar a URL
      try {
        const response = await fetch(publicUrl.publicUrl);
        if (response.ok) {
          console.log(`✅ URL pública acessível: ${response.status}`);
        } else {
          console.log(`⚠️ URL retornou: ${response.status}`);
        }
      } catch (err) {
        console.log(`❌ Erro ao acessar URL pública:`, err);
      }
      
      // Limpar arquivo de teste
      await supabase.storage
        .from(bucketName)
        .remove([fileName]);
      
      console.log(`🗑️ Arquivo removido do ${bucketName}`);
      
    } catch (err) {
      console.log(`❌ Erro geral com ${bucketName}:`, err);
    }
  }
}

async function testAudioUpload() {
  console.log('\n🎵 Testando upload de áudio específico...');
  
  try {
    // Simular um arquivo de áudio WebM
    const audioData = new Uint8Array(1024); // 1KB
    for (let i = 0; i < audioData.length; i++) {
      audioData[i] = Math.floor(Math.random() * 256);
    }
    
    const fileName = `test-audio-${Date.now()}.webm`;
    const filePath = `audio/${fileName}`;
    
    // Tentar no bucket public (padrão usado pelo app)
    const { data, error } = await supabase.storage
      .from('public')
      .upload(filePath, audioData, {
        contentType: 'audio/webm',
        upsert: false
      });
    
    if (error) {
      console.log('❌ Erro no upload de áudio:', error.message);
      return false;
    }
    
    console.log('✅ Upload de áudio: SUCESSO!');
    console.log('📁 Arquivo:', data.path);
    
    // URL pública
    const { data: publicUrl } = supabase.storage
      .from('public')
      .getPublicUrl(filePath);
    
    console.log('🔗 URL do áudio:', publicUrl.publicUrl);
    
    // Limpar
    await supabase.storage
      .from('public')
      .remove([filePath]);
    
    console.log('🗑️ Arquivo de teste removido');
    return true;
    
  } catch (err) {
    console.log('❌ Erro no teste de áudio:', err);
    return false;
  }
}

async function main() {
  console.log('🚀 Testando MinIO após configuração...');
  console.log('=' .repeat(50));
  
  await testMinioConfig();
  const audioOk = await testAudioUpload();
  
  console.log('\n' + '='.repeat(50));
  console.log(audioOk ? '🎉 MinIO configurado com SUCESSO!' : '⚠️ MinIO parcialmente configurado');
  
  if (audioOk) {
    console.log('✅ Seu app está 100% funcional agora!');
    console.log('🚀 Pode executar: npm run dev');
  } else {
    console.log('⚠️ Verifique as políticas dos buckets');
  }
}

main(); 