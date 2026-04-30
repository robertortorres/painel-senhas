const router  = require('express').Router();
const bcrypt  = require('bcrypt');
const jwt     = require('jsonwebtoken');
const db      = require('../models/db');

router.post('/login', async (req, res) => {
  const { login, senha } = req.body;
  if (!login || !senha) return res.status(400).json({ erro: 'Login e senha obrigatórios' });
  try {
    const [rows] = await db.query(
      'SELECT * FROM usuarios WHERE login = ? AND ativo = 1', [login]
    );
    if (!rows.length) return res.status(401).json({ erro: 'Credenciais inválidas' });
    const user = rows[0];
    const ok   = await bcrypt.compare(senha, user.senha_hash);
    if (!ok) return res.status(401).json({ erro: 'Credenciais inválidas' });
    const token = jwt.sign(
      { id: user.id, login: user.login, perfil: user.perfil, unidade_id: user.unidade_id },
      process.env.JWT_SECRET || 'segredo',
      { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
    );
    res.json({ token, usuario: { id: user.id, nome: user.nome, perfil: user.perfil, unidade_id: user.unidade_id } });
  } catch (e) {
    res.status(500).json({ erro: e.message });
  }
});

module.exports = router;
