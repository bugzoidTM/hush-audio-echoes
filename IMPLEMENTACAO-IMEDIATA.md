# 🚀 IMPLEMENTAÇÃO IMEDIATA - Criação Manual de Perfis

## 📋 **OBJETIVO**
Implementar criação manual dos dados relacionados ao usuário após o primeiro login, já que as triggers foram removidas.

---

## 🛠️ **PASSOS PARA IMPLEMENTAR**

### **1. Modificar o Hook de Autenticação**

Editar `src/hooks/useAuth.tsx`:

```typescript
// Adicionar função para criar perfil
const createUserProfile = async (userId: string, email: string) => {
  try {
    const { error } = await supabase
      .from('profiles')
      .insert({
        id: userId,
        email: email,
        username: email.split('@')[0],
        display_name: email.split('@')[0],
        created_at: new Date().toISOString()
      });
    
    if (error) {
      console.error('Erro ao criar perfil:', error);
      return false;
    }
    
    console.log('✅ Perfil criado com sucesso!');
    return true;
  } catch (error) {
    console.error('Erro ao criar perfil:', error);
    return false;
  }
};

// Adicionar função para criar estatísticas
const createUserStats = async (userId: string) => {
  try {
    const { error } = await supabase
      .from('user_stats')
      .insert({
        user_id: userId,
        posts_count: 0,
        following_count: 0,
        followers_count: 0,
        created_at: new Date().toISOString()
      });
    
    if (error) {
      console.error('Erro ao criar estatísticas:', error);
      return false;
    }
    
    console.log('✅ Estatísticas criadas com sucesso!');
    return true;
  } catch (error) {
    console.error('Erro ao criar estatísticas:', error);
    return false;
  }
};

// Adicionar função para criar carteira
const createShhhhcoinWallet = async (userId: string) => {
  try {
    const { error } = await supabase
      .from('shhhhcoin_wallets')
      .insert({
        user_id: userId,
        balance: 100, // Saldo inicial
        created_at: new Date().toISOString()
      });
    
    if (error) {
      console.error('Erro ao criar carteira:', error);
      return false;
    }
    
    console.log('✅ Carteira criada com sucesso!');
    return true;
  } catch (error) {
    console.error('Erro ao criar carteira:', error);
    return false;
  }
};

// Adicionar função para verificar e criar dados
const checkAndCreateUserData = async (userId: string, email: string) => {
  try {
    // Verificar se perfil já existe
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .single();
    
    if (!existingProfile) {
      console.log('🔄 Criando dados do usuário...');
      
      // Criar perfil
      await createUserProfile(userId, email);
      
      // Criar estatísticas
      await createUserStats(userId);
      
      // Criar carteira
      await createShhhhcoinWallet(userId);
      
      console.log('✅ Todos os dados do usuário criados!');
    } else {
      console.log('✅ Perfil já existe, dados OK!');
    }
  } catch (error) {
    console.error('Erro ao verificar/criar dados:', error);
  }
};
```

### **2. Modificar o Componente Principal**

Editar `src/pages/ShhhhApp.tsx`:

```typescript
// Adicionar useEffect para verificar dados do usuário
useEffect(() => {
  if (user && !loading) {
    // Verificar e criar dados do usuário se necessário
    checkAndCreateUserData(user.id, user.email || '');
  }
}, [user, loading]);
```

### **3. Alternativa: Criar ao Fazer Login**

Se preferir criar os dados imediatamente após login, modificar a função de login:

```typescript
// No componente de login
const handleLogin = async (email: string, password: string) => {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    
    if (error) throw error;
    
    if (data.user) {
      // Verificar e criar dados após login bem-sucedido
      await checkAndCreateUserData(data.user.id, data.user.email || '');
    }
    
  } catch (error) {
    console.error('Erro no login:', error);
  }
};
```

---

## 🔧 **TESTE DA IMPLEMENTAÇÃO**

### **1. Criar Novo Usuário**
```bash
# Testar cadastro
npm run dev
# Cadastrar novo usuário via interface
```

### **2. Verificar Criação dos Dados**
```sql
-- No painel SQL do Supabase
SELECT 
  u.id, 
  u.email,
  p.username,
  s.posts_count,
  w.balance
FROM auth.users u
LEFT JOIN profiles p ON u.id = p.id
LEFT JOIN user_stats s ON u.id = s.user_id
LEFT JOIN shhhhcoin_wallets w ON u.id = w.user_id
ORDER BY u.created_at DESC
LIMIT 5;
```

### **3. Monitorar Logs**
```javascript
// Verificar console do navegador
// Deve mostrar:
// ✅ Perfil criado com sucesso!
// ✅ Estatísticas criadas com sucesso!
// ✅ Carteira criada com sucesso!
```

---

## ⚠️ **PONTOS DE ATENÇÃO**

### **1. Políticas RLS**
Certifique-se de que as políticas RLS permitem inserção:
```sql
-- Verificar políticas
SELECT * FROM pg_policies WHERE tablename IN ('profiles', 'user_stats', 'shhhhcoin_wallets');
```

### **2. Tratamento de Erros**
- Implementar retry em caso de falha
- Notificar usuário se criação falhar
- Permitir recriação manual se necessário

### **3. Performance**
- Fazer inserções em paralelo se possível
- Não bloquear interface durante criação
- Mostrar loading/progress para usuário

---

## 🎯 **RESULTADO ESPERADO**

✅ **Cadastro**: Funcionando 100%  
✅ **Perfil**: Criado automaticamente no primeiro login  
✅ **Estatísticas**: Inicializadas com valores padrão  
✅ **Carteira**: Criada com saldo inicial de 100 moedas  
✅ **Experiência**: Usuário não percebe diferença  

---

**🚀 PRONTO PARA IMPLEMENTAR!** 