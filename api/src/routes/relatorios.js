const router = require('express').Router();
const db = require('../models/db');
const { auth, perfil, unidadeDaRequisicao } = require('../middleware/auth');
const { dataISO } = require('../lib/http');

router.get('/dashboard', auth, async (req, res) => {
  const { unidade_id, data_ini, data_fim, usuario_id, local_id, setor_id } = req.query;
  try {
    const filtros = ['s.unidade_id=?', 'DATE(s.criado_em) BETWEEN ? AND ?'];
    const params  = [unidade_id, data_ini, data_fim];
    if (usuario_id) { filtros.push('s.usuario_id=?'); params.push(usuario_id); }
    if (local_id)   { filtros.push('s.local_id=?');   params.push(local_id); }
    if (setor_id)   { filtros.push('s.setor_id=?');   params.push(setor_id); }
    const WHERE = filtros.join(' AND ');

    const [[totais]] = await db.query(`
      SELECT
        COUNT(*) as total,
        SUM(status='concluido') as concluidos,
        SUM(status='cancelado') as cancelados,
        SUM(tipo='prioritario') as prioritarios,
        AVG(CASE WHEN chamado_em IS NOT NULL THEN TIMESTAMPDIFF(SECOND,criado_em,chamado_em) END) as avg_espera_seg,
        AVG(CASE WHEN concluido_em IS NOT NULL AND chamado_em IS NOT NULL THEN TIMESTAMPDIFF(SECOND,chamado_em,concluido_em) END) as avg_atend_seg
      FROM senhas s WHERE ${WHERE}`, params);

    const [por_setor] = await db.query(`
      SELECT st.nome as setor, st.prefixo,
        COUNT(*) as total,
        SUM(s.status='concluido') as concluidos,
        SUM(s.status='cancelado') as cancelados,
        SUM(s.tipo='prioritario') as prioritarios,
        AVG(CASE WHEN s.chamado_em IS NOT NULL THEN TIMESTAMPDIFF(SECOND,s.criado_em,s.chamado_em) END) as avg_espera_seg,
        AVG(CASE WHEN s.concluido_em IS NOT NULL AND s.chamado_em IS NOT NULL THEN TIMESTAMPDIFF(SECOND,s.chamado_em,s.concluido_em) END) as avg_atend_seg
      FROM senhas s JOIN setores st ON st.id=s.setor_id
      WHERE ${WHERE} GROUP BY s.setor_id ORDER BY total DESC`, params);

    const [por_hora] = await db.query(`
      SELECT HOUR(s.criado_em) as hora, COUNT(*) as total
      FROM senhas s WHERE ${WHERE}
      GROUP BY hora ORDER BY hora`, params);

    const [por_dia] = await db.query(`
      SELECT DATE(s.criado_em) as dia, COUNT(*) as total,
        SUM(s.status='concluido') as concluidos,
        SUM(s.status='cancelado') as cancelados
      FROM senhas s WHERE ${WHERE}
      GROUP BY dia ORDER BY dia`, params);

    const [por_atendente] = await db.query(`
      SELECT u.nome as atendente, u.id as usuario_id,
        COUNT(*) as total_chamadas,
        SUM(s.status='concluido') as concluidos,
        AVG(CASE WHEN s.concluido_em IS NOT NULL AND s.chamado_em IS NOT NULL THEN TIMESTAMPDIFF(SECOND,s.chamado_em,s.concluido_em) END) as avg_atend_seg
      FROM senhas s JOIN usuarios u ON u.id=s.usuario_id
      WHERE ${WHERE} AND s.usuario_id IS NOT NULL
      GROUP BY s.usuario_id ORDER BY total_chamadas DESC`, params);

    const [por_local] = await db.query(`
      SELECT COALESCE(l.nome,'Sem local') as local_nome, COUNT(*) as total,
        SUM(s.status='concluido') as concluidos,
        AVG(CASE WHEN s.concluido_em IS NOT NULL AND s.chamado_em IS NOT NULL THEN TIMESTAMPDIFF(SECOND,s.chamado_em,s.concluido_em) END) as avg_atend_seg
      FROM senhas s LEFT JOIN locais l ON l.id=s.local_id
      WHERE ${WHERE} GROUP BY s.local_id ORDER BY total DESC`, params);

    res.json({ totais, por_setor, por_hora, por_dia, por_atendente, por_local });
  } catch(e) { res.status(500).json({ erro: e.message }); }
});

// Listas para os filtros
router.get('/filtros', auth, async (req, res) => {
  const { unidade_id } = req.query;
  const [usuarios] = await db.query(
    "SELECT id, nome FROM usuarios WHERE unidade_id=? AND ativo=1 ORDER BY nome", [unidade_id]);
  const [locais] = await db.query(
    "SELECT id, nome FROM locais WHERE unidade_id=? AND ativo=1 ORDER BY nome", [unidade_id]);
  const [setores] = await db.query(
    "SELECT id, nome, prefixo FROM setores WHERE unidade_id=? AND ativo=1 ORDER BY ordem", [unidade_id]);
  res.json({ usuarios, locais, setores });
});

module.exports = router;
