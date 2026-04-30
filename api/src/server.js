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

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, {
  cors: { origin: '*', methods: ['GET','POST','PUT','DELETE'] }
});

app.use(cors());
app.use(express.json());

// injeta io em todas as rotas
app.use((req, _res, next) => { req.io = io; next(); });

app.use('/api/auth',       authRoutes);
app.use('/api/unidades',   unidadeRoutes);
app.use('/api/setores',    setorRoutes);
app.use('/api/locais',     localRoutes);
app.use('/api/senhas',     senhaRoutes);
app.use('/api/usuarios',   usuarioRoutes);
app.use('/api/relatorios', relRoutes);

app.get('/api/health', (_req, res) => res.json({ ok: true }));

setupSocket(io);

const PORT = process.env.PORT || 3001;
server.listen(PORT, async () => {
  await db.query('SELECT 1');
  await redisClient.ping();
  console.log(`SGA API rodando na porta ${PORT}`);
});
