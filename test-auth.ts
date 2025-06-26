import { createClient } from '@supabase/supabase-js';

const SUPABASE_SELF_HOSTED_URL = "https://supabase.nutef.com";
const SUPABASE_SELF_HOSTED_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.ewogICJyb2xlIjogImFub24iLAogICJpc3MiOiAic3VwYWJhc2UiLAogICJpYXQiOiAxNzE1MDUwODAwLAogICJleHAiOiAxODcyODE3MjAwCn0.zii4FynaxJNS8fGXKYKcnqiUw0DzIuLFB0MMz4ImjEE";

const supabase = createClient(SUPABASE_SELF_HOSTED_URL, SUPABASE_SELF_HOSTED_ANON_KEY);

async function testAuthFlow() {
  console.log('🔐 Testando processo de autenticação...\n');
  
  const testEmail = 'bugzoid@nutef.com';
  const testPassword = 'test123456';
  
  try {
    console.log('1️⃣ Testando login com credenciais existentes...');
    const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
      email: testEmail,
      password: testPassword,
    });
    
    if (loginError) {
      console.error('❌ Erro no login:', loginError.message);
      console.error('Detalhes:', loginError);
      
      // Vamos tentar resetar a senha
      console.log('\n2️⃣ Tentando reset de senha...');
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(testEmail, {
        redirectTo: 'http://localhost:5173/reset-password'
      });
      
      if (resetError) {
        console.error('❌ Erro no reset:', resetError.message);
      } else {
        console.log('✅ Email de reset enviado!');
      }
    } else {
      console.log('✅ Login realizado com sucesso!');
      console.log('Usuário:', loginData.user?.email);
      console.log('Session:', !!loginData.session);
      
      // Fazer logout
      await supabase.auth.signOut();
      console.log('✅ Logout realizado!');
    }
    
  } catch (error) {
    console.error('❌ Erro geral:', error);
  }
  
  // Testar configurações de autenticação
  console.log('\n3️⃣ Verificando configurações de autenticação...');
  
  try {
    // Tentar acessar settings (pode não funcionar com anon key)
    const response = await fetch(`${SUPABASE_SELF_HOSTED_URL}/auth/v1/settings`, {
      headers: {
        'apikey': SUPABASE_SELF_HOSTED_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_SELF_HOSTED_ANON_KEY}`
      }
    });
    
    if (response.ok) {
      const settings = await response.json();
      console.log('✅ Configurações de auth:', settings);
    } else {
      console.log('⚠️ Não foi possível acessar configurações (normal com anon key)');
    }
  } catch (error) {
    console.log('⚠️ Erro ao verificar configurações:', error.message);
  }
  
  // Verificar usuários existentes
  console.log('\n4️⃣ Verificando usuários no banco...');
  try {
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('*')
      .limit(5);
    
    if (profilesError) {
      console.error('❌ Erro ao buscar profiles:', profilesError.message);
    } else {
      console.log(`✅ Encontrados ${profiles?.length || 0} profiles no banco`);
      profiles?.forEach(profile => {
        console.log(`  - ${profile.display_name || profile.username || 'Sem nome'} (${profile.id})`);
      });
    }
  } catch (error) {
    console.error('❌ Erro ao verificar profiles:', error);
  }
  
  console.log('\n='.repeat(50));
  console.log('🔍 DIAGNÓSTICO:');
  console.log('- Se o login falhar, pode ser problema de configuração de senha');
  console.log('- Verifique se o email de confirmação foi clicado');
  console.log('- Confirme se as configurações de auth estão corretas no Supabase');
  console.log('='.repeat(50));
}

testAuthFlow().catch(console.error); 