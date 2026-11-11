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
│       └── routes/               ← auth, publico, config, senhas, setores, locais, unidades, usuarios, relatorios
├── painel/                 ← Painel TV (HTML puro, Socket.io, voz)
├── totem/                  ← Totem (impressão pelo navegador)
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
| http://SEU_HOST/relatorios/    | Relatórios (abre logado a partir do Atendimento) |

Ferramentas administrativas ficam desligadas por padrão e, quando ligadas, só escutam no localhost do servidor:

```bash
docker compose --profile admin up -d      # phpMyAdmin em 127.0.0.1:8082, Portainer em 127.0.0.1:9000
ssh -L 8082:127.0.0.1:8082 usuario@servidor   # acesso pelo seu computador
```

## Chamar de novo uma senha finalizada

Na tela de atendimento, a aba **Finalizados** lista as senhas concluídas ou canceladas no dia, com busca
pelo código. O botão **Chamar de novo** anuncia a senha no painel para o local selecionado por quem chamou
(por exemplo, a recepção chamando de volta um paciente que já foi atendido). A senha continua finalizada:
o atendimento não é reaberto e os tempos dos relatórios não mudam. Cada uso fica registrado no log da API.

## Fechamento diário

A numeração reinicia sozinha a cada dia, por setor. Senhas que sobraram de dias anteriores recebem um
status final automaticamente (ao iniciar a API e a cada 10 minutos):

- aguardando ou chamada → `nao_compareceu`
- em atendimento → `concluido` (sem horário de conclusão, para não distorcer o tempo médio)

Nos relatórios, as faltas aparecem no cartão de Cancelados. Para desligar, use `FECHAMENTO_DIARIO=0`.
Requer a migração `sql/migrations/002_nao_compareceu.sql`.

## Painel TV

O Chrome só permite falar depois de uma interação. Duas opções:

- Abrir `/painel/?unidade=1` e tocar uma vez na tela ao ligar a TV.
- Rodar em modo quiosque sem essa restrição e usar `?kiosk=1`:
  ```
  chromium --kiosk --autoplay-policy=no-user-gesture-required "https://SEU_HOST/painel/?unidade=1&kiosk=1"
  ```

O painel reconecta sozinho e, ao reconectar, recupera as últimas chamadas.

## Totem e impressão

O totem imprime o comprovante pelo diálogo de impressão do navegador. Tamanho do papel (58/80 mm)
e modo (`dialogo`, `botao`, `sem`) ficam em Administrativo → Configurações.
Para imprimir sem diálogo, rode o Chrome do totem com `--kiosk-printing`.

## Fuso horário do banco

A API usa `DB_TIMEZONE` (padrão `-03:00`) em cada conexão, para `NOW()`/`CURDATE()` e para
converter datas. Ele precisa bater com o horário em que os dados antigos foram gravados.
Confira antes do deploy:

```bash
docker exec sga-mysql sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" -e "SELECT @@system_time_zone, NOW(), UTC_TIMESTAMP()"'
```

Se `NOW()` estiver 3 horas antes do `UTC_TIMESTAMP()`, mantenha `-03:00`. Se forem iguais, o banco
gravava em UTC: use `DB_TIMEZONE=+00:00` para manter os dados consistentes.

## Variáveis de ambiente (.env)

| Variável              | Descrição |
|-----------------------|-----------|
| DB_PASS               | Senha do usuário `sgaapp` do MySQL |
| MYSQL_ROOT_PASSWORD   | Senha de root do MySQL |
| JWT_SECRET            | Chave JWT (mínimo 32 caracteres; a API não sobe sem ela) |
| JWT_EXPIRES_IN        | Validade do token (padrão: 8h) |
| ADMIN_SENHA_INICIAL   | Senha do `admin`, usada só com o banco sem usuários |
| DB_TIMEZONE           | Fuso do banco (padrão: -03:00). Veja a seção acima |
| FECHAMENTO_DIARIO     | 1 = fecha sozinho as senhas que sobraram de dias anteriores; 0 = desliga |
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
| relatorios     | Consultar relatórios da própria unidade |

Só administradores alteram as Configurações. Relatórios ficam com `relatorios`, `admin_unidade` e `admin_global`
(a lista está em `api/src/routes/relatorios.js`, constante `VEEM`).
