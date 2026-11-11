const router = require('express').Router();
const db = require('../models/db');
const { auth, perfil, unidadeDaRequisicao, garantirUnidade } = require('../middleware/auth');
const { erro, inteiroPositivo, texto, booleano } = require('../lib/http');

const ADMIN = ['admin_unidade'];

async function localDaUnidade(req) {
  const [[l]] = await db.query('SELECT * FROM locais WHERE id = ?', [inteiroPositivo(req.params.id, 'id')]);
  if (!l) throw erro(404, 'Local não encontrado');
  garantirUnidade(req, l.unidade_id);
  return l;
}

// GET /api/locais?unidade_id=1[&todos=1]
router.get('/', auth, async (req, res) => {
  const unidadeId = unidadeDaRequisicao(req, req.query.unidade_id);
  const todos = req.query.todos === '1';
  const [rows] = await db.query(
    `SELECT * FROM locais WHERE unidade_id = ? ${todos ? '' : 'AND ativo = 1'} ORDER BY nome`, [unidadeId]);
  res.json(rows);
});

router.post('/', auth, perfil(...ADMIN), async (req, res) => {
  const b = req.body || {};
  const unidadeId = unidadeDaRequisicao(req, b.unidade_id);
  const [r] = await db.query('INSERT INTO locais (unidade_id, nome) VALUES (?, ?)',
    [unidadeId, texto(b.nome, 'nome', { max: 80 })]);
  res.status(201).json({ id: r.insertId });
});

router.put('/:id', auth, perfil(...ADMIN), async (req, res) => {
  const l = await localDaUnidade(req);
  const b = req.body || {};
  await db.query('UPDATE locais SET nome = COALESCE(?, nome), ativo = COALESCE(?, ativo) WHERE id = ?',
    [b.nome === undefined ? null : texto(b.nome, 'nome', { max: 80 }), booleano(b.ativo), l.id]);
  res.json({ ok: true });
});

router.delete('/:id', auth, perfil(...ADMIN), async (req, res) => {
  const l = await localDaUnidade(req);
  await db.query('UPDATE locais SET ativo = 0 WHERE id = ?', [l.id]);
  res.json({ ok: true });
});

module.exports = router;
