const router = require('express').Router();
const db = require('../models/db');
const { auth } = require('../middleware/auth');

router.get('/', async (req, res) => {
  const { unidade_id } = req.query;
  try {
    const [rows] = await db.query(
      'SELECT * FROM configuracoes WHERE unidade_id=? LIMIT 1', [unidade_id]);
    res.json(rows[0] || null);
  } catch(e) { res.status(500).json({ erro: e.message }); }
});

router.post('/', auth, async (req, res) => {
  const { unidade_id, clinica_nome, papel, impressao,
          logo_base64, tema, fundo_tipo, fundo_valor,
          clima_cidade, painel_layout, voz_opcoes } = req.body;
  await db.query(`
    INSERT INTO configuracoes
      (unidade_id, clinica_nome, papel, impressao, logo_base64, tema, fundo_tipo, fundo_valor, clima_cidade, painel_layout, voz_opcoes)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)
    ON DUPLICATE KEY UPDATE
      clinica_nome=VALUES(clinica_nome), papel=VALUES(papel), impressao=VALUES(impressao),
      logo_base64=VALUES(logo_base64), tema=VALUES(tema), fundo_tipo=VALUES(fundo_tipo),
      fundo_valor=VALUES(fundo_valor), clima_cidade=VALUES(clima_cidade), painel_layout=VALUES(painel_layout), voz_opcoes=VALUES(voz_opcoes)
  `, [unidade_id, clinica_nome, papel, impressao,
      logo_base64||null, tema||'escuro', fundo_tipo||'cor',
      fundo_valor||null, clima_cidade||'São Paulo', painel_layout||'horizontal', voz_opcoes||'codigo,setor,local']);
  res.json({ ok: true });
});

module.exports = router;
