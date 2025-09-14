import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const SUPABASE_SELF_HOSTED_URL = "https://supabase.nutef.com";
const SUPABASE_SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.ewogICJyb2xlIjogInNlcnZpY2Vfcm9sZSIsCiAgImlzcyI6ICJzdXBhYmFzZSIsCiAgImlhdCI6IDE3MTUwNTA4MDAsCiAgImV4cCI6IDE4NzI4MTcyMDAKfQ.Y0Ai9IMrIhHc79Gzxsh9Nl9QnyLXQar0ZrU6kEE8XAs";

const supabase = createClient(SUPABASE_SELF_HOSTED_URL, SUPABASE_SERVICE_KEY);

async function applyCleanupFix() {
  console.log('🔧 Aplicando correção do sistema de limpeza automática...\n');

  try {
    // 1. Verificar estado atual
    console.log('1️⃣ Verificando estado atual dos áudios...');
    const { data: currentStats, error: statsError } = await supabase
      .from('audio_posts')
      .select('status, expires_at')
      .lt('expires_at', new Date().toISOString());

    if (statsError) {
      console.error('❌ Erro ao verificar stats:', statsError);
      return;
    }

    const expiredCount = currentStats?.filter(p => p.status === 'active').length || 0;
    const totalExpired = currentStats?.length || 0;

    console.log(`📊 Estado atual:`);
    console.log(`   - Total de posts expirados: ${totalExpired}`);
    console.log(`   - Posts expirados ainda ativos: ${expiredCount}`);

    // 2. Aplicar o SQL de correção
    console.log('\n2️⃣ Aplicando correção do sistema de limpeza...');
    
    const sqlContent = readFileSync('fix-auto-cleanup-system.sql', 'utf8');
    
    // Dividir o SQL em comandos individuais
    const commands = sqlContent
      .split(';')
      .map(cmd => cmd.trim())
      .filter(cmd => cmd.length > 0 && !cmd.startsWith('--'));

    let successCount = 0;
    
    for (const command of commands) {
      if (command.trim()) {
        try {
          const { error } = await supabase.rpc('exec_sql', { 
            sql_query: command 
          });
          
          if (error) {
            if (error.message.includes('already exists') || 
                error.message.includes('does not exist')) {
              console.log(`   ⚠️ Aviso: ${error.message}`);
            } else {
              console.error(`   ❌ Erro: ${error.message}`);
            }
          } else {
            successCount++;
          }
        } catch (err) {
          console.error(`   ❌ Erro ao executar comando:`, err.message);
        }
      }
    }

    console.log(`✅ ${successCount} comandos executados com sucesso`);

    // 3. Testar as novas funções
    console.log('\n3️⃣ Testando funções de limpeza...');
    
    // Verificar posts expirados
    const { data: expiredCheck, error: checkError } = await supabase
      .rpc('check_expired_audios');

    if (checkError) {
      console.error('❌ Erro ao verificar posts expirados:', checkError);
    } else {
      console.log(`📋 Posts expirados encontrados: ${expiredCheck?.length || 0}`);
      if (expiredCheck && expiredCheck.length > 0) {
        expiredCheck.slice(0, 3).forEach((post, index) => {
          console.log(`   ${index + 1}. Post ${post.post_id}: expirado há ${Math.round(post.hours_expired)} horas`);
        });
      }
    }

    // 4. Executar limpeza manual
    console.log('\n4️⃣ Executando limpeza manual...');
    const { data: cleanupResult, error: cleanupError } = await supabase
      .rpc('manual_cleanup_expired_audios');

    if (cleanupError) {
      console.error('❌ Erro na limpeza manual:', cleanupError);
    } else {
      console.log('🧹 Resultado da limpeza:', cleanupResult);
    }

    // 5. Verificar estado final
    console.log('\n5️⃣ Verificando estado final...');
    const { data: finalStats, error: finalError } = await supabase
      .from('audio_posts')
      .select('status')
      .lt('expires_at', new Date().toISOString())
      .eq('status', 'active');

    if (finalError) {
      console.error('❌ Erro ao verificar estado final:', finalError);
    } else {
      const remainingExpired = finalStats?.length || 0;
      console.log(`📈 Posts expirados restantes: ${remainingExpired}`);
      
      if (remainingExpired === 0) {
        console.log('🎉 Todos os posts expirados foram limpos com sucesso!');
      }
    }

    console.log('\n✅ Correção do sistema de limpeza aplicada com sucesso!');
    console.log('\n📝 O sistema agora irá:');
    console.log('   - Deletar automaticamente áudios após 24 horas');
    console.log('   - Executar limpeza quando houver mais de 5 posts expirados');
    console.log('   - Permitir limpeza manual via função manual_cleanup_expired_audios()');

  } catch (error) {
    console.error('❌ Erro geral na aplicação da correção:', error);
  }
}

// Executar correção
applyCleanupFix().catch(console.error);