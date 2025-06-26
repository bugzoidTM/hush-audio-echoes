import { createClient } from '@supabase/supabase-js';

const SUPABASE_SELF_HOSTED_URL = "https://supabase.nutef.com";
const SUPABASE_SELF_HOSTED_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.ewogICJyb2xlIjogImFub24iLAogICJpc3MiOiAic3VwYWJhc2UiLAogICJpYXQiOiAxNzE1MDUwODAwLAogICJleHAiOiAxODcyODE3MjAwCn0.zii4FynaxJNS8fGXKYKcnqiUw0DzIuLFB0MMz4ImjEE";

const supabase = createClient(SUPABASE_SELF_HOSTED_URL, SUPABASE_SELF_HOSTED_ANON_KEY);

async function createTestUser() {
  console.log('👤 Criando usuário de teste...\n');
  
  const testEmail = 'teste@nutef.com';
  const testPassword = 'Teste123!';
  const testUsername = 'usuario_teste';
  
  try {
    console.log('1️⃣ Criando novo usuário...');
    
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: testEmail,
      password: testPassword,
      options: {
        data: {
          username: testUsername,
          display_name: 'Usuário Teste'
        }
      }
    });
    
    if (signUpError) {
      console.error('❌ Erro no cadastro:', signUpError.message);
      
      if (signUpError.message.includes('already registered')) {
        console.log('\n2️⃣ Usuário já existe, tentando login...');
        await testLogin(testEmail, testPassword);
        return;
      }
      
      return;
    }
    
    console.log('✅ Usuário criado com sucesso!');
    console.log('Email:', signUpData.user?.email);
    console.log('ID:', signUpData.user?.id);
    console.log('Email confirmado:', signUpData.user?.email_confirmed_at ? 'Sim' : 'Não');
    
    // Aguardar um pouco e tentar login
    console.log('\n3️⃣ Aguardando e tentando login...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    await testLogin(testEmail, testPassword);
    
  } catch (error) {
    console.error('❌ Erro geral:', error);
  }
}

async function testLogin(email: string, password: string) {
  try {
    console.log(`4️⃣ Testando login com ${email}...`);
    
    const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    if (loginError) {
      console.error('❌ Erro no login:', loginError.message);
      
      if (loginError.message.includes('Invalid login credentials')) {
        console.log('\n💡 DICA: O problema pode ser:');
        console.log('- Email não foi confirmado');
        console.log('- Senha incorreta');
        console.log('- Configuração de autenticação');
        
        console.log('\n🔧 SOLUÇÕES:');
        console.log('1. Confirme o email no painel admin do Supabase');
        console.log('2. Use o reset de senha');
        console.log('3. Verifique configurações de auth no Supabase');
      }
    } else {
      console.log('✅ Login realizado com sucesso!');
      console.log('Usuário logado:', loginData.user?.email);
      console.log('Token de acesso:', loginData.session?.access_token ? 'Presente' : 'Ausente');
      
      // Verificar se o profile foi criado
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', loginData.user?.id)
        .single();
      
      if (profileError) {
        console.log('⚠️ Profile não encontrado:', profileError.message);
      } else {
        console.log('✅ Profile encontrado:', profile.username || profile.display_name);
      }
      
      // Fazer logout
      await supabase.auth.signOut();
      console.log('✅ Logout realizado!');
    }
    
  } catch (error) {
    console.error('❌ Erro no teste de login:', error);
  }
}

console.log('🔐 TESTE DE AUTENTICAÇÃO - SUPABASE SELF-HOSTED');
console.log('================================================\n');

createTestUser().catch(console.error); 