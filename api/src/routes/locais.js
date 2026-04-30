const router = require('express').Router();
const db = require('../models/db');
const { auth, perfil } = require('../middleware/auth');

router.get('/', auth, async (req, res) => {
  const [rows] = await db.query('SELECT * FROM locais WHERE unidade_id=? AND ativo=1',[req.query.unidade_id]);
  res.json(rows);
});
router.post('/', auth, perfil('admin_global','admin_unidade'), async (req, res) => {
  const { unidade_id, nome } = req.body;
  const [r] = await db.query('INSERT INTO locais (unidade_id,nome) VALUES (?,?)',[unidade_id,nome]);
  res.status(201).json({ id: r.insertId });
});
router.put('/:id', auth, perfil('admin_global','admin_unidade'), async (req, res) => {
  await db.query('UPDATE locais SET nome=?,ativo=? WHERE id=?',[req.body.nome,req.body.ativo,req.params.id]);
  res.json({ ok: true });
});
router.delete('/:id', auth, perfil('admin_global','admin_unidade'), async (req, res) => {
  await db.query('UPDATE locais SET ativo=0 WHERE id=?',[req.params.id]);
  res.json({ ok: true });
});
module.exports = router;
