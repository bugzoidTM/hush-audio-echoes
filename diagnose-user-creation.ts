import { createClient } from '@supabase/supabase-js';

const SUPABASE_SELF_HOSTED_URL = "https://supabase.nutef.com";
const SUPABASE_SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.ewogICJyb2xlIjogInNlcnZpY2Vfcm9sZSIsCiAgImlzcyI6ICJzdXBhYmFzZSIsCiAgImlhdCI6IDE3MTUwNTA4MDAsCiAgImV4cCI6IDE4NzI4MTcyMDAKfQ.mLEE7mlYbUUdOvRGKrN4MlAkVJJ1xOJDgLJiYLbP8A4";

const supabase = createClient(SUPABASE_SELF_HOSTED_URL, SUPABASE_SERVICE_KEY);

async function diagnoseUserCreation() {
  console.log('🔍 DIAGNÓSTICO: Problema de criação de usuário');
  console.log('='.repeat(50));
  
  try {
    // 1. Verificar se as tabelas existem
    console.log('\n1️⃣ Verificando existência das tabelas...');
    
    const tables = ['profiles', 'user_roles', 'user_stats'];
    
    for (const table of tables) {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .limit(1);
      
      if (error) {
        console.error(`❌ Tabela ${table}: ${error.message}`);
      } else {
        console.log(`✅ Tabela ${table}: OK`);
      }
    }
    
    // 2. Verificar estrutura das tabelas
    console.log('\n2️⃣ Verificando estrutura das tabelas...');
    
    const { data: profilesInfo, error: profilesError } = await supabase
      .rpc('get_table_info', { table_name: 'profiles' });
    
    if (profilesError) {
      console.log('⚠️ Não foi possível verificar estrutura das tabelas');
    }
    
    // 3. Verificar se a função handle_new_user existe
    console.log('\n3️⃣ Verificando função handle_new_user...');
    
    const { data: functionData, error: functionError } = await supabase
      .rpc('check_function_exists', { function_name: 'handle_new_user' });
    
    if (functionError) {
      console.log('⚠️ Não foi possível verificar função handle_new_user');
    }
    
    // 4. Verificar se os ENUMs existem
    console.log('\n4️⃣ Verificando ENUMs...');
    
    const enums = ['app_role', 'audio_status', 'report_status', 'challenge_status'];
    
    for (const enumName of enums) {
      try {
        const { data, error } = await supabase
          .from('pg_type')
          .select('typname')
          .eq('typname', enumName);
        
        if (error) {
          console.log(`❌ ENUM ${enumName}: ${error.message}`);
        } else if (data && data.length > 0) {
          console.log(`✅ ENUM ${enumName}: OK`);
        } else {
          console.log(`❌ ENUM ${enumName}: Não encontrado`);
        }
      } catch (error) {
        console.log(`⚠️ ENUM ${enumName}: Erro ao verificar`);
      }
    }
    
    // 5. Testar inserção manual nas tabelas
    console.log('\n5️⃣ Testando inserção manual...');
    
    const testUserId = 'test-user-' + Date.now();
    
    // Testar inserção na tabela profiles
    console.log('Testando inserção em profiles...');
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .insert({
        id: testUserId,
        username: 'test_user',
        display_name: 'Test User'
      })
      .select();
    
    if (profileError) {
      console.error('❌ Erro ao inserir em profiles:', profileError.message);
    } else {
      console.log('✅ Inserção em profiles: OK');
      
      // Limpar dados de teste
      await supabase.from('profiles').delete().eq('id', testUserId);
    }
    
    // Testar inserção na tabela user_roles
    console.log('Testando inserção em user_roles...');
    const { data: roleData, error: roleError } = await supabase
      .from('user_roles')
      .insert({
        user_id: testUserId,
        role: 'user'
      })
      .select();
    
    if (roleError) {
      console.error('❌ Erro ao inserir em user_roles:', roleError.message);
    } else {
      console.log('✅ Inserção em user_roles: OK');
      
      // Limpar dados de teste
      await supabase.from('user_roles').delete().eq('user_id', testUserId);
    }
    
    // Testar inserção na tabela user_stats
    console.log('Testando inserção em user_stats...');
    const { data: statsData, error: statsError } = await supabase
      .from('user_stats')
      .insert({
        user_id: testUserId
      })
      .select();
    
    if (statsError) {
      console.error('❌ Erro ao inserir em user_stats:', statsError.message);
    } else {
      console.log('✅ Inserção em user_stats: OK');
      
      // Limpar dados de teste
      await supabase.from('user_stats').delete().eq('user_id', testUserId);
    }
    
    console.log('\n='.repeat(50));
    console.log('📋 RESUMO DO DIAGNÓSTICO:');
    console.log('- Verifique os erros acima para identificar o problema');
    console.log('- Provavelmente uma tabela não existe ou tem estrutura incorreta');
    console.log('- Ou um ENUM não foi criado corretamente');
    console.log('='.repeat(50));
    
  } catch (error) {
    console.error('❌ Erro geral no diagnóstico:', error);
  }
}

diagnoseUserCreation(); 