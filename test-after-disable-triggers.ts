import { createClient } from '@supabase/supabase-js';

const SUPABASE_SELF_HOSTED_URL = "https://supabase.nutef.com";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.ewogICJyb2xlIjogImFub24iLAogICJpc3MiOiAic3VwYWJhc2UiLAogICJpYXQiOiAxNzE1MDUwODAwLAogICJleHAiOiAxODcyODE3MjAwCn0.zii4FynaxJNS8fGXKYKcnqiUw0DzIuLFB0MMz4ImjEE";

const supabase = createClient(SUPABASE_SELF_HOSTED_URL, SUPABASE_ANON_KEY);

async function testAfterDisableTriggers() {
  console.log('🧪 TESTE: Cadastro após desabilitar triggers');
  console.log('='.repeat(50));
  
  // Teste 1: Signup mínimo
  console.log('\n1️⃣ Teste mínimo sem metadados...');
  const simpleEmail = `sem-triggers-${Date.now()}@nutef.com`;
  const simplePassword = 'SemTriggers123!';
  
  console.log('📧 Email:', simpleEmail);
  
  const { data: simpleSignup, error: simpleError } = await supabase.auth.signUp({
    email: simpleEmail,
    password: simplePassword
  });
  
  if (simpleError) {
    console.error('❌ ERRO AINDA PERSISTE:', simpleError.message);
    console.error('Status:', simpleError.status);
    console.log('\n🚨 PROBLEMA MAIS PROFUNDO NO SUPABASE!');
    console.log('');
    console.log('Possíveis causas:');
    console.log('1. Configuração incorreta do Supabase self-hosted');
    console.log('2. Problema no PostgreSQL subjacente');
    console.log('3. Extensões do PostgreSQL faltando');
    console.log('4. Problema de conectividade interna');
    console.log('5. Permissões no nível do banco de dados');
    console.log('');
    console.log('🔧 PRÓXIMOS PASSOS:');
    console.log('1. Verificar logs do Supabase');
    console.log('2. Verificar logs do PostgreSQL');
    console.log('3. Testar conexão direta com PostgreSQL');
    console.log('4. Revisar configuração do docker-compose');
    return;
  }
  
  console.log('✅ SUCESSO! Signup sem triggers funcionou!');
  console.log('🆔 ID:', simpleSignup.user?.id);
  console.log('📧 Email:', simpleSignup.user?.email);
  
  // Teste 2: Signup com metadados
  console.log('\n2️⃣ Teste com metadados...');
  const fullEmail = `com-metadados-${Date.now()}@nutef.com`;
  const fullPassword = 'ComMetadados123!';
  
  const { data: fullSignup, error: fullError } = await supabase.auth.signUp({
    email: fullEmail,
    password: fullPassword,
    options: {
      data: {
        username: `usuario_teste_${Date.now()}`,
        display_name: 'Usuário Teste'
      }
    }
  });
  
  if (fullError) {
    console.error('❌ Erro com metadados:', fullError.message);
    console.log('🔧 O problema está nos metadados ou triggers');
  } else {
    console.log('✅ Signup com metadados também funcionou!');
    console.log('🆔 ID:', fullSignup.user?.id);
    console.log('📧 Email:', fullSignup.user?.email);
  }
  
  // Teste 3: Verificar se dados foram salvos
  console.log('\n3️⃣ Verificando dados salvos...');
  
  if (simpleSignup.user?.id) {
    // Verificar se o perfil foi criado (não deve ter sido criado sem triggers)
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', simpleSignup.user.id)
      .single();
    
    if (profileError) {
      console.log('⚠️ Perfil não foi criado (esperado sem triggers)');
    } else {
      console.log('⚠️ Perfil foi criado mesmo sem triggers? Verificar!');
      console.log('Perfil:', profile);
    }
    
    // Verificar se a carteira foi criada
    const { data: wallet, error: walletError } = await supabase
      .from('shhhhcoin_wallets')
      .select('*')
      .eq('user_id', simpleSignup.user.id)
      .single();
    
    if (walletError) {
      console.log('⚠️ Carteira não foi criada (esperado sem triggers)');
    } else {
      console.log('⚠️ Carteira foi criada mesmo sem triggers? Verificar!');
      console.log('Carteira:', wallet);
    }
  }
  
  console.log('\n='.repeat(50));
  console.log('📋 CONCLUSÃO');
  console.log('='.repeat(50));
  
  if (simpleError) {
    console.log('❌ PROBLEMA FUNDAMENTAL NO SUPABASE');
    console.log('O erro persiste mesmo sem triggers');
  } else {
    console.log('✅ PROBLEMA RESOLVIDO!');
    console.log('O cadastro funciona sem triggers');
    console.log('Agora você pode reativar as triggers corrigidas');
  }
}

testAfterDisableTriggers(); 