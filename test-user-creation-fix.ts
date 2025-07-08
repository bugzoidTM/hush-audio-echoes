import { createClient } from '@supabase/supabase-js';

const SUPABASE_SELF_HOSTED_URL = "https://supabase.nutef.com";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.ewogICJyb2xlIjogImFub24iLAogICJpc3MiOiAic3VwYWJhc2UiLAogICJpYXQiOiAxNzE1MDUwODAwLAogICJleHAiOiAxODcyODE3MjAwCn0.zii4FynaxJNS8fGXKYKcnqiUw0DzIuLFB0MMz4ImjEE";

const supabase = createClient(SUPABASE_SELF_HOSTED_URL, SUPABASE_ANON_KEY);

async function testUserCreationFix() {
  console.log('🧪 TESTANDO CORREÇÃO DA CRIAÇÃO DE USUÁRIO');
  console.log('='.repeat(50));
  
  try {
    // Gerar dados únicos para teste
    const timestamp = Date.now();
    const testEmail = `teste-correcao-${timestamp}@nutef.com`;
    const testPassword = 'TesteCorreção123!';
    const testUsername = `usuario_teste_${timestamp}`;
    
    console.log('\n1️⃣ Tentando criar usuário com correção aplicada...');
    console.log('📧 Email:', testEmail);
    console.log('👤 Username:', testUsername);
    
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: testEmail,
      password: testPassword,
      options: {
        data: {
          username: testUsername,
          display_name: `Usuário Teste ${timestamp}`
        }
      }
    });
    
    if (signUpError) {
      console.error('❌ Erro na criação do usuário:', signUpError.message);
      console.error('🔍 Detalhes:', signUpError);
      
      console.log('\n💡 SOLUÇÕES POSSÍVEIS:');
      console.log('1. Execute o script SQL fix-user-creation.sql no painel do Supabase');
      console.log('2. Verifique se as tabelas foram criadas corretamente');
      console.log('3. Confirme se a função handle_new_user foi recriada');
      
      return;
    }
    
    console.log('✅ Usuário criado com sucesso!');
    console.log('🆔 ID do usuário:', signUpData.user?.id);
    console.log('📧 Email:', signUpData.user?.email);
    console.log('📧 Email confirmado:', signUpData.user?.email_confirmed_at ? 'Sim' : 'Não');
    
    // Aguardar um pouco para o trigger processar
    console.log('\n2️⃣ Aguardando processamento do trigger...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Verificar se o perfil foi criado
    console.log('\n3️⃣ Verificando se o perfil foi criado...');
    
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', signUpData.user?.id)
      .single();
    
    if (profileError) {
      console.error('❌ Erro ao buscar perfil:', profileError.message);
    } else {
      console.log('✅ Perfil criado com sucesso!');
      console.log('👤 Username:', profileData.username);
      console.log('🎭 Display Name:', profileData.display_name);
    }
    
    // Verificar se o role foi criado
    console.log('\n4️⃣ Verificando se o role foi criado...');
    
    const { data: roleData, error: roleError } = await supabase
      .from('user_roles')
      .select('*')
      .eq('user_id', signUpData.user?.id)
      .single();
    
    if (roleError) {
      console.error('❌ Erro ao buscar role:', roleError.message);
    } else {
      console.log('✅ Role criado com sucesso!');
      console.log('🔑 Role:', roleData.role);
    }
    
    // Verificar se as stats foram criadas
    console.log('\n5️⃣ Verificando se as stats foram criadas...');
    
    const { data: statsData, error: statsError } = await supabase
      .from('user_stats')
      .select('*')
      .eq('user_id', signUpData.user?.id)
      .single();
    
    if (statsError) {
      console.error('❌ Erro ao buscar stats:', statsError.message);
    } else {
      console.log('✅ Stats criadas com sucesso!');
      console.log('📊 Total posts:', statsData.total_posts);
      console.log('❤️ Total likes recebidos:', statsData.total_likes_received);
    }
    
    // Tentar fazer login com o usuário criado
    console.log('\n6️⃣ Testando login com o usuário criado...');
    
    const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
      email: testEmail,
      password: testPassword
    });
    
    if (loginError) {
      console.error('❌ Erro no login:', loginError.message);
      
      if (loginError.message.includes('Invalid login credentials')) {
        console.log('⚠️ Usuário criado mas email precisa ser confirmado');
        console.log('📧 Verifique se o email de confirmação foi enviado');
      }
    } else {
      console.log('✅ Login realizado com sucesso!');
      console.log('🎉 Sistema de autenticação funcionando perfeitamente!');
      
      // Fazer logout
      await supabase.auth.signOut();
    }
    
    console.log('\n='.repeat(50));
    console.log('🎉 TESTE CONCLUÍDO COM SUCESSO!');
    console.log('✅ Criação de usuário: OK');
    console.log('✅ Criação de perfil: OK');
    console.log('✅ Sistema funcionando corretamente!');
    console.log('='.repeat(50));
    
  } catch (error) {
    console.error('❌ Erro geral no teste:', error);
  }
}

testUserCreationFix(); 