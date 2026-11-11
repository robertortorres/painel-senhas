const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const db = require('../models/db');
const { jwtSecret, jwtExpiresIn } = require('../config');
const { auth } = require('../middleware/auth');

// Freia tentativa de força bruta: 10 tentativas por minuto por IP
const limiteLogin = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { erro: 'Muitas tentativas. Aguarde um minuto.' },
});

router.post('/login', limiteLogin, async (req, res) => {
  const { login, senha } = req.body || {};
  if (!login || !senha) return res.status(400).json({ erro: 'Login e senha obrigatórios' });
  const [[user]] = await db.query(
    'SELECT id, nome, login, perfil, unidade_id, senha_hash FROM usuarios WHERE login = ? AND ativo = 1',
    [String(login).trim()]);
  const ok = user && await bcrypt.compare(String(senha), user.senha_hash);
  if (!ok) return res.status(401).json({ erro: 'Credenciais inválidas' });
  const token = jwt.sign({ id: user.id }, jwtSecret, { expiresIn: jwtExpiresIn });
  res.json({ token, usuario: { id: user.id, nome: user.nome, login: user.login, perfil: user.perfil, unidade_id: user.unidade_id } });
});

// Dados atualizados do usuário logado (o frontend usa para validar o token salvo)
router.get('/me', auth, (req, res) => res.json(req.usuario));

module.exports = router;
