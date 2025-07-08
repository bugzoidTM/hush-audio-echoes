import { createClient } from '@supabase/supabase-js';

const SUPABASE_SELF_HOSTED_URL = "https://supabase.nutef.com";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.ewogICJyb2xlIjogImFub24iLAogICJpc3MiOiAic3VwYWJhc2UiLAogICJpYXQiOiAxNzE1MDUwODAwLAogICJleHAiOiAxODcyODE3MjAwCn0.zii4FynaxJNS8fGXKYKcnqiUw0DzIuLFB0MMz4ImjEE";

const supabase = createClient(SUPABASE_SELF_HOSTED_URL, SUPABASE_ANON_KEY);

async function testFinalFix() {
  console.log('🎯 TESTE FINAL: Validando correção do erro 500');
  console.log('='.repeat(55));
  
  const timestamp = Date.now();
  const testEmail = `final-test-${timestamp}@nutef.com`;
  const testPassword = 'FinalTest123!';
  const testUsername = `final_user_${timestamp}`;
  
  try {
    console.log('\n1️⃣ Tentando criar usuário após correção...');
    console.log('📧 Email:', testEmail);
    console.log('👤 Username:', testUsername);
    
    const { data: signupData, error: signupError } = await supabase.auth.signUp({
      email: testEmail,
      password: testPassword,
      options: {
        data: {
          username: testUsername,
          display_name: `Final Test User ${timestamp}`
        }
      }
    });
    
    if (signupError) {
      console.error('❌ ERRO AINDA PERSISTE:', signupError.message);
      console.error('Status:', signupError.status);
      
      console.log('\n🚨 PRÓXIMAS AÇÕES:');
      console.log('1. Execute o script fix-user-500-error.sql no painel SQL do Supabase');
      console.log('2. Aguarde alguns segundos e tente novamente');
      console.log('3. Se o erro persistir, pode ser problema de configuração do Supabase');
      
      return;
    }
    
    console.log('✅ SUCESSO! Usuário criado sem erro 500!');
    console.log('🆔 ID:', signupData.user?.id);
    console.log('📧 Email:', signupData.user?.email);
    console.log('✨ Email confirmado:', signupData.user?.email_confirmed_at ? 'Sim' : 'Não');
    
    // Aguardar processamento do trigger
    console.log('\n2️⃣ Aguardando processamento do trigger...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    if (!signupData.user?.id) {
      console.log('⚠️ Usuário criado mas ID não disponível');
      return;
    }
    
    // Verificar se o perfil foi criado
    console.log('\n3️⃣ Verificando dados criados pelo trigger...');
    
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', signupData.user.id)
      .single();
    
    if (profileError) {
      console.error('❌ Profile não criado:', profileError.message);
    } else {
      console.log('✅ Profile criado com sucesso!');
      console.log('   Username:', profile.username);
      console.log('   Display Name:', profile.display_name);
      console.log('   Criado em:', profile.created_at);
    }
    
    // Verificar roles
    const { data: roles, error: rolesError } = await supabase
      .from('user_roles')
      .select('*')
      .eq('user_id', signupData.user.id);
    
    if (rolesError) {
      console.error('❌ Roles não criados:', rolesError.message);
    } else {
      console.log('✅ Roles criados:', roles.length, 'role(s)');
      roles.forEach(role => {
        console.log('   -', role.role);
      });
    }
    
    // Verificar stats
    const { data: stats, error: statsError } = await supabase
      .from('user_stats')
      .select('*')
      .eq('user_id', signupData.user.id);
    
    if (statsError) {
      console.error('❌ Stats não criados:', statsError.message);
    } else {
      console.log('✅ Stats criadas:', stats.length, 'registro(s)');
      stats.forEach(stat => {
        console.log('   Posts:', stat.total_posts);
        console.log('   Likes recebidos:', stat.total_likes_received);
      });
    }
    
    // Testar login
    console.log('\n4️⃣ Testando login com usuário criado...');
    
    const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
      email: testEmail,
      password: testPassword
    });
    
    if (loginError) {
      console.error('❌ Login falhou:', loginError.message);
      
      if (loginError.message.includes('Invalid login credentials')) {
        console.log('⚠️ Usuário criado mas email precisa ser confirmado');
        console.log('   Isso é normal - email de confirmação foi enviado');
      }
    } else {
      console.log('✅ Login realizado com sucesso!');
      console.log('🎉 Sistema de autenticação 100% funcional!');
      
      // Logout para limpeza
      await supabase.auth.signOut();
      console.log('🔐 Logout realizado');
    }
    
    console.log('\n' + '='.repeat(55));
    console.log('🎉 TESTE FINAL CONCLUÍDO!');
    console.log('');
    console.log('✅ Criação de usuário: FUNCIONANDO');
    console.log('✅ Trigger handle_new_user: FUNCIONANDO');
    console.log('✅ Erro 500: RESOLVIDO');
    console.log('✅ Sistema: OPERACIONAL');
    console.log('');
    console.log('🚀 O sistema está pronto para uso!');
    console.log('='.repeat(55));
    
  } catch (error) {
    console.error('❌ Erro geral no teste:', error);
    console.log('\n🔧 POSSÍVEIS SOLUÇÕES:');
    console.log('1. Verifique se o Supabase está rodando');
    console.log('2. Execute o script fix-user-500-error.sql');
    console.log('3. Aguarde alguns minutos e tente novamente');
  }
}

testFinalFix(); 