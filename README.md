# SGA — Sistema de Gerenciamento de Atendimento

Sistema de senhas para clínicas com atualização em tempo real via Socket.io.

## Estrutura

```
painel-senhas/
├── docker-compose.yml
├── .env.example            ← copie para .env (nunca commite o .env)
├── sql/
│   ├── init.sql            ← schema + dados iniciais (só roda com volume vazio)
│   └── migrations/         ← alterações para instalações existentes
├── nginx/nginx.conf        ← proxy único: /, /painel/, /totem/, /api/, /socket.io/
├── api/                    ← Node.js 22 + Express 5 + Socket.io
│   └── src/
│       ├── server.js, config.js
│       ├── lib/http.js           ← erros e validação
│       ├── models/db.js
│       ├── middleware/auth.js    ← JWT + escopo por unidade
│       ├── services/             ← regras de senha, bootstrap do admin
│       ├── socket/index.js
│       ├── scripts/reset-senha.js
│       └── routes/               ← auth, publico, senhas, setores, locais, unidades, usuarios, relatorios
├── painel/                 ← Painel TV (HTML puro, Socket.io, voz)
├── totem/                  ← Totem (Web Bluetooth para impressora térmica)
└── atendimento/            ← Atendimento + Admin (Vue 3)
```

## Instalação nova

```bash
cp .env.example .env && chmod 600 .env
# preencha DB_PASS, MYSQL_ROOT_PASSWORD, JWT_SECRET e ADMIN_SENHA_INICIAL
docker compose up -d --build
```

Na primeira subida a API cria o usuário `admin` com a senha de `ADMIN_SENHA_INICIAL`.
Troque a senha pelo módulo Administrativo depois do primeiro acesso.

## Atualizando uma instalação existente

1. Crie o `.env` com as senhas **atuais** do banco (o MySQL só aplica as variáveis na criação do volume).
2. Aplique a migração uma única vez:
   ```bash
   docker compose exec -T mysqldb sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" clinicasga' < sql/migrations/001_melhorias.sql
   ```
3. Suba a nova versão e remova o Redis, que não é mais usado:
   ```bash
   docker compose up -d --build --remove-orphans
   ```
4. Redefina a senha do admin:
   ```bash
   docker compose exec api node src/scripts/reset-senha.js admin
   ```

## Acessos

| URL                            | Serviço              |
|--------------------------------|----------------------|
| http://SEU_HOST/               | Módulo Atendimento   |
| http://SEU_HOST/painel/?unidade=1 | Painel TV         |
| http://SEU_HOST/totem/?unidade=1  | Totem (tablet)    |

Ferramentas administrativas ficam desligadas por padrão e, quando ligadas, só escutam no localhost do servidor:

```bash
docker compose --profile admin up -d      # phpMyAdmin em 127.0.0.1:8082, Portainer em 127.0.0.1:9000
ssh -L 8082:127.0.0.1:8082 usuario@servidor   # acesso pelo seu computador
```

## HTTPS (obrigatório para a impressão Bluetooth)

O navegador só libera Web Bluetooth em páginas HTTPS. Coloque um proxy com certificado na frente
(ex.: Nginx Proxy Manager com certificado da CA interna) apontando para a porta do nginx deste projeto,
e ajuste `TRUST_PROXY=2` no `.env`. Os tablets precisam confiar na CA.

## Painel TV

O Chrome só permite falar depois de uma interação. Duas opções:

- Abrir `/painel/?unidade=1` e tocar uma vez na tela ao ligar a TV.
- Rodar em modo quiosque sem essa restrição e usar `?kiosk=1`:
  ```
  chromium --kiosk --autoplay-policy=no-user-gesture-required "https://SEU_HOST/painel/?unidade=1&kiosk=1"
  ```

O painel reconecta sozinho e, ao reconectar, recupera as últimas chamadas.

## Impressão Bluetooth (Totem)

1. Ligar a impressora térmica BLE e parear no Android
2. Abrir o Totem no Chrome Android (via HTTPS)
3. Após gerar a senha, tocar em "Imprimir comprovante" e escolher a impressora na primeira vez
4. Nas próximas senhas a impressão é automática enquanto a conexão estiver ativa

**Impressoras compatíveis:** Elgin i9 BT, Bematech MP-4200 TH, Epson TM-m30II, Datecs DPP-350 e qualquer modelo com GATT UUID 0xFF00 ou 0x18F0.

## Variáveis de ambiente (.env)

| Variável              | Descrição |
|-----------------------|-----------|
| DB_PASS               | Senha do usuário `sgaapp` do MySQL |
| MYSQL_ROOT_PASSWORD   | Senha de root do MySQL |
| JWT_SECRET            | Chave JWT (mínimo 32 caracteres; a API não sobe sem ela) |
| JWT_EXPIRES_IN        | Validade do token (padrão: 8h) |
| ADMIN_SENHA_INICIAL   | Senha do `admin`, usada só com o banco sem usuários |
| PRIORIDADE_A_CADA     | 0 = prioritário sempre primeiro; N = 1 prioritário a cada N normais |
| LIMITE_SENHAS_MINUTO  | Senhas por minuto por IP no totem (padrão: 30) |
| TRUST_PROXY           | Proxies na frente da API (nginx = 1; NPM + nginx = 2) |
| HTTP_PORT             | Porta publicada do nginx (padrão: 80) |

## Perfis

| Perfil         | Pode |
|----------------|------|
| admin_global   | Tudo, em todas as unidades |
| admin_unidade  | Atender e administrar setores, locais e usuários da própria unidade |
| atendente / medico | Chamar e atender senhas da própria unidade |
| relatorios     | Consultar relatórios da própria unidade (API) |
