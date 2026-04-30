const router = require('express').Router();
const db = require('../models/db');
const { auth } = require('../middleware/auth');

router.get('/resumo', auth, async (req, res) => {
  const { unidade_id, data_ini, data_fim } = req.query;
  const [rows] = await db.query(`
    SELECT
      st.nome as setor,
      COUNT(*) as total,
      SUM(s.tipo='prioritario') as prioritarios,
      SUM(s.status='concluido') as concluidos,
      SUM(s.status='cancelado') as cancelados,
      AVG(TIMESTAMPDIFF(SECOND, s.criado_em, s.chamado_em)) as tempo_espera_seg,
      AVG(TIMESTAMPDIFF(SECOND, s.chamado_em, s.concluido_em)) as tempo_atend_seg
    FROM senhas s
    JOIN setores st ON st.id=s.setor_id
    WHERE s.unidade_id=?
      AND DATE(s.criado_em) BETWEEN ? AND ?
    GROUP BY s.setor_id`, [unidade_id, data_ini, data_fim]
  );
  res.json(rows);
});

router.get('/por-hora', auth, async (req, res) => {
  const { unidade_id, data } = req.query;
  const [rows] = await db.query(`
    SELECT HOUR(criado_em) as hora, COUNT(*) as total
    FROM senhas WHERE unidade_id=? AND DATE(criado_em)=?
    GROUP BY hora ORDER BY hora`, [unidade_id, data]
  );
  res.json(rows);
});

module.exports = router;
