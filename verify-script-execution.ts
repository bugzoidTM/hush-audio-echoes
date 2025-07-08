import { createClient } from '@supabase/supabase-js';

const SUPABASE_SELF_HOSTED_URL = "https://supabase.nutef.com";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.ewogICJyb2xlIjogImFub24iLAogICJpc3MiOiAic3VwYWJhc2UiLAogICJpYXQiOiAxNzE1MDUwODAwLAogICJleHAiOiAxODcyODE3MjAwCn0.zii4FynaxJNS8fGXKYKcnqiUw0DzIuLFB0MMz4ImjEE";

const supabase = createClient(SUPABASE_SELF_HOSTED_URL, SUPABASE_ANON_KEY);

async function verifyScriptExecution() {
  console.log('🔍 VERIFICANDO: Se o script de correção foi executado corretamente');
  console.log('='.repeat(70));
  
  try {
    // 1. Verificar se conseguimos acessar as tabelas básicas
    console.log('\n1️⃣ Verificando acesso às tabelas...');
    
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id')
      .limit(1);
    
    if (profilesError) {
      console.error('❌ Erro ao acessar profiles:', profilesError.message);
      console.log('🚨 PROBLEMA FUNDAMENTAL: Não consegue acessar tabelas básicas!');
      return;
    } else {
      console.log('✅ Acesso à tabela profiles: OK');
    }
    
    // 2. Verificar acesso à tabela da carteira
    console.log('\n2️⃣ Verificando acesso à tabela da carteira...');
    
    const { data: wallets, error: walletsError } = await supabase
      .from('shhhhcoin_wallets')
      .select('user_id')
      .limit(1);
    
    if (walletsError) {
      console.error('❌ Erro ao acessar shhhhcoin_wallets:', walletsError.message);
      console.log('🚨 PROBLEMA: Tabela da carteira pode estar com problema de permissão!');
    } else {
      console.log('✅ Acesso à tabela shhhhcoin_wallets: OK');
    }
    
    // 3. Tentar um signup SEM metadados (mínimo possível)
    console.log('\n3️⃣ Teste mínimo: signup sem metadados...');
    
    const simpleEmail = `teste-minimo-${Date.now()}@nutef.com`;
    const simplePassword = 'TesteMinimo123!';
    
    console.log('📧 Email simples:', simpleEmail);
    
    const { data: simpleSignup, error: simpleError } = await supabase.auth.signUp({
      email: simpleEmail,
      password: simplePassword
      // SEM options.data - para ver se o problema é nos metadados
    });
    
    if (simpleError) {
      console.error('❌ Erro no signup mínimo:', simpleError.message);
      console.error('Status:', simpleError.status);
      
      if (simpleError.message.includes('Database error saving new user')) {
        console.log('\n🔧 POSSÍVEIS CAUSAS RESTANTES:');
        console.log('');
        console.log('1. 📋 SCRIPTS NÃO EXECUTADOS COMPLETAMENTE:');
        console.log('   - Verifique se TODAS as linhas do script foram executadas');
        console.log('   - Procure por mensagens de erro no SQL Editor');
        console.log('   - Deve aparecer "Correção aplicada com sucesso!" no final');
        console.log('');
        console.log('2. 🔐 PROBLEMAS DE PERMISSÃO RLS:');
        console.log('   - As políticas RLS podem estar bloqueando inserções');
        console.log('   - Triggers podem não ter permissão SECURITY DEFINER');
        console.log('');
        console.log('3. 🗃️ PROBLEMAS NAS TABELAS:');
        console.log('   - Tabela shhhhcoin_wallets pode ter constraits extras');
        console.log('   - Campos obrigatórios podem estar faltando');
        console.log('');
        console.log('4. ⚙️ CONFIGURAÇÃO DO SUPABASE:');
        console.log('   - Supabase self-hosted pode ter configuração inadequada');
        console.log('   - PostgreSQL pode ter extensões faltando');
        console.log('');
        console.log('🎯 PRÓXIMA AÇÃO RECOMENDADA:');
        console.log('Execute esta query no SQL Editor para desabilitar TODAS as triggers:');
        console.log('');
        console.log('DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;');
        console.log('DROP TRIGGER IF EXISTS create_wallet_on_user_creation ON auth.users;');
        console.log('');
        console.log('Depois teste o cadastro. Se funcionar, o problema é nas triggers.');
        console.log('Se ainda não funcionar, o problema é mais profundo no Supabase.');
      }
      
      return;
    }
    
    console.log('✅ SUCESSO! Signup mínimo funcionou!');
    console.log('🆔 ID:', simpleSignup.user?.id);
    
    // 4. Se chegou até aqui, testar com metadados
    console.log('\n4️⃣ Teste com metadados...');
    
    const fullEmail = `teste-completo-${Date.now()}@nutef.com`;
    const fullPassword = 'TesteCompleto123!';
    
    const { data: fullSignup, error: fullError } = await supabase.auth.signUp({
      email: fullEmail,
      password: fullPassword,
      options: {
        data: {
          username: `teste_completo_${Date.now()}`,
          display_name: 'Teste Completo'
        }
      }
    });
    
    if (fullError) {
      console.error('❌ Erro no signup completo:', fullError.message);
      console.log('🔧 O problema está relacionado aos metadados ou triggers');
    } else {
      console.log('✅ Signup completo também funcionou!');
      console.log('🎉 Sistema totalmente operacional!');
    }
    
    console.log('\n='.repeat(70));
    console.log('📋 RESULTADO DA VERIFICAÇÃO COMPLETA');
    console.log('='.repeat(70));
    
  } catch (error) {
    console.error('❌ Erro geral na verificação:', error);
    console.log('\n🔧 PROBLEMA DE CONECTIVIDADE:');
    console.log('- Verifique se o Supabase está rodando');
    console.log('- Confirme a URL: https://supabase.nutef.com');
    console.log('- Teste acesso direto no navegador');
  }
}

verifyScriptExecution(); 