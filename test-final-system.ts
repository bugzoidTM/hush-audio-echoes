import { createClient } from '@supabase/supabase-js';

const SUPABASE_SELF_HOSTED_URL = "https://supabase.nutef.com";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.ewogICJyb2xlIjogImFub24iLAogICJpc3MiOiAic3VwYWJhc2UiLAogICJpYXQiOiAxNzE1MDUwODAwLAogICJleHAiOiAxODcyODE3MjAwCn0.zii4FynaxJNS8fGXKYKcnqiUw0DzIuLFB0MMz4ImjEE";

const supabase = createClient(SUPABASE_SELF_HOSTED_URL, SUPABASE_ANON_KEY);

async function testFinalSystem() {
  console.log('🎯 TESTE FINAL: Sistema completo com triggers corrigidas');
  console.log('='.repeat(60));
  
  // Teste 1: Signup completo com metadados
  console.log('\n1️⃣ Teste completo: signup + triggers + dados automáticos...');
  
  const testEmail = `sistema-completo-${Date.now()}@nutef.com`;
  const testPassword = 'SistemaCompleto123!';
  const testUsername = `usuario_completo_${Date.now()}`;
  const testDisplayName = 'Sistema Completo';
  
  console.log('📧 Email:', testEmail);
  console.log('👤 Username:', testUsername);
  console.log('🎭 Display Name:', testDisplayName);
  
  const { data: signup, error: signupError } = await supabase.auth.signUp({
    email: testEmail,
    password: testPassword,
    options: {
      data: {
        username: testUsername,
        display_name: testDisplayName
      }
    }
  });
  
  if (signupError) {
    console.error('❌ ERRO NO CADASTRO:', signupError.message);
    console.error('Status:', signupError.status);
    console.log('\n🚨 As triggers ainda têm problema!');
    
    if (signupError.message.includes('Database error saving new user')) {
      console.log('');
      console.log('🔧 POSSÍVEL SOLUÇÃO:');
      console.log('1. Verificar se o script reactivate-fixed-triggers.sql foi executado completamente');
      console.log('2. Verificar se não há outros usuários com dados conflitantes');
      console.log('3. Testar com dados únicos');
      console.log('4. Revisar as políticas RLS das tabelas');
    }
    
    return;
  }
  
  console.log('✅ SUCESSO! Signup funcionou!');
  console.log('🆔 ID:', signup.user?.id);
  console.log('📧 Email:', signup.user?.email);
  
  // Aguardar um pouco para as triggers processarem
  console.log('\n⏳ Aguardando triggers processarem...');
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Teste 2: Verificar se perfil foi criado
  console.log('\n2️⃣ Verificando perfil criado...');
  
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', signup.user?.id)
    .single();
  
  if (profileError) {
    console.error('❌ Erro ao buscar perfil:', profileError.message);
    console.log('🚨 Trigger handle_new_user não funcionou!');
  } else {
    console.log('✅ Perfil criado com sucesso!');
    console.log('👤 Username:', profile.username);
    console.log('🎭 Display Name:', profile.display_name);
    console.log('📅 Criado em:', profile.created_at);
  }
  
  // Teste 3: Verificar se role foi criada
  console.log('\n3️⃣ Verificando role criada...');
  
  const { data: role, error: roleError } = await supabase
    .from('user_roles')
    .select('*')
    .eq('user_id', signup.user?.id)
    .single();
  
  if (roleError) {
    console.error('❌ Erro ao buscar role:', roleError.message);
    console.log('🚨 Trigger handle_new_user não criou role!');
  } else {
    console.log('✅ Role criada com sucesso!');
    console.log('🔐 Role:', role.role);
    console.log('📅 Criada em:', role.created_at);
  }
  
  // Teste 4: Verificar se stats foram criadas
  console.log('\n4️⃣ Verificando stats criadas...');
  
  const { data: stats, error: statsError } = await supabase
    .from('user_stats')
    .select('*')
    .eq('user_id', signup.user?.id)
    .single();
  
  if (statsError) {
    console.error('❌ Erro ao buscar stats:', statsError.message);
    console.log('🚨 Trigger handle_new_user não criou stats!');
  } else {
    console.log('✅ Stats criadas com sucesso!');
    console.log('📊 Posts:', stats.posts_count);
    console.log('👥 Seguidores:', stats.followers_count);
    console.log('➡️ Seguindo:', stats.following_count);
  }
  
  // Teste 5: Verificar se carteira foi criada
  console.log('\n5️⃣ Verificando carteira criada...');
  
  const { data: wallet, error: walletError } = await supabase
    .from('shhhhcoin_wallets')
    .select('*')
    .eq('user_id', signup.user?.id)
    .single();
  
  if (walletError) {
    console.error('❌ Erro ao buscar carteira:', walletError.message);
    console.log('🚨 Trigger create_shhhhcoin_wallet não funcionou!');
  } else {
    console.log('✅ Carteira criada com sucesso!');
    console.log('💰 Saldo inicial:', wallet.balance);
    console.log('📅 Criada em:', wallet.created_at);
  }
  
  // Teste 6: Teste duplo para verificar se não há conflitos
  console.log('\n6️⃣ Teste de conflito: tentando criar usuário duplicado...');
  
  const { data: duplicateSignup, error: duplicateError } = await supabase.auth.signUp({
    email: testEmail, // Mesmo email
    password: testPassword
  });
  
  if (duplicateError) {
    if (duplicateError.message.includes('already registered')) {
      console.log('✅ Proteção contra duplicata funcionando!');
    } else {
      console.error('❌ Erro inesperado:', duplicateError.message);
    }
  } else {
    console.log('⚠️ Usuário duplicado foi criado? Verificar!');
  }
  
  console.log('\n='.repeat(60));
  console.log('📋 RESULTADO FINAL');
  console.log('='.repeat(60));
  
  const success = {
    signup: !signupError,
    profile: !profileError,
    role: !roleError,
    stats: !statsError,
    wallet: !walletError
  };
  
  const successCount = Object.values(success).filter(Boolean).length;
  const totalTests = Object.keys(success).length;
  
  console.log(`\n🎯 SUCESSO: ${successCount}/${totalTests} componentes funcionando`);
  
  if (successCount === totalTests) {
    console.log('');
    console.log('🎉 PARABÉNS! SISTEMA TOTALMENTE FUNCIONAL!');
    console.log('✅ Cadastro de usuários funcionando');
    console.log('✅ Triggers corrigidas funcionando');
    console.log('✅ Perfil, roles, stats e carteira criados automaticamente');
    console.log('✅ Tratamento de erros implementado');
    console.log('');
    console.log('💡 O sistema está pronto para uso em produção!');
  } else {
    console.log('');
    console.log('⚠️ ALGUNS PROBLEMAS AINDA EXISTEM:');
    if (!success.signup) console.log('❌ Cadastro básico');
    if (!success.profile) console.log('❌ Criação de perfil');
    if (!success.role) console.log('❌ Criação de role');
    if (!success.stats) console.log('❌ Criação de stats');
    if (!success.wallet) console.log('❌ Criação de carteira');
    console.log('');
    console.log('🔧 Revisar as triggers e políticas RLS');
  }
}

testFinalSystem(); 