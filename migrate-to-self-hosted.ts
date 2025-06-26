import { createClient } from '@supabase/supabase-js';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const SUPABASE_SELF_HOSTED_URL = "https://supabase.nutef.com";
const SUPABASE_SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.ewogICJyb2xlIjogInNlcnZpY2Vfcm9sZSIsCiAgImlzcyI6ICJzdXBhYmFzZSIsCiAgImlhdCI6IDE3MTUwNTA4MDAsCiAgImV4cCI6IDE4NzI4MTcyMDAKfQ.Y0Ai9IMrIhHc79Gzxsh9Nl9QnyLXQar0ZrU6kEE8XAs";

// Cliente com service key para operações administrativas
const supabase = createClient(SUPABASE_SELF_HOSTED_URL, SUPABASE_SERVICE_KEY);

async function applyMigrations() {
  console.log('🚀 Iniciando aplicação das migrações...\n');
  
  try {
    // Listar todos os arquivos de migração
    const migrationsDir = './supabase/migrations';
    const migrationFiles = readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort(); // Importante: aplicar em ordem cronológica
    
    console.log(`📁 Encontradas ${migrationFiles.length} migrações:\n`);
    migrationFiles.forEach(file => console.log(`  - ${file}`));
    console.log('');
    
    // Aplicar cada migração
    for (const file of migrationFiles) {
      console.log(`📄 Aplicando: ${file}`);
      
      try {
        const sqlContent = readFileSync(join(migrationsDir, file), 'utf-8');
        
        // Dividir o SQL em comandos individuais (separados por ponto e vírgula)
        const commands = sqlContent
          .split(';')
          .map(cmd => cmd.trim())
          .filter(cmd => cmd.length > 0 && !cmd.startsWith('--'));
        
        for (const command of commands) {
          if (command.trim()) {
            const { error } = await supabase.rpc('exec_sql', { 
              sql_query: command 
            });
            
            if (error) {
              // Alguns erros podem ser esperados (tabela já existe, etc.)
              if (error.message.includes('already exists') || 
                  error.message.includes('duplicate key') ||
                  error.message.includes('does not exist')) {
                console.log(`    ⚠️ Aviso: ${error.message}`);
              } else {
                throw error;
              }
            }
          }
        }
        
        console.log(`    ✅ Aplicada com sucesso`);
        
      } catch (error) {
        console.error(`    ❌ Erro ao aplicar ${file}:`, error.message);
        // Continuar com as próximas migrações mesmo se uma falhar
      }
    }
    
    console.log('\n🎉 Processo de migração concluído!');
    
    // Verificar se as tabelas foram criadas
    await verifyTables();
    
  } catch (error) {
    console.error('❌ Erro geral na migração:', error);
  }
}

async function verifyTables() {
  console.log('\n🔍 Verificando tabelas criadas...');
  
  const expectedTables = [
    'profiles',
    'audio_posts',
    'likes', 
    'followers',
    'hashtags',
    'audio_hashtags',
    'daily_challenges',
    'private_groups',
    'group_members',
    'audio_replies',
    'audio_reposts',
    'reports',
    'user_roles',
    'user_stats'
  ];
  
  for (const table of expectedTables) {
    try {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .limit(1);
      
      if (error) {
        console.log(`❌ Tabela '${table}': ${error.message}`);
      } else {
        console.log(`✅ Tabela '${table}': OK`);
      }
    } catch (err) {
      console.log(`❌ Tabela '${table}': Erro de verificação`);
    }
  }
}

async function createExecSqlFunction() {
  console.log('🛠️ Criando função auxiliar exec_sql...');
  
  const createFunctionSQL = `
    CREATE OR REPLACE FUNCTION exec_sql(sql_query text)
    RETURNS void
    LANGUAGE plpgsql
    SECURITY DEFINER
    AS $$
    BEGIN
      EXECUTE sql_query;
    END;
    $$;
  `;
  
  try {
    const { error } = await supabase.rpc('exec', { 
      sql: createFunctionSQL 
    });
    
    if (error) {
      console.log('⚠️ Função exec_sql pode já existir ou não ter permissões');
    } else {
      console.log('✅ Função exec_sql criada');
    }
  } catch (err) {
    console.log('⚠️ Tentativa alternativa para executar SQL diretamente');
  }
}

// Executar migração
async function main() {
  await createExecSqlFunction();
  await applyMigrations();
}

main().catch(console.error); 