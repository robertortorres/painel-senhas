const router = require('express').Router();
const db = require('../models/db');
const { auth, perfil, unidadeDaRequisicao, garantirUnidade } = require('../middleware/auth');
const { erro, inteiroPositivo, texto, opcional, booleano } = require('../lib/http');

const ADMIN = ['admin_unidade'];

function prefixoValido(v, obrigatorio = true) {
  if (!obrigatorio && (v === undefined || v === '')) return null;
  const p = String(v || '').trim().toUpperCase();
  if (!/^[A-Z0-9]{1,5}$/.test(p)) throw erro(400, 'Prefixo deve ter de 1 a 5 letras/números');
  return p;
}

async function setorDaUnidade(req) {
  const [[s]] = await db.query('SELECT * FROM setores WHERE id = ?', [inteiroPositivo(req.params.id, 'id')]);
  if (!s) throw erro(404, 'Setor não encontrado');
  garantirUnidade(req, s.unidade_id);
  return s;
}

// GET /api/setores?unidade_id=1 sem login: lista pública (totem). Com login: [&todos=1] para o admin.
router.get('/', async (req, res, next) => {
  if (req.headers.authorization) return next();
  const unidadeId = inteiroPositivo(req.query.unidade_id, 'unidade_id');
  const [rows] = await db.query(
    'SELECT id, nome, prefixo, ordem FROM setores WHERE unidade_id = ? AND ativo = 1 ORDER BY ordem, nome', [unidadeId]);
  res.json(rows);
});
router.get('/', auth, async (req, res) => {
  const unidadeId = unidadeDaRequisicao(req, req.query.unidade_id);
  const todos = req.query.todos === '1';
  const [rows] = await db.query(
    `SELECT * FROM setores WHERE unidade_id = ? ${todos ? '' : 'AND ativo = 1'} ORDER BY ordem, nome`, [unidadeId]);
  res.json(rows);
});

router.post('/', auth, perfil(...ADMIN), async (req, res) => {
  const b = req.body || {};
  const unidadeId = unidadeDaRequisicao(req, b.unidade_id);
  const [r] = await db.query('INSERT INTO setores (unidade_id, nome, prefixo, ordem) VALUES (?, ?, ?, ?)',
    [unidadeId, texto(b.nome, 'nome', { max: 80 }), prefixoValido(b.prefixo), Number(b.ordem) || 0]);
  res.status(201).json({ id: r.insertId });
});

router.put('/:id', auth, perfil(...ADMIN), async (req, res) => {
  const s = await setorDaUnidade(req);
  const b = req.body || {};
  await db.query(
    `UPDATE setores SET nome = COALESCE(?, nome), prefixo = COALESCE(?, prefixo),
       ordem = COALESCE(?, ordem), ativo = COALESCE(?, ativo) WHERE id = ?`,
    [b.nome === undefined ? null : texto(b.nome, 'nome', { max: 80 }), prefixoValido(b.prefixo, false),
      opcional(b.ordem) === null ? null : Number(b.ordem) || 0, booleano(b.ativo), s.id]);
  res.json({ ok: true });
});

router.delete('/:id', auth, perfil(...ADMIN), async (req, res) => {
  const s = await setorDaUnidade(req);
  await db.query('UPDATE setores SET ativo = 0 WHERE id = ?', [s.id]);
  res.json({ ok: true });
});

module.exports = router;
