import { createClient } from '@supabase/supabase-js';

const SUPABASE_SELF_HOSTED_URL = "https://supabase.nutef.com";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.ewogICJyb2xlIjogImFub24iLAogICJpc3MiOiAic3VwYWJhc2UiLAogICJpYXQiOiAxNzE1MDUwODAwLAogICJleHAiOiAxODcyODE3MjAwCn0.zii4FynaxJNS8fGXKYKcnqiUw0DzIuLFB0MMz4ImjEE";

const supabase = createClient(SUPABASE_SELF_HOSTED_URL, SUPABASE_ANON_KEY);

async function debug500Error() {
  console.log('🔍 DEBUG: Erro 500 na criação de usuário');
  console.log('='.repeat(50));
  
  try {
    // 1. Verificar se o endpoint de auth está funcionando
    console.log('\n1️⃣ Verificando conectividade com auth...');
    
    try {
      const response = await fetch(`${SUPABASE_SELF_HOSTED_URL}/auth/v1/settings`, {
        headers: {
          'apikey': SUPABASE_ANON_KEY
        }
      });
      
      console.log('Status da API auth:', response.status);
      if (response.ok) {
        const settings = await response.json();
        console.log('✅ API auth funcionando');
        console.log('Configurações:', {
          disable_signup: settings.disable_signup,
          external_email_enabled: settings.external_email_enabled,
          external_phone_enabled: settings.external_phone_enabled
        });
      }
    } catch (error) {
      console.error('❌ Erro na API auth:', error.message);
    }
    
    // 2. Verificar se há bloqueios no signup
    console.log('\n2️⃣ Verificando se signup está habilitado...');
    
    // Tentar um signup com dados mínimos
    const testEmail = `debug-500-${Date.now()}@nutef.com`;
    console.log('📧 Testando com email:', testEmail);
    
    const { data: signupData, error: signupError } = await supabase.auth.signUp({
      email: testEmail,
      password: 'Debug123!'
    });
    
    if (signupError) {
      console.error('❌ Erro no signup:', signupError.message);
      console.error('Código:', signupError.status);
      console.error('Detalhes completos:', JSON.stringify(signupError, null, 2));
      
      // Verificar se é problema específico
      if (signupError.message.includes('Database error saving new user')) {
        console.log('\n🔧 SOLUÇÃO IDENTIFICADA:');
        console.log('O problema é na função handle_new_user(). Execute no SQL Editor:');
        console.log('');
        console.log('-- 1. Remover trigger problemático');
        console.log('DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;');
        console.log('');
        console.log('-- 2. Testar signup sem trigger');
        console.log('-- Se funcionar, então o problema é na função');
      }
      
      if (signupError.message.includes('Invalid redirect URL')) {
        console.log('\n🔧 PROBLEMA DE REDIRECT URL:');
        console.log('Configure no painel do Supabase:');
        console.log('- Auth -> Settings -> Redirect URLs');
        console.log('- Adicione: https://shhhh.me/shhhh');
      }
      
      return;
    }
    
    console.log('✅ Signup funcionou!');
    console.log('Dados:', signupData);
    
    // 3. Verificar se as tabelas relacionadas foram populadas
    console.log('\n3️⃣ Verificando se trigger funcionou...');
    
    if (signupData.user?.id) {
      // Verificar profiles
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', signupData.user.id)
        .single();
      
      if (profileError) {
        console.error('❌ Profile não criado:', profileError.message);
      } else {
        console.log('✅ Profile criado:', profile);
      }
      
      // Verificar user_roles
      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('*')
        .eq('user_id', signupData.user.id);
      
      if (rolesError) {
        console.error('❌ Roles não criados:', rolesError.message);
      } else {
        console.log('✅ Roles criados:', roles);
      }
      
      // Verificar user_stats
      const { data: stats, error: statsError } = await supabase
        .from('user_stats')
        .select('*')
        .eq('user_id', signupData.user.id);
      
      if (statsError) {
        console.error('❌ Stats não criados:', statsError.message);
      } else {
        console.log('✅ Stats criados:', stats);
      }
    }
    
    console.log('\n='.repeat(50));
    console.log('🎉 DEBUG COMPLETO!');
    console.log('Se chegou até aqui, o problema foi resolvido!');
    console.log('='.repeat(50));
    
  } catch (error) {
    console.error('❌ Erro geral no debug:', error);
    
    if (error.message.includes('fetch')) {
      console.log('\n🔧 PROBLEMA DE CONECTIVIDADE:');
      console.log('- Verifique se o Supabase está rodando');
      console.log('- Confirme a URL: https://supabase.nutef.com');
      console.log('- Teste acesso direto no navegador');
    }
  }
}

debug500Error(); 