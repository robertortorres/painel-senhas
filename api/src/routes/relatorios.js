const router = require('express').Router();
const db = require('../models/db');
const { auth, perfil, unidadeDaRequisicao } = require('../middleware/auth');
const { dataISO, inteiroPositivo } = require('../lib/http');

// Quem pode ver relatórios (admin_global sempre pode)
const VEEM = ['relatorios', 'admin_unidade'];

const MEDIA_ESPERA = 'ROUND(AVG(CASE WHEN s.chamado_em IS NOT NULL THEN TIMESTAMPDIFF(SECOND, s.criado_em, s.chamado_em) END))';
const MEDIA_ATEND = "ROUND(AVG(CASE WHEN s.status = 'concluido' AND s.chamado_em IS NOT NULL THEN TIMESTAMPDIFF(SECOND, s.chamado_em, s.concluido_em) END))";
const conta = cond => `CAST(SUM(${cond}) AS UNSIGNED)`;

router.get('/dashboard', auth, perfil(...VEEM), async (req, res) => {
  const q = req.query;
  const unidadeId = unidadeDaRequisicao(req, q.unidade_id);
  const ini = dataISO(q.data_ini, 'data_ini');
  const fim = dataISO(q.data_fim, 'data_fim');

  // Intervalo sobre criado_em (usa índice) em vez de DATE(criado_em)
  const filtros = ['s.unidade_id = ?', 's.criado_em >= ?', 's.criado_em < DATE_ADD(?, INTERVAL 1 DAY)'];
  const params = [unidadeId, ini, fim];
  if (q.usuario_id) { filtros.push('s.usuario_id = ?'); params.push(inteiroPositivo(q.usuario_id, 'usuario_id')); }
  if (q.local_id) { filtros.push('s.local_id = ?'); params.push(inteiroPositivo(q.local_id, 'local_id')); }
  if (q.setor_id) { filtros.push('s.setor_id = ?'); params.push(inteiroPositivo(q.setor_id, 'setor_id')); }
  const WHERE = filtros.join(' AND ');

  const [[totais]] = await db.query(`
    SELECT COUNT(*) AS total,
      ${conta("s.status = 'concluido'")} AS concluidos,
      ${conta("s.status = 'cancelado'")} AS cancelados,
      ${conta("s.tipo = 'prioritario'")} AS prioritarios,
      ${MEDIA_ESPERA} AS avg_espera_seg,
      ${MEDIA_ATEND} AS avg_atend_seg
    FROM senhas s WHERE ${WHERE}`, params);

  const [por_setor] = await db.query(`
    SELECT st.nome AS setor, st.prefixo, COUNT(*) AS total,
      ${conta("s.status = 'concluido'")} AS concluidos,
      ${conta("s.status = 'cancelado'")} AS cancelados,
      ${conta("s.tipo = 'prioritario'")} AS prioritarios,
      ${MEDIA_ESPERA} AS avg_espera_seg,
      ${MEDIA_ATEND} AS avg_atend_seg
    FROM senhas s JOIN setores st ON st.id = s.setor_id
    WHERE ${WHERE} GROUP BY s.setor_id, st.nome, st.prefixo ORDER BY total DESC`, params);

  const [por_hora] = await db.query(`
    SELECT HOUR(s.criado_em) AS hora, COUNT(*) AS total
    FROM senhas s WHERE ${WHERE} GROUP BY hora ORDER BY hora`, params);

  const [por_dia] = await db.query(`
    SELECT DATE_FORMAT(s.criado_em, '%Y-%m-%d') AS dia, COUNT(*) AS total,
      ${conta("s.status = 'concluido'")} AS concluidos,
      ${conta("s.status = 'cancelado'")} AS cancelados
    FROM senhas s WHERE ${WHERE} GROUP BY dia ORDER BY dia`, params);

  const [por_atendente] = await db.query(`
    SELECT u.nome AS atendente, u.id AS usuario_id, COUNT(*) AS total_chamadas,
      ${conta("s.status = 'concluido'")} AS concluidos,
      ${MEDIA_ATEND} AS avg_atend_seg
    FROM senhas s JOIN usuarios u ON u.id = s.usuario_id
    WHERE ${WHERE} AND s.usuario_id IS NOT NULL
    GROUP BY s.usuario_id, u.nome ORDER BY total_chamadas DESC`, params);

  const [por_local] = await db.query(`
    SELECT COALESCE(l.nome, 'Sem local') AS local_nome, COUNT(*) AS total,
      ${conta("s.status = 'concluido'")} AS concluidos,
      ${MEDIA_ATEND} AS avg_atend_seg
    FROM senhas s LEFT JOIN locais l ON l.id = s.local_id
    WHERE ${WHERE} GROUP BY s.local_id, l.nome ORDER BY total DESC`, params);

  res.json({ totais, por_setor, por_hora, por_dia, por_atendente, por_local });
});

// Listas para os filtros
router.get('/filtros', auth, perfil(...VEEM), async (req, res) => {
  const unidadeId = unidadeDaRequisicao(req, req.query.unidade_id);
  const [usuarios] = await db.query('SELECT id, nome FROM usuarios WHERE unidade_id = ? AND ativo = 1 ORDER BY nome', [unidadeId]);
  const [locais] = await db.query('SELECT id, nome FROM locais WHERE unidade_id = ? AND ativo = 1 ORDER BY nome', [unidadeId]);
  const [setores] = await db.query('SELECT id, nome, prefixo FROM setores WHERE unidade_id = ? AND ativo = 1 ORDER BY ordem', [unidadeId]);
  res.json({ usuarios, locais, setores });
});

module.exports = router;
