const router = require('express').Router();
const db = require('../models/db');
const { auth, perfil } = require('../middleware/auth');

router.get('/', auth, async (_req, res) => {
  const [rows] = await db.query('SELECT * FROM unidades WHERE ativo=1');
  res.json(rows);
});
router.post('/', auth, perfil('admin_global'), async (req, res) => {
  const { nome, codigo } = req.body;
  const [r] = await db.query('INSERT INTO unidades (nome,codigo) VALUES (?,?)',[nome,codigo]);
  res.status(201).json({ id: r.insertId });
});
router.put('/:id', auth, perfil('admin_global'), async (req, res) => {
  await db.query('UPDATE unidades SET nome=?,ativo=? WHERE id=?',[req.body.nome,req.body.ativo,req.params.id]);
  res.json({ ok: true });
});
module.exports = router;
