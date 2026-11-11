require('dotenv').config();
const express    = require('express');
const http       = require('http');
const cors       = require('cors');
const { Server } = require('socket.io');
const db         = require('./models/db');
const redisClient= require('./services/redis');
const setupSocket= require('./socket');

const authRoutes    = require('./routes/auth');
const unidadeRoutes = require('./routes/unidades');
const setorRoutes   = require('./routes/setores');
const localRoutes   = require('./routes/locais');
const senhaRoutes   = require('./routes/senhas');
const usuarioRoutes = require('./routes/usuarios');
const relRoutes     = require('./routes/relatorios');
const configRoutes  = require('./routes/config');

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, {
  cors: { origin: '*', methods: ['GET','POST','PUT','DELETE'] }
});

app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use((req, _res, next) => { req.io = io; next(); });

app.use('/api/auth',       authRoutes);
app.use('/api/unidades',   unidadeRoutes);
app.use('/api/setores',    setorRoutes);
app.use('/api/locais',     localRoutes);
app.use('/api/senhas',     senhaRoutes);
app.use('/api/usuarios',   usuarioRoutes);
app.use('/api/relatorios', relRoutes);
app.use('/api/config',     configRoutes);
app.get('/api/health', (_req, res) => res.json({ ok: true }));

setupSocket(io);

async function aguardarMySQL(tentativas = 20, intervalo = 5000) {
  for (let i = 1; i <= tentativas; i++) {
    try {
      await db.query('SELECT 1');
      console.log('MySQL conectado!');
      return;
    } catch (e) {
      console.log('MySQL aguardando... tentativa ' + i + '/' + tentativas);
      await new Promise(r => setTimeout(r, intervalo));
    }
  }
  throw new Error('MySQL indisponivel.');
}

const PORT = process.env.PORT || 3001;
server.listen(PORT, async () => {
  console.log('SGA API rodando na porta ' + PORT);
  try {
    await aguardarMySQL();
    await redisClient.ping();
    console.log('Todos os servicos conectados. API pronta!');
  } catch (e) {
    console.error('Erro:', e.message);
    process.exit(1);
  }
});
