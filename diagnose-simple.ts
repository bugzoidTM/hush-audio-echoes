import { createClient } from '@supabase/supabase-js';

const SUPABASE_SELF_HOSTED_URL = "https://supabase.nutef.com";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.ewogICJyb2xlIjogImFub24iLAogICJpc3MiOiAic3VwYWJhc2UiLAogICJpYXQiOiAxNzE1MDUwODAwLAogICJleHAiOiAxODcyODE3MjAwCn0.zii4FynaxJNS8fGXKYKcnqiUw0DzIuLFB0MMz4ImjEE";

const supabase = createClient(SUPABASE_SELF_HOSTED_URL, SUPABASE_ANON_KEY);

async function diagnoseSimple() {
  console.log('🔍 DIAGNÓSTICO SIMPLES: Problema de criação de usuário');
  console.log('='.repeat(60));
  
  try {
    // 1. Verificar se podemos acessar a tabela profiles
    console.log('\n1️⃣ Verificando acesso à tabela profiles...');
    
    const { data: profilesData, error: profilesError } = await supabase
      .from('profiles')
      .select('*')
      .limit(1);
    
    if (profilesError) {
      console.error('❌ Tabela profiles:', profilesError.message);
    } else {
      console.log('✅ Tabela profiles: Acessível');
      console.log('📊 Registros encontrados:', profilesData?.length || 0);
    }
    
    // 2. Verificar se podemos acessar a tabela user_roles
    console.log('\n2️⃣ Verificando acesso à tabela user_roles...');
    
    const { data: rolesData, error: rolesError } = await supabase
      .from('user_roles')
      .select('*')
      .limit(1);
    
    if (rolesError) {
      console.error('❌ Tabela user_roles:', rolesError.message);
    } else {
      console.log('✅ Tabela user_roles: Acessível');
      console.log('📊 Registros encontrados:', rolesData?.length || 0);
    }
    
    // 3. Verificar se podemos acessar a tabela user_stats
    console.log('\n3️⃣ Verificando acesso à tabela user_stats...');
    
    const { data: statsData, error: statsError } = await supabase
      .from('user_stats')
      .select('*')
      .limit(1);
    
    if (statsError) {
      console.error('❌ Tabela user_stats:', statsError.message);
    } else {
      console.log('✅ Tabela user_stats: Acessível');
      console.log('📊 Registros encontrados:', statsData?.length || 0);
    }
    
    // 4. Tentar criar um usuário mais simples (sem trigger)
    console.log('\n4️⃣ Testando criação de usuário sem trigger...');
    
    // Primeiro, vamos desabilitar temporariamente o trigger
    console.log('⚠️ Para resolver o problema, execute no painel SQL do Supabase:');
    console.log('');
    console.log('-- Desabilitar trigger temporariamente');
    console.log('DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;');
    console.log('');
    
    // Tentar criar usuário sem trigger
    const testEmail = `teste-sem-trigger-${Date.now()}@nutef.com`;
    const testPassword = 'Teste123!';
    
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: testEmail,
      password: testPassword,
      options: {
        data: {
          username: 'teste_usuario',
          display_name: 'Teste Usuário'
        }
      }
    });
    
    if (signUpError) {
      console.error('❌ Erro ao criar usuário sem trigger:', signUpError.message);
    } else {
      console.log('✅ Usuário criado com sucesso sem trigger!');
      console.log('👤 ID:', signUpData.user?.id);
      console.log('📧 Email:', signUpData.user?.email);
      
      // Agora tentar criar o perfil manualmente
      console.log('\n5️⃣ Tentando criar perfil manualmente...');
      
      if (signUpData.user?.id) {
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .insert({
            id: signUpData.user.id,
            username: 'teste_usuario',
            display_name: 'Teste Usuário'
          })
          .select();
        
        if (profileError) {
          console.error('❌ Erro ao criar perfil:', profileError.message);
        } else {
          console.log('✅ Perfil criado com sucesso!');
        }
      }
    }
    
    console.log('\n='.repeat(60));
    console.log('📋 PRÓXIMOS PASSOS:');
    console.log('1. Execute o SQL acima para desabilitar o trigger');
    console.log('2. Teste criar usuário novamente');
    console.log('3. Se funcionar, o problema está na função handle_new_user');
    console.log('4. Então corrija a função e reative o trigger');
    console.log('='.repeat(60));
    
  } catch (error) {
    console.error('❌ Erro geral:', error);
  }
}

diagnoseSimple(); 