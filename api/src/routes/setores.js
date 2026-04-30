// routes/setores.js
const router = require('express').Router();
const db = require('../models/db');
const { auth, perfil } = require('../middleware/auth');

router.get('/', auth, async (req, res) => {
  const { unidade_id } = req.query;
  const [rows] = await db.query('SELECT * FROM setores WHERE unidade_id=? AND ativo=1 ORDER BY ordem', [unidade_id]);
  res.json(rows);
});
router.post('/', auth, perfil('admin_global','admin_unidade'), async (req, res) => {
  const { unidade_id, nome, prefixo, ordem=0 } = req.body;
  const [r] = await db.query('INSERT INTO setores (unidade_id,nome,prefixo,ordem) VALUES (?,?,?,?)',[unidade_id,nome,prefixo,ordem]);
  res.status(201).json({ id: r.insertId });
});
router.put('/:id', auth, perfil('admin_global','admin_unidade'), async (req, res) => {
  const { nome, prefixo, ordem, ativo } = req.body;
  await db.query('UPDATE setores SET nome=?,prefixo=?,ordem=?,ativo=? WHERE id=?',[nome,prefixo,ordem,ativo,req.params.id]);
  res.json({ ok: true });
});
router.delete('/:id', auth, perfil('admin_global','admin_unidade'), async (req, res) => {
  await db.query('UPDATE setores SET ativo=0 WHERE id=?',[req.params.id]);
  res.json({ ok: true });
});

module.exports = router;
