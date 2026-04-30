# SGA — Sistema de Gerenciamento de Atendimento

Sistema de senhas para clínicas com atualização em tempo real via Socket.io.

## Estrutura

```
sga/
├── docker-compose.yml
├── .env.example
├── sql/
│   └── init.sql          ← schema + dados iniciais
├── nginx/
│   └── nginx.conf
├── api/                  ← Backend Node.js + Express + Socket.io
│   ├── Dockerfile
│   ├── package.json
│   └── src/
│       ├── server.js
│       ├── models/db.js
│       ├── services/redis.js
│       ├── middleware/auth.js
│       ├── socket/index.js
│       └── routes/
│           ├── auth.js
│           ├── senhas.js
│           ├── setores.js
│           ├── locais.js
│           ├── unidades.js
│           ├── usuarios.js
│           └── relatorios.js
├── painel/               ← Painel TV (HTML puro, Socket.io, TTS)
│   ├── Dockerfile
│   └── index.html
├── totem/                ← Totem PWA (Web Bluetooth API)
│   ├── Dockerfile
│   └── index.html
└── atendimento/          ← Atendimento + Admin (Vue.js)
    ├── Dockerfile
    └── index.html
```

## Subir o sistema

```bash
cp .env.example .env
docker compose up -d --build
```

## Acessos

| URL                            | Serviço              |
|--------------------------------|----------------------|
| http://SEU_IP/                 | Módulo Atendimento   |
| http://SEU_IP/painel/          | Painel TV            |
| http://SEU_IP/totem/           | Totem (tablet)       |
| http://SEU_IP:8082             | phpMyAdmin           |
| http://SEU_IP:9000             | Portainer            |

## Login padrão

- **Usuário:** `admin`
- **Senha:** `Admin@123`

## Módulos por URL com parâmetro de unidade

```
/painel/?unidade=1
/totem/?unidade=1
```

## Impressão Bluetooth (Totem)

1. Ligar a impressora térmica BLE
2. Android → Configurações → Bluetooth → Parear dispositivo
3. Abrir o Totem no Chrome Android
4. Após gerar a senha, tocar em "Imprimir comprovante"
5. Na primeira vez, o Chrome mostra um diálogo para selecionar a impressora
6. Nas próximas vezes, conecta automaticamente

**Impressoras compatíveis:** Elgin i9 BT, Bematech MP-4200 TH, Epson TM-m30II, Datecs DPP-350 e qualquer modelo com GATT UUID 0xFF00 ou 0x18F0.

## Variáveis de ambiente (api)

| Variável         | Descrição                        |
|------------------|----------------------------------|
| DB_HOST          | Host do MySQL                    |
| DB_PASS          | Senha do usuário sgaapp          |
| REDIS_HOST       | Host do Redis                    |
| JWT_SECRET       | Chave JWT (mínimo 32 caracteres) |
| JWT_EXPIRES_IN   | Validade do token (padrão: 8h)   |
