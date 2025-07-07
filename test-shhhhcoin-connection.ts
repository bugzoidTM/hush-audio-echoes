import { createClient } from '@supabase/supabase-js';

// Configuração do Supabase (ajuste conforme sua configuração)
const supabaseUrl = 'https://supabase.nutef.com'; // Sua URL
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'sua-chave-aqui'; // Sua chave

const supabase = createClient(supabaseUrl, supabaseKey);

// Função para testar conexão básica
async function testBasicConnection() {
  console.log('🔄 Testando conexão básica...');
  
  try {
    // Testar view de teste
    const { data, error } = await supabase
      .from('shhhhcoin_test')
      .select('*');
    
    if (error) {
      console.error('❌ Erro na view de teste:', error);
    } else {
      console.log('✅ View de teste funcionando:', data);
    }
  } catch (err) {
    console.error('❌ Erro de conexão:', err);
  }
}

// Função para testar autenticação
async function testAuth() {
  console.log('🔄 Testando autenticação...');
  
  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (error) {
      console.error('❌ Erro de autenticação:', error);
    } else {
      console.log('✅ Usuário autenticado:', user?.id || 'Não autenticado');
    }
  } catch (err) {
    console.error('❌ Erro ao verificar autenticação:', err);
  }
}

// Função para testar tabela de produtos
async function testProductsTable() {
  console.log('🔄 Testando tabela de produtos...');
  
  try {
    const { data, error } = await supabase
      .from('shhhhcoin_products')
      .select('*')
      .limit(5);
    
    if (error) {
      console.error('❌ Erro na tabela de produtos:', error);
      console.error('Detalhes:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint
      });
    } else {
      console.log('✅ Produtos encontrados:', data?.length || 0);
      console.log('Produtos:', data);
    }
  } catch (err) {
    console.error('❌ Erro ao acessar produtos:', err);
  }
}

// Função para testar tabela de carteiras
async function testWalletsTable() {
  console.log('🔄 Testando tabela de carteiras...');
  
  try {
    const { data, error } = await supabase
      .from('shhhhcoin_wallets')
      .select('*')
      .limit(5);
    
    if (error) {
      console.error('❌ Erro na tabela de carteiras:', error);
      console.error('Detalhes:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint
      });
    } else {
      console.log('✅ Carteiras encontradas:', data?.length || 0);
      console.log('Carteiras:', data);
    }
  } catch (err) {
    console.error('❌ Erro ao acessar carteiras:', err);
  }
}

// Função para testar com usuário específico
async function testUserWallet(userId: string) {
  console.log(`🔄 Testando carteira do usuário ${userId}...`);
  
  try {
    const { data, error } = await supabase
      .from('shhhhcoin_wallets')
      .select('*')
      .eq('user_id', userId)
      .single();
    
    if (error) {
      console.error('❌ Erro na carteira do usuário:', error);
      
      if (error.code === 'PGRST116') {
        console.log('ℹ️  Carteira não encontrada, tentando criar...');
        
        // Tentar criar carteira
        const { data: newWallet, error: createError } = await supabase
          .from('shhhhcoin_wallets')
          .insert({
            user_id: userId,
            balance: 0,
            total_earned: 0,
            total_spent: 0,
            total_purchased: 0
          })
          .select()
          .single();
        
        if (createError) {
          console.error('❌ Erro ao criar carteira:', createError);
        } else {
          console.log('✅ Carteira criada:', newWallet);
        }
      }
    } else {
      console.log('✅ Carteira encontrada:', data);
    }
  } catch (err) {
    console.error('❌ Erro ao testar carteira do usuário:', err);
  }
}

// Função para testar RPC (funções do banco)
async function testRPCFunctions() {
  console.log('🔄 Testando funções RPC...');
  
  try {
    // Testar função de adicionar shhhhcoins
    const { data, error } = await supabase.rpc('add_shhhhcoins', {
      p_user_id: 'test-user-id',
      p_amount: 10,
      p_description: 'Teste de função RPC'
    });
    
    if (error) {
      console.error('❌ Erro na função RPC:', error);
    } else {
      console.log('✅ Função RPC funcionando:', data);
    }
  } catch (err) {
    console.error('❌ Erro ao testar RPC:', err);
  }
}

// Função para verificar headers da resposta
async function checkHeaders() {
  console.log('🔄 Verificando headers da resposta...');
  
  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/shhhhcoin_products`, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });
    
    console.log('Status:', response.status);
    console.log('Headers da resposta:', Object.fromEntries(response.headers.entries()));
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Erro HTTP:', errorText);
    }
  } catch (err) {
    console.error('❌ Erro ao verificar headers:', err);
  }
}

// Executar todos os testes
async function runAllTests() {
  console.log('🚀 Iniciando testes do sistema shhhhcoin...\n');
  
  await testBasicConnection();
  console.log('\n' + '='.repeat(50) + '\n');
  
  await testAuth();
  console.log('\n' + '='.repeat(50) + '\n');
  
  await checkHeaders();
  console.log('\n' + '='.repeat(50) + '\n');
  
  await testProductsTable();
  console.log('\n' + '='.repeat(50) + '\n');
  
  await testWalletsTable();
  console.log('\n' + '='.repeat(50) + '\n');
  
  // Testar com um usuário específico (substitua pelo ID do usuário dos logs)
  await testUserWallet('c346c013-8901-4063-a1d0-02006afefdbb');
  console.log('\n' + '='.repeat(50) + '\n');
  
  await testRPCFunctions();
  
  console.log('\n✅ Testes concluídos!');
}

// Executar se for chamado diretamente
if (require.main === module) {
  runAllTests().catch(console.error);
}

export { runAllTests }; 