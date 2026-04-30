const router = require('express').Router();
const db     = require('../models/db');
const redis  = require('../services/redis');
const { auth, perfil } = require('../middleware/auth');

// Gerar próximo número da senha (por unidade+setor+dia)
async function proximoNumero(unidade_id, setor_id) {
  const hoje = new Date().toISOString().slice(0,10);
  const key  = `seq:${unidade_id}:${setor_id}:${hoje}`;
  const num  = await redis.incr(key);
  await redis.expireAt(key, Math.floor(new Date().setHours(23,59,59,999)/1000));
  return num;
}

// Montar payload ESC/POS para impressão no tablet
function montarEscPos(senha) {
  const enc = str => Array.from(new TextEncoder().encode(str));
  const ESC = 0x1B, GS = 0x1D, LF = 0x0A;
  return [
    ESC, 0x40,           // inicializar
    ESC, 0x61, 0x01,     // centralizar
    GS,  0x21, 0x11,     // fonte 2x
    ...enc(senha.codigo),
    LF, LF,
    GS,  0x21, 0x00,     // fonte normal
    ...enc(senha.setor_nome),
    LF,
    ...enc(senha.tipo === 'prioritario' ? '*** PRIORITARIO ***' : ''),
    LF,
    ...enc(new Date().toLocaleString('pt-BR')),
    LF,
    ...enc(`Posicao na fila: ${senha.posicao}`),
    LF, LF, LF,
    GS,  0x56, 0x41, 0x05 // cortar papel
  ];
}

// POST /api/senhas — gerar nova senha (totem ou triagem manual)
router.post('/', async (req, res) => {
  const { unidade_id, setor_id, tipo = 'normal' } = req.body;
  if (!unidade_id || !setor_id) return res.status(400).json({ erro: 'unidade_id e setor_id obrigatórios' });
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [[setor]] = await conn.query('SELECT * FROM setores WHERE id=? AND unidade_id=? AND ativo=1',[setor_id, unidade_id]);
    if (!setor) { await conn.rollback(); return res.status(404).json({ erro: 'Setor não encontrado' }); }

    const numero = await proximoNumero(unidade_id, setor_id);
    const [result] = await conn.query(
      'INSERT INTO senhas (unidade_id,setor_id,numero,prefixo,tipo) VALUES (?,?,?,?,?)',
      [unidade_id, setor_id, numero, setor.prefixo, tipo]
    );
    const [[senha]] = await conn.query(`
      SELECT s.*, st.nome as setor_nome, st.prefixo
      FROM senhas s JOIN setores st ON st.id=s.setor_id
      WHERE s.id=?`, [result.insertId]);

    // Posição na fila
    const [[{ posicao }]] = await conn.query(
      "SELECT COUNT(*) as posicao FROM senhas WHERE unidade_id=? AND setor_id=? AND status='aguardando' AND DATE(criado_em)=CURDATE()",
      [unidade_id, setor_id]
    );
    senha.posicao = posicao;

    await conn.commit();

    // Emitir evento Socket.io para atendentes
    req.io.to(`unidade:${unidade_id}`).emit('senha:criada', senha);

    res.status(201).json({
      senha,
      escpos: montarEscPos(senha)
    });
  } catch (e) {
    await conn.rollback();
    res.status(500).json({ erro: e.message });
  } finally {
    conn.release();
  }
});

// GET /api/senhas/fila?unidade_id=1 — fila atual
router.get('/fila', auth, async (req, res) => {
  const { unidade_id } = req.query;
  try {
    const [aguardando] = await db.query(`
      SELECT s.*, st.nome as setor_nome, l.nome as local_nome
      FROM senhas s
      JOIN setores st ON st.id=s.setor_id
      LEFT JOIN locais l ON l.id=s.local_id
      WHERE s.unidade_id=? AND s.status IN ('aguardando','chamada','atendimento')
      AND DATE(s.criado_em)=CURDATE()
      ORDER BY s.tipo DESC, s.criado_em ASC`, [unidade_id]);
    res.json(aguardando);
  } catch (e) {
    res.status(500).json({ erro: e.message });
  }
});

// POST /api/senhas/:id/chamar — chamar senha
router.post('/:id/chamar', auth, perfil('atendente','medico','admin_unidade','admin_global'), async (req, res) => {
  const { local_id } = req.body;
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [[senha]] = await conn.query(`
      SELECT s.*, st.nome as setor_nome, l.nome as local_nome
      FROM senhas s JOIN setores st ON st.id=s.setor_id
      LEFT JOIN locais l ON l.id=?
      WHERE s.id=?`, [local_id, req.params.id]);
    if (!senha) { await conn.rollback(); return res.status(404).json({ erro: 'Senha não encontrada' }); }

    await conn.query(
      "UPDATE senhas SET status='chamada', local_id=?, usuario_id=?, chamado_em=NOW() WHERE id=?",
      [local_id, req.usuario.id, req.params.id]
    );
    await conn.commit();

    senha.status     = 'chamada';
    senha.local_id   = local_id;
    senha.usuario_id = req.usuario.id;

    // Emitir para o painel TV e atendentes
    req.io.to(`unidade:${senha.unidade_id}`).emit('senha:chamada', {
      ...senha,
      local_nome: req.body.local_nome || senha.local_nome
    });
    req.io.to(`unidade:${senha.unidade_id}`).emit('fila:atualizada');

    res.json(senha);
  } catch (e) {
    await conn.rollback();
    res.status(500).json({ erro: e.message });
  } finally {
    conn.release();
  }
});

// POST /api/senhas/:id/atender — iniciar atendimento
router.post('/:id/atender', auth, async (req, res) => {
  await db.query("UPDATE senhas SET status='atendimento' WHERE id=?", [req.params.id]);
  req.io.to(`unidade:${req.body.unidade_id}`).emit('fila:atualizada');
  res.json({ ok: true });
});

// POST /api/senhas/:id/concluir — finalizar atendimento
router.post('/:id/concluir', auth, async (req, res) => {
  await db.query("UPDATE senhas SET status='concluido', concluido_em=NOW() WHERE id=?", [req.params.id]);
  req.io.to(`unidade:${req.body.unidade_id}`).emit('fila:atualizada');
  res.json({ ok: true });
});

// POST /api/senhas/:id/cancelar
router.post('/:id/cancelar', auth, async (req, res) => {
  await db.query("UPDATE senhas SET status='cancelado' WHERE id=?", [req.params.id]);
  req.io.to(`unidade:${req.body.unidade_id}`).emit('fila:atualizada');
  res.json({ ok: true });
});

module.exports = router;
