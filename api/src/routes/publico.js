// Rotas sem login, usadas pelo totem e pelo painel de TV. Somente leitura.
const router = require('express').Router();
const db = require('../models/db');
const { erro, inteiroPositivo } = require('../lib/http');

router.get('/unidades/:id', async (req, res) => {
  const [[u]] = await db.query('SELECT id, nome FROM unidades WHERE id = ? AND ativo = 1',
    [inteiroPositivo(req.params.id, 'id')]);
  if (!u) throw erro(404, 'Unidade não encontrada');
  res.json(u);
});

router.get('/setores', async (req, res) => {
  const unidadeId = inteiroPositivo(req.query.unidade_id, 'unidade_id');
  const [rows] = await db.query(
    'SELECT id, nome, prefixo FROM setores WHERE unidade_id = ? AND ativo = 1 ORDER BY ordem, nome', [unidadeId]);
  res.json(rows);
});

// Últimas chamadas do dia: o painel usa ao abrir e ao reconectar
router.get('/chamadas', async (req, res) => {
  const unidadeId = inteiroPositivo(req.query.unidade_id, 'unidade_id');
  const limite = Math.min(Number(req.query.limite) || 8, 20);
  const [rows] = await db.query(`
    SELECT s.id, s.codigo, s.prefixo, s.numero, s.tipo, s.chamado_em, st.nome AS setor_nome, l.nome AS local_nome
    FROM senhas s
    JOIN setores st ON st.id = s.setor_id
    LEFT JOIN locais l ON l.id = s.local_id
    WHERE s.unidade_id = ? AND s.chamado_em >= CURDATE()
    ORDER BY s.chamado_em DESC, s.id DESC LIMIT ?`, [unidadeId, limite]);
  res.json(rows);
});

module.exports = router;
