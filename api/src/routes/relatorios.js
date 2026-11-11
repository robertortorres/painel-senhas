const router = require('express').Router();
const db = require('../models/db');
const { auth, perfil, unidadeDaRequisicao } = require('../middleware/auth');
const { dataISO } = require('../lib/http');

const VEEM = ['relatorios', 'admin_unidade'];

router.get('/resumo', auth, perfil(...VEEM), async (req, res) => {
  const unidadeId = unidadeDaRequisicao(req, req.query.unidade_id);
  const ini = dataISO(req.query.data_ini, 'data_ini');
  const fim = dataISO(req.query.data_fim, 'data_fim');
  const [rows] = await db.query(`
    SELECT
      st.nome AS setor,
      COUNT(*) AS total,
      CAST(SUM(s.tipo = 'prioritario') AS UNSIGNED) AS prioritarios,
      CAST(SUM(s.status = 'concluido') AS UNSIGNED) AS concluidos,
      CAST(SUM(s.status = 'cancelado') AS UNSIGNED) AS cancelados,
      ROUND(AVG(TIMESTAMPDIFF(SECOND, s.criado_em, s.chamado_em))) AS tempo_espera_seg,
      ROUND(AVG(CASE WHEN s.status = 'concluido' THEN TIMESTAMPDIFF(SECOND, s.chamado_em, s.concluido_em) END)) AS tempo_atend_seg
    FROM senhas s
    JOIN setores st ON st.id = s.setor_id
    WHERE s.unidade_id = ? AND s.criado_em >= ? AND s.criado_em < DATE_ADD(?, INTERVAL 1 DAY)
    GROUP BY s.setor_id, st.nome
    ORDER BY st.nome`, [unidadeId, ini, fim]);
  res.json(rows);
});

router.get('/por-hora', auth, perfil(...VEEM), async (req, res) => {
  const unidadeId = unidadeDaRequisicao(req, req.query.unidade_id);
  const data = dataISO(req.query.data, 'data');
  const [rows] = await db.query(`
    SELECT HOUR(criado_em) AS hora, COUNT(*) AS total
    FROM senhas
    WHERE unidade_id = ? AND criado_em >= ? AND criado_em < DATE_ADD(?, INTERVAL 1 DAY)
    GROUP BY hora ORDER BY hora`, [unidadeId, data, data]);
  res.json(rows);
});

module.exports = router;
