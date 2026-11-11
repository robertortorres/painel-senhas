const router = require('express').Router();
const bcrypt = require('bcryptjs');
const db = require('../models/db');
const { auth, perfil, ehGlobal, unidadeDaRequisicao, garantirUnidade } = require('../middleware/auth');
const { erro, inteiroPositivo, texto, booleano } = require('../lib/http');

const PERFIS = ['admin_global', 'admin_unidade', 'atendente', 'medico', 'triagem', 'relatorios'];
const ADMIN = ['admin_unidade'];

function perfilPermitido(req, p) {
  if (!PERFIS.includes(p)) throw erro(400, 'Perfil inválido');
  if (p === 'admin_global' && !ehGlobal(req)) throw erro(403, 'Somente admin global pode criar admin global');
  return p;
}

function senhaValida(s) {
  const v = String(s || '');
  if (v.length < 8) throw erro(400, 'Senha deve ter pelo menos 8 caracteres');
  return v;
}

router.get('/', auth, perfil(...ADMIN), async (req, res) => {
  if (ehGlobal(req) && !req.query.unidade_id) {
    const [rows] = await db.query('SELECT id, nome, login, perfil, unidade_id, ativo FROM usuarios ORDER BY nome');
    return res.json(rows);
  }
  const unidadeId = unidadeDaRequisicao(req, req.query.unidade_id);
  const [rows] = await db.query(
    `SELECT id, nome, login, perfil, unidade_id, ativo FROM usuarios
     WHERE unidade_id = ? ${ehGlobal(req) ? '' : "AND perfil <> 'admin_global'"} ORDER BY nome`, [unidadeId]);
  res.json(rows);
});

router.post('/', auth, perfil(...ADMIN), async (req, res) => {
  const b = req.body || {};
  const login = texto(b.login, 'login', { min: 3, max: 50 }).toLowerCase();
  if (!/^[a-z0-9._-]+$/.test(login)) throw erro(400, 'Login só pode ter letras, números, ponto, hífen e underline');
  const p = perfilPermitido(req, b.perfil || 'atendente');
  const unidadeId = unidadeDaRequisicao(req, b.unidade_id);
  const hash = await bcrypt.hash(senhaValida(b.senha), 10);
  const [r] = await db.query(
    'INSERT INTO usuarios (nome, login, senha_hash, perfil, unidade_id) VALUES (?, ?, ?, ?, ?)',
    [texto(b.nome, 'nome'), login, hash, p, unidadeId]);
  res.status(201).json({ id: r.insertId });
});

router.put('/:id', auth, perfil(...ADMIN), async (req, res) => {
  const id = inteiroPositivo(req.params.id, 'id');
  const [[alvo]] = await db.query('SELECT id, perfil, unidade_id FROM usuarios WHERE id = ?', [id]);
  if (!alvo) throw erro(404, 'Usuário não encontrado');
  garantirUnidade(req, alvo.unidade_id);
  if (alvo.perfil === 'admin_global' && !ehGlobal(req)) throw erro(404, 'Usuário não encontrado');

  const b = req.body || {};
  const novoPerfil = b.perfil === undefined ? null : perfilPermitido(req, b.perfil);
  const ativo = booleano(b.ativo);
  if (alvo.id === req.usuario.id && (ativo === 0 || (novoPerfil && novoPerfil !== alvo.perfil))) {
    throw erro(400, 'Você não pode desativar nem alterar o perfil do próprio usuário');
  }
  const hash = b.senha ? await bcrypt.hash(senhaValida(b.senha), 10) : null;
  await db.query(
    `UPDATE usuarios SET nome = COALESCE(?, nome), perfil = COALESCE(?, perfil),
       ativo = COALESCE(?, ativo), senha_hash = COALESCE(?, senha_hash) WHERE id = ?`,
    [b.nome === undefined ? null : texto(b.nome, 'nome'), novoPerfil, ativo, hash, id]);
  res.json({ ok: true });
});

module.exports = router;
