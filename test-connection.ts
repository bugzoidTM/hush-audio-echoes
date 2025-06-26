import { createClient } from '@supabase/supabase-js';

const SUPABASE_SELF_HOSTED_URL = "https://supabase.nutef.com";
const SUPABASE_SELF_HOSTED_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.ewogICJyb2xlIjogImFub24iLAogICJpc3MiOiAic3VwYWJhc2UiLAogICJpYXQiOiAxNzE1MDUwODAwLAogICJleHAiOiAxODcyODE3MjAwCn0.zii4FynaxJNS8fGXKYKcnqiUw0DzIuLFB0MMz4ImjEE";

// Função para testar conectividade básica
const testBasicConnectivity = async () => {
  console.log('🔌 Testando conectividade básica...');
  
  try {
    // Testar endpoint REST API
    const response = await fetch(`${SUPABASE_SELF_HOSTED_URL}/rest/v1/`, {
      headers: {
        'apikey': SUPABASE_SELF_HOSTED_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_SELF_HOSTED_ANON_KEY}`
      }
    });
    console.log('✅ Resposta HTTP da API REST:', response.status, response.statusText);
    
    if (response.status === 401) {
      console.log('ℹ️ Status 401 é esperado para endpoint raiz - servidor está funcionando!');
      return true;
    }
    
    if (response.status === 200 || response.status === 404) {
      console.log('✅ Servidor Supabase está respondendo corretamente!');
      return true;
    }
    
    return true; // Consideramos sucesso se conseguir conectar
  } catch (error) {
    console.error('❌ Erro de conectividade HTTP:', error);
    return false;
  }
};

// Função para testar Supabase client
const testSupabaseClient = async () => {
  console.log('🔗 Testando cliente Supabase...');
  
  const supabase = createClient(SUPABASE_SELF_HOSTED_URL, SUPABASE_SELF_HOSTED_ANON_KEY);
  
  try {
    // Teste de autenticação - verificar se consegue acessar dados públicos
    const { data, error } = await supabase
      .from('profiles')
      .select('count')
      .limit(1);
    
    if (error) {
      console.error('❌ Erro do Supabase:', error.message);
      console.error('Detalhes:', error);
      return false;
    }
    
    console.log('✅ Cliente Supabase funcionando!');
    console.log('Dados recebidos:', data);
    return true;
  } catch (err) {
    console.error('❌ Erro de cliente:', err);
    return false;
  }
};

// Teste de autenticação
const testAuthentication = async () => {
  console.log('🔐 Testando sistema de autenticação...');
  
  const supabase = createClient(SUPABASE_SELF_HOSTED_URL, SUPABASE_SELF_HOSTED_ANON_KEY);
  
  try {
    // Verificar se consegue acessar a sessão atual (mesmo que seja null)
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error) {
      console.error('❌ Erro na autenticação:', error.message);
      return false;
    }
    
    console.log('✅ Sistema de autenticação funcionando!');
    console.log('Sessão atual:', session ? 'Ativa' : 'Nenhuma');
    return true;
  } catch (err) {
    console.error('❌ Erro no teste de auth:', err);
    return false;
  }
};

// Teste de estrutura do banco
const testDatabaseStructure = async () => {
  console.log('🗄️ Testando estrutura do banco...');
  
  const supabase = createClient(SUPABASE_SELF_HOSTED_URL, SUPABASE_SELF_HOSTED_ANON_KEY);
  
  const tablesToTest = [
    'profiles',
    'audio_posts', 
    'likes',
    'followers',
    'hashtags'
  ];
  
  const results = {};
  
  for (const table of tablesToTest) {
    try {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .limit(1);
      
      if (error) {
        console.log(`❌ Tabela '${table}': ${error.message}`);
        results[table] = false;
      } else {
        console.log(`✅ Tabela '${table}': OK`);
        results[table] = true;
      }
    } catch (err) {
      console.log(`❌ Tabela '${table}': Erro de conexão`);
      results[table] = false;
    }
  }
  
  return results;
};

// Função principal de teste
const runAllTests = async () => {
  console.log('🚀 Iniciando testes de migração do Supabase...\n');
  
  const basicConnectivity = await testBasicConnectivity();
  console.log('');
  
  if (!basicConnectivity) {
    console.log('❌ Falha na conectividade básica. Verifique a URL e certificados SSL.');
    return;
  }
  
  const supabaseClient = await testSupabaseClient();
  console.log('');
  
  if (!supabaseClient) {
    console.log('❌ Falha no cliente Supabase. Verifique as chaves de API.');
    return;
  }
  
  const authentication = await testAuthentication();
  console.log('');
  
  const databaseStructure = await testDatabaseStructure();
  console.log('');
  
  // Resumo final
  console.log('📊 RESUMO DOS TESTES:');
  console.log('=====================');
  console.log(`Conectividade HTTP: ${basicConnectivity ? '✅' : '❌'}`);
  console.log(`Cliente Supabase: ${supabaseClient ? '✅' : '❌'}`);
  console.log(`Autenticação: ${authentication ? '✅' : '❌'}`);
  
  console.log('\nTabelas do banco:');
  Object.entries(databaseStructure).forEach(([table, status]) => {
    console.log(`  ${table}: ${status ? '✅' : '❌'}`);
  });
  
  const allPassed = basicConnectivity && supabaseClient && authentication && 
                   Object.values(databaseStructure).every(status => status);
  
  console.log('\n' + '='.repeat(50));
  if (allPassed) {
    console.log('🎉 TODOS OS TESTES PASSARAM! Migração pode prosseguir.');
  } else {
    console.log('⚠️ ALGUNS TESTES FALHARAM. Verifique as configurações antes de migrar.');
  }
  console.log('='.repeat(50));
};

// Executar os testes
runAllTests().catch(console.error); 