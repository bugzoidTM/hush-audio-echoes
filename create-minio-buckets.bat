@echo off
echo 🪣 Criando buckets no MinIO via Docker...
echo.

echo 📦 Criando bucket 'public'...
docker exec -i nutef_storage_1 mc mb /data/public --quiet
if %errorlevel% neq 0 (
    echo ⚠️ Tentando com outro nome de container...
    docker exec -i $(docker ps --filter "name=storage" --format "{{.Names}}" | head -1) mc mb /data/public --quiet
)

echo 📦 Criando bucket 'audio-posts'...
docker exec -i nutef_storage_1 mc mb /data/audio-posts --quiet
if %errorlevel% neq 0 (
    docker exec -i $(docker ps --filter "name=storage" --format "{{.Names}}" | head -1) mc mb /data/audio-posts --quiet
)

echo 📦 Criando bucket 'audio-files'...
docker exec -i nutef_storage_1 mc mb /data/audio-files --quiet
if %errorlevel% neq 0 (
    docker exec -i $(docker ps --filter "name=storage" --format "{{.Names}}" | head -1) mc mb /data/audio-files --quiet
)

echo.
echo 🔓 Configurando acesso público...
docker exec -i nutef_storage_1 mc anonymous set public /data/public --quiet
docker exec -i nutef_storage_1 mc anonymous set public /data/audio-posts --quiet
docker exec -i nutef_storage_1 mc anonymous set public /data/audio-files --quiet

echo.
echo ✅ Buckets criados! Listando...
docker exec -i nutef_storage_1 mc ls /data/

echo.
echo 🎉 Configuração concluída! 