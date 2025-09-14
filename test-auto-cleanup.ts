import { createClient } from '@supabase/supabase-js';

const SUPABASE_SELF_HOSTED_URL = "https://supabase.nutef.com";
const SUPABASE_SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.ewogICJyb2xlIjogInNlcnZpY2Vfcm9sZSIsCiAgImlzcyI6ICJzdXBhYmFzZSIsCiAgImlhdCI6IDE3MTUwNTA4MDAsCiAgImV4cCI6IDE4NzI4MTcyMDAKfQ.Y0Ai9IMrIhHc79Gzxsh9Nl9QnyLXQar0ZrU6kEE8XAs";

const supabase = createClient(SUPABASE_SELF_HOSTED_URL, SUPABASE_SERVICE_KEY);

async function testCleanupFunction() {
  console.log('🧪 Testando função de limpeza de áudios expirados...\n');

  try {
    // 1. Verificar posts expirados no banco
    console.log('1️⃣ Verificando posts expirados no banco...');
    const { data: expiredPosts, error: fetchError } = await supabase
      .from('audio_posts')
      .select('id, audio_url, expires_at, status, created_at')
      .lt('expires_at', new Date().toISOString())
      .eq('status', 'active');

    if (fetchError) {
      console.error('❌ Erro ao buscar posts expirados:', fetchError);
      return;
    }

    console.log(`📋 Encontrados ${expiredPosts?.length || 0} posts expirados`);
    
    if (expiredPosts && expiredPosts.length > 0) {
      expiredPosts.forEach(post => {
        const now = new Date();
        const expiresAt = new Date(post.expires_at);
        const diffHours = Math.round((now.getTime() - expiresAt.getTime()) / (1000 * 60 * 60));
        console.log(`   - Post ${post.id}: expirou há ${diffHours} horas`);
      });
    }

    // 2. Chamar a Edge Function de limpeza
    console.log('\n2️⃣ Chamando Edge Function de limpeza...');
    const { data: cleanupResult, error: cleanupError } = await supabase.functions
      .invoke('cleanup-expired-audios', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      });

    if (cleanupError) {
      console.error('❌ Erro na Edge Function:', cleanupError);
      return;
    }

    console.log('✅ Resultado da limpeza:', cleanupResult);

    // 3. Verificar se posts foram realmente deletados
    console.log('\n3️⃣ Verificando se posts foram deletados...');
    const { data: remainingExpired, error: verifyError } = await supabase
      .from('audio_posts')
      .select('id, expires_at, status')
      .lt('expires_at', new Date().toISOString())
      .eq('status', 'active');

    if (verifyError) {
      console.error('❌ Erro ao verificar posts restantes:', verifyError);
      return;
    }

    console.log(`📊 Posts expirados restantes: ${remainingExpired?.length || 0}`);

    // 4. Verificar todos os posts ativos
    console.log('\n4️⃣ Verificando posts ativos restantes...');
    const { data: activePosts, error: activeError } = await supabase
      .from('audio_posts')
      .select('id, expires_at, status, created_at')
      .eq('status', 'active');

    if (activeError) {
      console.error('❌ Erro ao buscar posts ativos:', activeError);
      return;
    }

    console.log(`📈 Total de posts ativos: ${activePosts?.length || 0}`);
    
    if (activePosts && activePosts.length > 0) {
      const now = new Date();
      activePosts.forEach(post => {
        const expiresAt = new Date(post.expires_at);
        const diffHours = Math.round((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60));
        if (diffHours < 0) {
          console.log(`⚠️ Post ${post.id} deveria ter expirado há ${Math.abs(diffHours)} horas`);
        }
      });
    }

    console.log('\n✅ Teste da função de limpeza concluído!');

  } catch (error) {
    console.error('❌ Erro geral no teste:', error);
  }
}

// Função para agendar limpeza automática
async function scheduleAutomaticCleanup() {
  console.log('\n🔄 Configurando limpeza automática...');
  
  try {
    // Criar função SQL para chamada automática
    const cleanupSchedulerSQL = `
      -- Função para chamar Edge Function de limpeza
      CREATE OR REPLACE FUNCTION schedule_audio_cleanup()
      RETURNS void
      LANGUAGE plpgsql
      AS $$
      BEGIN
        -- Esta função seria chamada por um cron job externo
        -- ou por um trigger temporal
        RAISE NOTICE 'Limpeza automática agendada executada em %', NOW();
      END;
      $$;
      
      -- Agendar execução a cada hora (se pg_cron estiver disponível)
      -- SELECT cron.schedule('audio-cleanup', '0 * * * *', 'SELECT schedule_audio_cleanup();');
    `;

    const { error } = await supabase.rpc('exec_sql', {
      sql_query: cleanupSchedulerSQL
    });

    if (error) {
      console.error('❌ Erro ao criar função de agendamento:', error);
    } else {
      console.log('✅ Função de agendamento criada com sucesso');
    }

  } catch (error) {
    console.error('❌ Erro ao configurar limpeza automática:', error);
  }
}

// Executar testes
console.log('🚀 Iniciando teste da funcionalidade de limpeza automática...\n');
testCleanupFunction()
  .then(() => scheduleAutomaticCleanup())
  .catch(console.error);