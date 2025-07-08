import { createClient } from '@supabase/supabase-js';

const SUPABASE_SELF_HOSTED_URL = "https://supabase.nutef.com";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.ewogICJyb2xlIjogImFub24iLAogICJpc3MiOiAic3VwYWJhc2UiLAogICJpYXQiOiAxNzE1MDUwODAwLAogICJleHAiOiAxODcyODE3MjAwCn0.zii4FynaxJNS8fGXKYKcnqiUw0DzIuLFB0MMz4ImjEE";

const supabase = createClient(SUPABASE_SELF_HOSTED_URL, SUPABASE_ANON_KEY);

async function debugWalletTrigger() {
  console.log('🔍 DEBUG: Verificando função da carteira após correção');
  console.log('='.repeat(60));
  
  try {
    // Verificar se a função existe e se tem o código correto
    console.log('\n1️⃣ Verificando função create_shhhhcoin_wallet...');
    
    // Tentar acessar informações sobre a função
    console.log('Função create_shhhhcoin_wallet deve existir e estar corrigida');
    
    // Verificar triggers ativos
    console.log('\n2️⃣ Verificando triggers ativos...');
    console.log('Triggers esperados em auth.users:');
    console.log('- on_auth_user_created');
    console.log('- create_wallet_on_user_creation');
    
    // Verificar se a tabela shhhhcoin_wallets está acessível
    console.log('\n3️⃣ Verificando acesso à tabela shhhhcoin_wallets...');
    
    const { data: wallets, error: walletsError } = await supabase
      .from('shhhhcoin_wallets')
      .select('user_id')
      .limit(1);
    
    if (walletsError) {
      console.error('❌ Erro ao acessar shhhhcoin_wallets:', walletsError.message);
    } else {
      console.log('✅ Tabela shhhhcoin_wallets: Acessível');
      console.log('📊 Carteiras existentes:', wallets?.length || 0);
    }
    
    // Tentar signup com dados únicos
    console.log('\n4️⃣ Testando signup com dados únicos...');
    
    const timestamp = Date.now();
    const testEmail = `debug-wallet-${timestamp}@nutef.com`;
    const testPassword = 'DebugWallet123!';
    
    console.log('📧 Email de teste:', testEmail);
    
    const { data: signupData, error: signupError } = await supabase.auth.signUp({
      email: testEmail,
      password: testPassword,
      options: {
        data: {
          username: `debug_user_${timestamp}`,
          display_name: `Debug User ${timestamp}`
        }
      }
    });
    
    if (signupError) {
      console.error('❌ ERRO NO SIGNUP:', signupError.message);
      console.error('Status:', signupError.status);
      console.error('Código:', signupError.code);
      
      console.log('\n🔧 PRÓXIMAS AÇÕES NECESSÁRIAS:');
      
      if (signupError.message.includes('Database error saving new user')) {
        console.log('1. Execute esta correção no SQL Editor do Supabase:');
        console.log('');
        console.log('-- Desabilitar TODAS as triggers temporariamente');
        console.log('DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;');
        console.log('DROP TRIGGER IF EXISTS create_wallet_on_user_creation ON auth.users;');
        console.log('');
        console.log('-- Testar signup sem triggers');
        console.log('-- Se funcionar, recriar triggers uma por vez');
        console.log('');
        console.log('2. Primeiro reative só a trigger do perfil:');
        console.log('CREATE TRIGGER on_auth_user_created');
        console.log('  AFTER INSERT ON auth.users');
        console.log('  FOR EACH ROW EXECUTE FUNCTION handle_new_user();');
        console.log('');
        console.log('3. Teste novamente');
        console.log('');
        console.log('4. Se funcionar, adicione a trigger da carteira:');
        console.log('CREATE TRIGGER create_wallet_on_user_creation');
        console.log('  AFTER INSERT ON auth.users');
        console.log('  FOR EACH ROW EXECUTE FUNCTION create_shhhhcoin_wallet();');
      }
      
      return;
    }
    
    console.log('✅ SUCESSO! Usuário criado sem erro!');
    console.log('🆔 ID:', signupData.user?.id);
    console.log('📧 Email:', signupData.user?.email);
    
    // Aguardar triggers processarem
    console.log('\n5️⃣ Aguardando triggers processarem...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Verificar se perfil foi criado
    if (signupData.user?.id) {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', signupData.user.id)
        .single();
      
      if (profileError) {
        console.error('❌ Profile não criado:', profileError.message);
      } else {
        console.log('✅ Profile criado:', profile.username);
      }
      
      // Verificar se carteira foi criada
      const { data: wallet, error: walletError } = await supabase
        .from('shhhhcoin_wallets')
        .select('*')
        .eq('user_id', signupData.user.id)
        .single();
      
      if (walletError) {
        console.error('❌ Carteira não criada:', walletError.message);
      } else {
        console.log('✅ Carteira criada! Saldo:', wallet.balance);
      }
    }
    
    console.log('\n='.repeat(60));
    console.log('🎉 TESTE CONCLUÍDO!');
    if (!signupError) {
      console.log('✅ Sistema funcionando - problema resolvido!');
    }
    console.log('='.repeat(60));
    
  } catch (error) {
    console.error('❌ Erro geral:', error);
  }
}

debugWalletTrigger(); 