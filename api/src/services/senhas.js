const db = require('../models/db');
const { prioridadeACada } = require('../config');
const { erro, inteiroPositivo } = require('../lib/http');

const TIPOS = ['normal', 'prioritario'];

const SELECT_SENHA = `
  SELECT s.id, s.unidade_id, s.setor_id, s.numero, s.prefixo, s.codigo, s.tipo, s.status,
         s.local_id, s.usuario_id, s.criado_em, s.chamado_em, s.concluido_em,
         st.nome AS setor_nome, l.nome AS local_nome
  FROM senhas s
  JOIN setores st ON st.id = s.setor_id
  LEFT JOIN locais l ON l.id = s.local_id`;

async function buscarSenha(id, conn = db) {
  const [[senha]] = await conn.query(`${SELECT_SENHA} WHERE s.id = ?`, [id]);
  return senha || null;
}

// Número sequencial por unidade+setor+dia, atômico e dentro da transação (sem Redis)
async function proximoNumero(conn, unidadeId, setorId) {
  await conn.query(
    `INSERT INTO seq_senhas (unidade_id, setor_id, data, ultimo)
     VALUES (?, ?, CURDATE(), LAST_INSERT_ID(1))
     ON DUPLICATE KEY UPDATE ultimo = LAST_INSERT_ID(ultimo + 1)`,
    [unidadeId, setorId]);
  const [[{ n }]] = await conn.query('SELECT LAST_INSERT_ID() AS n');
  return Number(n);
}

// Impressoras térmicas não entendem UTF-8: remove acentos
const semAcento = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\x20-\x7E]/g, '');

function montarEscPos(senha) {
  const enc = str => Array.from(Buffer.from(semAcento(str), 'ascii'));
  const ESC = 0x1B, GS = 0x1D, LF = 0x0A;
  const quando = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  return [
    ESC, 0x40,             // inicializar
    ESC, 0x61, 0x01,       // centralizar
    GS, 0x21, 0x11,        // fonte 2x
    ...enc(senha.codigo),
    LF, LF,
    GS, 0x21, 0x00,        // fonte normal
    ...enc(senha.setor_nome),
    LF,
    ...enc(senha.tipo === 'prioritario' ? '*** PRIORITARIO ***' : ''),
    LF,
    ...enc(quando),
    LF,
    ...enc(`Posicao na fila: ${senha.posicao}`),
    LF, LF, LF,
    GS, 0x56, 0x41, 0x05,  // cortar papel
  ];
}

async function criarSenha({ unidade_id, setor_id, tipo = 'normal' }) {
  const unidadeId = inteiroPositivo(unidade_id, 'unidade_id');
  const setorId = inteiroPositivo(setor_id, 'setor_id');
  if (!TIPOS.includes(tipo)) throw erro(400, 'tipo inválido');

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [[setor]] = await conn.query(
      `SELECT st.id, st.prefixo FROM setores st JOIN unidades u ON u.id = st.unidade_id
       WHERE st.id = ? AND st.unidade_id = ? AND st.ativo = 1 AND u.ativo = 1`,
      [setorId, unidadeId]);
    if (!setor) throw erro(404, 'Setor não encontrado');

    const numero = await proximoNumero(conn, unidadeId, setorId);
    const [r] = await conn.query(
      'INSERT INTO senhas (unidade_id, setor_id, numero, prefixo, tipo) VALUES (?, ?, ?, ?, ?)',
      [unidadeId, setorId, numero, setor.prefixo, tipo]);
    const senha = await buscarSenha(r.insertId, conn);

    const [[{ posicao }]] = await conn.query(
      `SELECT COUNT(*) AS posicao FROM senhas
       WHERE unidade_id = ? AND setor_id = ? AND status = 'aguardando' AND criado_em >= CURDATE() AND id <= ?`,
      [unidadeId, setorId, senha.id]);
    senha.posicao = Number(posicao);

    await conn.commit();
    return senha;
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

// Decide se a próxima chamada deve preferir prioritário (PRIORIDADE_A_CADA)
async function tipoPreferido(unidadeId) {
  if (prioridadeACada <= 0) return 'prioritario';
  const [ultimas] = await db.query(
    `SELECT tipo FROM senhas
     WHERE unidade_id = ? AND chamado_em >= CURDATE()
     ORDER BY chamado_em DESC, id DESC LIMIT ?`,
    [unidadeId, prioridadeACada]);
  const houvePrioritario = ultimas.some(s => s.tipo === 'prioritario');
  return (ultimas.length >= prioridadeACada && !houvePrioritario) || ultimas.length === 0
    ? 'prioritario' : 'normal';
}

// Marca como chamada só se ainda estiver aguardando: impede dois atendentes com a mesma senha
async function marcarChamada(senhaId, unidadeId, localId, usuarioId) {
  const [r] = await db.query(
    `UPDATE senhas SET status = 'chamada', local_id = ?, usuario_id = ?, chamado_em = NOW(3)
     WHERE id = ? AND unidade_id = ? AND status = 'aguardando'`,
    [localId, usuarioId, senhaId, unidadeId]);
  return r.affectedRows === 1;
}

async function chamarProxima({ unidadeId, localId, usuarioId, setores }) {
  const preferido = await tipoPreferido(unidadeId);
  const filtroSetor = setores.length ? 'AND setor_id IN (?)' : '';
  for (let tentativa = 0; tentativa < 5; tentativa++) {
    const params = [unidadeId];
    if (setores.length) params.push(setores);
    params.push(preferido);
    const [[candidata]] = await db.query(
      `SELECT id FROM senhas
       WHERE unidade_id = ? AND status = 'aguardando' AND criado_em >= CURDATE() ${filtroSetor}
       ORDER BY (tipo = ?) DESC, criado_em ASC, id ASC LIMIT 1`, params);
    if (!candidata) return null;
    if (await marcarChamada(candidata.id, unidadeId, localId, usuarioId)) {
      return buscarSenha(candidata.id);
    }
    // outro atendente pegou essa senha no mesmo instante: tenta a próxima
  }
  throw erro(409, 'Fila muito disputada, tente novamente');
}

function emitirChamada(io, senha, extra = {}) {
  const sala = `unidade:${senha.unidade_id}`;
  io.to(sala).emit('senha:chamada', {
    id: senha.id, codigo: senha.codigo, prefixo: senha.prefixo, numero: senha.numero,
    tipo: senha.tipo, setor_id: senha.setor_id, setor_nome: senha.setor_nome, local_nome: senha.local_nome,
    chamado_em: senha.chamado_em, ...extra,
  });
  io.to(sala).emit('fila:atualizada');
}

module.exports = { SELECT_SENHA, buscarSenha, criarSenha, montarEscPos, chamarProxima, marcarChamada, emitirChamada };
