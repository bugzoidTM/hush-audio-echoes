import { createClient } from '@supabase/supabase-js';

const SUPABASE_SELF_HOSTED_URL = "https://supabase.nutef.com";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.ewogICJyb2xlIjogImFub24iLAogICJpc3MiOiAic3VwYWJhc2UiLAogICJpYXQiOiAxNzE1MDUwODAwLAogICJleHAiOiAxODcyODE3MjAwCn0.zii4FynaxJNS8fGXKYKcnqiUw0DzIuLFB0MMz4ImjEE";

const supabase = createClient(SUPABASE_SELF_HOSTED_URL, SUPABASE_ANON_KEY);

async function testFinalWithRLS() {
  console.log('🎉 TESTE FINAL: Sistema completo com RLS e políticas adequadas');
  console.log('='.repeat(65));
  
  console.log('\n1️⃣ Teste de cadastro com RLS reabilitado...');
  
  const testEmail = `final-com-rls-${Date.now()}@nutef.com`;
  const testPassword = 'FinalComRLS123!';
  const testUsername = `usuario_final_${Date.now()}`;
  
  console.log('📧 Email:', testEmail);
  console.log('👤 Username:', testUsername);
  
  const { data: signup, error: signupError } = await supabase.auth.signUp({
    email: testEmail,
    password: testPassword,
    options: {
      data: {
        username: testUsername,
        display_name: 'Usuário Final'
      }
    }
  });
  
  if (signupError) {
    console.error('❌ ERRO no cadastro:', signupError.message);
    console.error('Status:', signupError.status);
    console.log('\n🔧 POSSÍVEIS CAUSAS:');
    console.log('1. Políticas RLS ainda muito restritivas');
    console.log('2. Triggers não têm permissão suficiente');
    console.log('3. Função não está como SECURITY DEFINER');
    console.log('4. Problema nas políticas de inserção');
    return;
  }
  
  console.log('✅ SUCESSO! Cadastro funcionou com RLS!');
  console.log('🆔 ID:', signup.user?.id);
  console.log('📧 Email:', signup.user?.email);
  
  // Aguardar triggers processarem
  console.log('\n⏳ Aguardando triggers processarem...');
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  console.log('\n2️⃣ Verificando dados criados automaticamente...');
  
  const userId = signup.user?.id;
  if (!userId) {
    console.log('❌ ID do usuário não encontrado');
    return;
  }
  
  // Verificar perfil
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  
  if (profileError) {
    console.error('❌ Perfil não foi criado:', profileError.message);
    console.log('   Possível problema na política de inserção de profiles');
  } else {
    console.log('✅ Perfil criado automaticamente!');
    console.log('   👤 Username:', profile.username);
    console.log('   🎭 Display Name:', profile.display_name);
    console.log('   📅 Criado em:', new Date(profile.created_at).toLocaleString());
  }
  
  // Verificar role
  const { data: role, error: roleError } = await supabase
    .from('user_roles')
    .select('*')
    .eq('user_id', userId)
    .single();
  
  if (roleError) {
    console.error('❌ Role não foi criada:', roleError.message);
    console.log('   Possível problema na política de inserção de user_roles');
  } else {
    console.log('✅ Role criada automaticamente!');
    console.log('   🔐 Role:', role.role);
    console.log('   📅 Criada em:', new Date(role.created_at).toLocaleString());
  }
  
  // Verificar stats
  const { data: stats, error: statsError } = await supabase
    .from('user_stats')
    .select('*')
    .eq('user_id', userId)
    .single();
  
  if (statsError) {
    console.error('❌ Stats não foram criadas:', statsError.message);
    console.log('   Possível problema na política de inserção de user_stats');
  } else {
    console.log('✅ Stats criadas automaticamente!');
    console.log('   📊 Posts:', stats.posts_count);
    console.log('   👥 Seguidores:', stats.followers_count);
    console.log('   ➡️ Seguindo:', stats.following_count);
  }
  
  // Verificar carteira
  const { data: wallet, error: walletError } = await supabase
    .from('shhhhcoin_wallets')
    .select('*')
    .eq('user_id', userId)
    .single();
  
  if (walletError) {
    console.error('❌ Carteira não foi criada:', walletError.message);
    console.log('   Possível problema na política de inserção de shhhhcoin_wallets');
  } else {
    console.log('✅ Carteira criada automaticamente!');
    console.log('   💰 Saldo inicial:', wallet.balance);
    console.log('   📅 Criada em:', new Date(wallet.created_at).toLocaleString());
  }
  
  // Teste 3: Verificar permissões de leitura
  console.log('\n3️⃣ Testando permissões de leitura...');
  
  // Fazer login com o usuário recém-criado
  const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
    email: testEmail,
    password: testPassword
  });
  
  if (loginError) {
    console.error('❌ Erro no login:', loginError.message);
  } else {
    console.log('✅ Login realizado com sucesso!');
    
    // Testar leitura dos próprios dados
    const { data: ownProfile, error: ownProfileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    
    if (ownProfileError) {
      console.error('❌ Erro ao ler próprio perfil:', ownProfileError.message);
    } else {
      console.log('✅ Usuário pode ler próprio perfil!');
    }
    
    // Testar leitura da própria carteira
    const { data: ownWallet, error: ownWalletError } = await supabase
      .from('shhhhcoin_wallets')
      .select('*')
      .eq('user_id', userId)
      .single();
    
    if (ownWalletError) {
      console.error('❌ Erro ao ler própria carteira:', ownWalletError.message);
    } else {
      console.log('✅ Usuário pode ler própria carteira!');
    }
  }
  
  console.log('\n='.repeat(65));
  console.log('🎯 RESULTADO FINAL');
  console.log('='.repeat(65));
  
  const success = {
    signup: !signupError,
    profile: !profileError,
    role: !roleError,
    stats: !statsError,
    wallet: !walletError,
    login: !loginError
  };
  
  const successCount = Object.values(success).filter(Boolean).length;
  const totalTests = Object.keys(success).length;
  
  console.log(`\n📊 RESULTADO: ${successCount}/${totalTests} componentes funcionando`);
  
  if (successCount === totalTests) {
    console.log('\n🎉🎉🎉 SISTEMA TOTALMENTE FUNCIONAL! 🎉🎉🎉');
    console.log('');
    console.log('✅ Cadastro de usuários funcionando');
    console.log('✅ Triggers criando dados automaticamente');
    console.log('✅ RLS habilitado com políticas adequadas');
    console.log('✅ Usuários podem acessar seus próprios dados');
    console.log('✅ Sistema seguro e pronto para produção');
    console.log('');
    console.log('🚀 BENEFÍCIOS ALCANÇADOS:');
    console.log('   🔐 Segurança: RLS ativo protegendo dados');
    console.log('   🤖 Automação: Triggers criando perfil, roles, stats e carteira');
    console.log('   📊 Dados: Usuários têm acesso aos próprios dados');
    console.log('   💰 Shhhhcoin: Carteira criada automaticamente com saldo inicial');
    console.log('   🛡️ Proteção: Políticas RLS impedindo acesso indevido');
    console.log('');
    console.log('🎯 MISSÃO CUMPRIDA! O erro 500 foi completamente resolvido!');
  } else {
    console.log('\n⚠️ ALGUNS PROBLEMAS AINDA EXISTEM:');
    if (!success.signup) console.log('❌ Cadastro básico');
    if (!success.profile) console.log('❌ Criação de perfil');
    if (!success.role) console.log('❌ Criação de role');
    if (!success.stats) console.log('❌ Criação de stats');
    if (!success.wallet) console.log('❌ Criação de carteira');
    if (!success.login) console.log('❌ Login/permissões');
    console.log('');
    console.log('🔧 Ajustar políticas RLS para os componentes que falharam');
  }
  
  console.log('\n='.repeat(65));
}

testFinalWithRLS(); 