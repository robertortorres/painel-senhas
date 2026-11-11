const config = require('./config');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const db = require('./models/db');
const setupSocket = require('./socket');
const bootstrapAdmin = require('./services/bootstrap');
const { errorHandler } = require('./lib/http');

const app = express();
const server = http.createServer(app);
// Mesma origem via nginx: sem CORS. O cliente fica em /socket.io/socket.io.js
const io = new Server(server);

app.set('trust proxy', config.trustProxy);
app.disable('x-powered-by');
// A logo da clínica vai em base64 na config: limite maior só nessa rota
app.use('/api/config', express.json({ limit: '3mb' }));
app.use(express.json({ limit: '100kb' }));
app.use((req, _res, next) => { req.io = io; next(); });

app.use('/api/auth', require('./routes/auth'));
app.use('/api/publico', require('./routes/publico'));
app.use('/api/unidades', require('./routes/unidades'));
app.use('/api/setores', require('./routes/setores'));
app.use('/api/locais', require('./routes/locais'));
app.use('/api/senhas', require('./routes/senhas'));
app.use('/api/usuarios', require('./routes/usuarios'));
app.use('/api/relatorios', require('./routes/relatorios'));
app.use('/api/config', require('./routes/config'));

app.get('/api/health', async (_req, res) => {
  await db.query('SELECT 1');
  res.json({ ok: true });
});

app.use('/api', (_req, res) => res.status(404).json({ erro: 'Rota não encontrada' }));
app.use(errorHandler);

setupSocket(io);

const esperar = ms => new Promise(r => setTimeout(r, ms));

async function iniciar() {
  for (let tentativa = 1; ; tentativa++) {
    try {
      await db.query('SELECT 1');
      break;
    } catch (e) {
      if (tentativa >= 30) throw e;
      console.log(`Aguardando banco de dados (${tentativa}/30): ${e.code || e.message}`);
      await esperar(2000);
    }
  }
  await bootstrapAdmin();
  server.listen(config.port, () => console.log(`SGA API rodando na porta ${config.port}`));
  require('./services/fechamento').agendarFechamento();
}

function encerrar(sinal) {
  console.log(`${sinal} recebido, encerrando...`);
  io.close();
  server.close(() => db.end().finally(() => process.exit(0)));
  setTimeout(() => process.exit(0), 5000).unref();
}
process.on('SIGTERM', () => encerrar('SIGTERM'));
process.on('SIGINT', () => encerrar('SIGINT'));

iniciar().catch(e => {
  console.error('Falha ao iniciar:', e);
  process.exit(1);
});
