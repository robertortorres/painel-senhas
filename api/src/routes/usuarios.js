const router = require('express').Router();
const db     = require('../models/db');
const bcrypt = require('bcrypt');
const { auth, perfil } = require('../middleware/auth');

router.get('/', auth, perfil('admin_global','admin_unidade'), async (req, res) => {
  const [rows] = await db.query(
    'SELECT id,nome,login,perfil,unidade_id,ativo FROM usuarios WHERE unidade_id=? OR ?=0',
    [req.query.unidade_id||0, req.query.unidade_id||0]
  );
  res.json(rows);
});

router.post('/', auth, perfil('admin_global','admin_unidade'), async (req, res) => {
  const { nome, login, senha, perfil: p, unidade_id } = req.body;
  const hash = await bcrypt.hash(senha, 10);
  const [r] = await db.query(
    'INSERT INTO usuarios (nome,login,senha_hash,perfil,unidade_id) VALUES (?,?,?,?,?)',
    [nome, login, hash, p, unidade_id]
  );
  res.status(201).json({ id: r.insertId });
});

router.put('/:id', auth, perfil('admin_global','admin_unidade'), async (req, res) => {
  const { nome, perfil: p, ativo, senha } = req.body;
  if (senha) {
    const hash = await bcrypt.hash(senha, 10);
    await db.query('UPDATE usuarios SET nome=?,perfil=?,ativo=?,senha_hash=? WHERE id=?',[nome,p,ativo,hash,req.params.id]);
  } else {
    await db.query('UPDATE usuarios SET nome=?,perfil=?,ativo=? WHERE id=?',[nome,p,ativo,req.params.id]);
  }
  res.json({ ok: true });
});

module.exports = router;
