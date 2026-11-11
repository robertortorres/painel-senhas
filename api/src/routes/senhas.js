const router = require('express').Router();
const db     = require('../models/db');
const redis  = require('../services/redis');
const { auth } = require('../middleware/auth');

async function proximoNumero(unidade_id, setor_id) {
  const hoje = new Date().toISOString().slice(0,10);
  const key  = 'seq:' + unidade_id + ':' + setor_id + ':' + hoje;
  const num  = await redis.incr(key);
  await redis.expireAt(key, Math.floor(new Date().setHours(23,59,59,999)/1000));
  return num;
}

function montarEscPos(senha) {
  const ESC = 0x1B, GS = 0x1D, LF = 0x0A;
  const enc = str => [...new TextEncoder().encode(str)];
  return [
    ESC, 0x40, ESC, 0x61, 0x01, GS, 0x21, 0x11,
    ...enc(senha.codigo), LF, LF,
    GS, 0x21, 0x00, ...enc(senha.setor_nome), LF,
    ...(senha.tipo==='prioritario' ? enc('*** PRIORITARIO ***') : []), LF,
    ...enc(new Date().toLocaleString('pt-BR')), LF,
    ...enc('Posicao na fila: ' + senha.posicao), LF, LF, LF,
    GS, 0x56, 0x41, 0x05
  ];
}

router.post('/', async (req, res) => {
  const { unidade_id, setor_id, tipo = 'normal' } = req.body;
  if (!unidade_id || !setor_id)
    return res.status(400).json({ erro: 'unidade_id e setor_id obrigatorios' });
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [[setor]] = await conn.query(
      'SELECT * FROM setores WHERE id=? AND unidade_id=? AND ativo=1', [setor_id, unidade_id]);
    if (!setor) { await conn.rollback(); return res.status(404).json({ erro: 'Setor nao encontrado' }); }
    const numero = await proximoNumero(unidade_id, setor_id);
    const [result] = await conn.query(
      'INSERT INTO senhas (unidade_id,setor_id,numero,prefixo,tipo) VALUES (?,?,?,?,?)',
      [unidade_id, setor_id, numero, setor.prefixo, tipo]);
    const [[senha]] = await conn.query(
      'SELECT s.*, st.nome as setor_nome FROM senhas s JOIN setores st ON st.id=s.setor_id WHERE s.id=?',
      [result.insertId]);
    const [[{ posicao }]] = await conn.query(
      "SELECT COUNT(*) as posicao FROM senhas WHERE unidade_id=? AND setor_id=? AND status='aguardando' AND DATE(criado_em)=CURDATE()",
      [unidade_id, setor_id]);
    senha.posicao = posicao;
    await conn.commit();
    req.io.to('unidade:' + unidade_id).emit('senha:criada', senha);
    res.status(201).json({ senha, escpos: montarEscPos(senha) });
  } catch(e) { await conn.rollback(); res.status(500).json({ erro: e.message }); }
  finally { conn.release(); }
});

router.get('/fila', auth, async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT s.*, st.nome as setor_nome, l.nome as local_nome
      FROM senhas s JOIN setores st ON st.id=s.setor_id
      LEFT JOIN locais l ON l.id=s.local_id
      WHERE s.unidade_id=? AND s.status IN ('aguardando','chamada','atendimento')
      AND DATE(s.criado_em)=CURDATE()
      ORDER BY s.tipo DESC, s.criado_em ASC`, [req.query.unidade_id]);
    res.json(rows);
  } catch(e) { res.status(500).json({ erro: e.message }); }
});

router.post('/:id/chamar', auth, async (req, res) => {
  const { local_id, unidade_id } = req.body;
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [[senha]] = await conn.query(
      'SELECT s.*, st.nome as setor_nome FROM senhas s JOIN setores st ON st.id=s.setor_id WHERE s.id=?',
      [req.params.id]);
    if (!senha) { await conn.rollback(); return res.status(404).json({ erro: 'Nao encontrada' }); }
    const [[local]] = await conn.query('SELECT nome FROM locais WHERE id=?', [local_id]);
    await conn.query(
      "UPDATE senhas SET status='chamada', local_id=?, usuario_id=?, chamado_em=NOW() WHERE id=?",
      [local_id, req.usuario.id, req.params.id]);
    await conn.commit();
    req.io.to('unidade:' + senha.unidade_id).emit('senha:chamada', {
      ...senha, status:'chamada', local_id, local_nome: local?.nome });
    req.io.to('unidade:' + senha.unidade_id).emit('fila:atualizada');
    res.json({ ok: true });
  } catch(e) { await conn.rollback(); res.status(500).json({ erro: e.message }); }
  finally { conn.release(); }
});

router.post('/:id/atender', auth, async (req, res) => {
  await db.query("UPDATE senhas SET status='atendimento' WHERE id=?", [req.params.id]);
  req.io.to('unidade:' + req.body.unidade_id).emit('fila:atualizada');
  res.json({ ok: true });
});

router.post('/:id/concluir', auth, async (req, res) => {
  await db.query("UPDATE senhas SET status='concluido', concluido_em=NOW() WHERE id=?", [req.params.id]);
  req.io.to('unidade:' + req.body.unidade_id).emit('fila:atualizada');
  res.json({ ok: true });
});

router.post('/:id/cancelar', auth, async (req, res) => {
  await db.query("UPDATE senhas SET status='cancelado' WHERE id=?", [req.params.id]);
  req.io.to('unidade:' + req.body.unidade_id).emit('fila:atualizada');
  res.json({ ok: true });
});

module.exports = router;
