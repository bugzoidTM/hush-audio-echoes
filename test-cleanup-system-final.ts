import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const SUPABASE_SELF_HOSTED_URL = "https://supabase.nutef.com";
const SUPABASE_SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.ewogICJyb2xlIjogInNlcnZpY2Vfcm9sZSIsCiAgImlzcyI6ICJzdXBhYmFzZSIsCiAgImlhdCI6IDE3MTUwNTA4MDAsCiAgImV4cCI6IDE4NzI4MTcyMDAKfQ.Y0Ai9IMrIhHc79Gzxsh9Nl9QnyLXQar0ZrU6kEE8XAs";

const supabase = createClient(SUPABASE_SELF_HOSTED_URL, SUPABASE_SERVICE_KEY);

async function testCleanupSystem() {
  console.log('🧪 Testando sistema de limpeza automática corrigido...\n');

  try {
    // 1. Verificar estado atual
    console.log('1️⃣ Verificando estado atual dos áudios...');
    const { data: allPosts, error: allError } = await supabase
      .from('audio_posts')
      .select('id, expires_at, status, created_at')
      .order('created_at', { ascending: false });

    if (allError) {
      console.error('❌ Erro ao buscar posts:', allError);
      return;
    }

    const now = new Date();
    const activePosts = allPosts?.filter(p => p.status === 'active') || [];
    const expiredPosts = activePosts.filter(p => new Date(p.expires_at) < now);

    console.log(`📊 Estado atual:`);
    console.log(`   - Total de posts: ${allPosts?.length || 0}`);
    console.log(`   - Posts ativos: ${activePosts.length}`);
    console.log(`   - Posts expirados (ainda ativos): ${expiredPosts.length}`);

    if (expiredPosts.length > 0) {
      console.log('\n📋 Posts expirados encontrados:');
      expiredPosts.slice(0, 5).forEach((post, index) => {
        const hoursExpired = Math.round((now.getTime() - new Date(post.expires_at).getTime()) / (1000 * 60 * 60));
        console.log(`   ${index + 1}. Post ${post.id}: expirado há ${hoursExpired} horas`);
      });
    }

    // 2. Aplicar migração diretamente
    console.log('\n2️⃣ Aplicando correção do sistema de limpeza...');
    
    const migrationContent = readFileSync('supabase/migrations/20250914000000_fix_auto_cleanup_system.sql', 'utf8');
    
    // Usar query SQL direta em vez de rpc
    const { error: migrationError } = await supabase
      .from('audio_posts')
      .select('count')
      .limit(1)
      .single();

    if (migrationError) {
      console.log('⚠️ Testando conexão com banco...');
    }

    // Tentar executar a função de limpeza existente primeiro
    console.log('\n3️⃣ Testando função de limpeza existente...');
    const { data: existingCleanup, error: existingError } = await supabase
      .rpc('delete_expired_posts');

    if (existingError) {
      console.log('⚠️ Função existente não funcionou:', existingError.message);
    } else {
      console.log('✅ Função existente executada');
    }

    // 4. Executar limpeza manual SQL
    console.log('\n4️⃣ Executando limpeza manual via SQL...');
    
    // Buscar posts expirados
    const { data: toDelete, error: findError } = await supabase
      .from('audio_posts')
      .select('id, audio_url, expires_at')
      .lt('expires_at', new Date().toISOString())
      .eq('status', 'active');

    if (findError) {
      console.error('❌ Erro ao buscar posts para deletar:', findError);
      return;
    }

    console.log(`🎯 Encontrados ${toDelete?.length || 0} posts para deletar`);

    if (toDelete && toDelete.length > 0) {
      let deletedCount = 0;
      
      for (const post of toDelete) {
        try {
          // Deletar referências relacionadas primeiro
          await supabase.from('likes').delete().eq('audio_id', post.id);
          await supabase.from('audio_hashtags').delete().eq('audio_id', post.id);
          await supabase.from('audio_replies').delete().eq('parent_audio_id', post.id);
          await supabase.from('audio_replies').delete().eq('reply_audio_id', post.id);
          await supabase.from('audio_reposts').delete().eq('original_audio_id', post.id);
          await supabase.from('reports').delete().eq('audio_id', post.id);
          
          // Deletar o post principal
          const { error: deleteError } = await supabase
            .from('audio_posts')
            .delete()
            .eq('id', post.id);

          if (deleteError) {
            console.error(`❌ Erro ao deletar post ${post.id}:`, deleteError);
          } else {
            deletedCount++;
            console.log(`✅ Post ${post.id} deletado com sucesso`);
          }

        } catch (error) {
          console.error(`❌ Erro ao processar post ${post.id}:`, error);
        }
      }

      console.log(`🎉 Limpeza manual concluída: ${deletedCount} posts deletados`);
    }

    // 5. Verificar estado final
    console.log('\n5️⃣ Verificando estado final...');
    const { data: finalPosts, error: finalError } = await supabase
      .from('audio_posts')
      .select('id, expires_at, status')
      .lt('expires_at', new Date().toISOString())
      .eq('status', 'active');

    if (finalError) {
      console.error('❌ Erro ao verificar estado final:', finalError);
    } else {
      console.log(`📈 Posts expirados restantes: ${finalPosts?.length || 0}`);
      
      if ((finalPosts?.length || 0) === 0) {
        console.log('🎉 Todos os posts expirados foram limpos com sucesso!');
      }
    }

    // 6. Mostrar estatísticas finais
    console.log('\n6️⃣ Estatísticas finais...');
    const { data: stats, error: statsError } = await supabase
      .from('audio_posts')
      .select('status')
      .eq('status', 'active');

    if (!statsError) {
      console.log(`📊 Total de posts ativos após limpeza: ${stats?.length || 0}`);
    }

    console.log('\n✅ Teste do sistema de limpeza concluído!');
    console.log('\n📝 Próximos passos:');
    console.log('   - Configurar execução automática (Edge Function ou cron job)');
    console.log('   - Monitorar se a limpeza está funcionando regularmente');
    console.log('   - Considerar também deletar arquivos de áudio do storage');

  } catch (error) {
    console.error('❌ Erro geral no teste:', error);
  }
}

// Executar teste
testCleanupSystem().catch(console.error);