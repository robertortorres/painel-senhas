const router = require('express').Router();
const db = require('../models/db');
const { auth, perfil, ehGlobal } = require('../middleware/auth');
const { erro, inteiroPositivo, texto, booleano } = require('../lib/http');

router.get('/', auth, async (req, res) => {
  if (ehGlobal(req)) {
    const [rows] = await db.query('SELECT * FROM unidades WHERE ativo = 1 ORDER BY nome');
    return res.json(rows);
  }
  const [rows] = await db.query('SELECT * FROM unidades WHERE id = ? AND ativo = 1', [req.usuario.unidade_id]);
  res.json(rows);
});

router.post('/', auth, perfil('admin_global'), async (req, res) => {
  const b = req.body || {};
  const [r] = await db.query('INSERT INTO unidades (nome, codigo) VALUES (?, ?)',
    [texto(b.nome, 'nome'), texto(b.codigo, 'codigo', { max: 20 })]);
  res.status(201).json({ id: r.insertId });
});

router.put('/:id', auth, perfil('admin_global'), async (req, res) => {
  const b = req.body || {};
  const [r] = await db.query('UPDATE unidades SET nome = COALESCE(?, nome), ativo = COALESCE(?, ativo) WHERE id = ?',
    [b.nome === undefined ? null : texto(b.nome, 'nome'), booleano(b.ativo), inteiroPositivo(req.params.id, 'id')]);
  if (!r.affectedRows) throw erro(404, 'Unidade não encontrada');
  res.json({ ok: true });
});

module.exports = router;
