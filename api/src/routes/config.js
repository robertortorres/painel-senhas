// Configurações visuais e de impressão por unidade (painel TV, totem)
const router = require('express').Router();
const db = require('../models/db');
const { auth, perfil, unidadeDaRequisicao } = require('../middleware/auth');
const { erro, inteiroPositivo, texto } = require('../lib/http');

const PAPEIS = ['58mm', '80mm'];
const IMPRESSOES = ['dialogo', 'botao', 'sem'];
const TEMAS = ['escuro', 'claro', 'azul', 'verde'];
const FUNDOS = ['cor', 'imagem', 'video'];
const LAYOUTS = ['horizontal', 'vertical'];
const VOZES = ['sigla', 'numero', 'codigo', 'setor', 'local'];
const LOGO_MAX = 2 * 1024 * 1024; // ~1,5 MB de imagem em base64

const umDe = (lista, v, nome) => {
  if (v === undefined || v === null) return null;
  if (!lista.includes(v)) throw erro(400, `${nome} inválido`);
  return v;
};

// O painel usa o valor dentro de url(...) e em <video src>: só aceitamos formatos seguros
function fundoValido(tipo, valor) {
  if (valor === undefined || valor === null || valor === '') return null;
  const v = String(valor).trim();
  if (tipo === 'cor') {
    if (!/^#[0-9a-fA-F]{3,8}$/.test(v)) throw erro(400, 'Cor de fundo inválida (use #RRGGBB)');
    return v;
  }
  if (!/^(https?:\/\/|data:(image|video)\/)[^\s"'()<>\\]+$/.test(v) || v.length > 2000) {
    throw erro(400, 'URL de fundo inválida');
  }
  return v;
}

function logoValida(v) {
  if (v === undefined) return undefined;          // não mexe
  if (v === null || v === '') return null;        // remove
  const s = String(v);
  if (!/^data:image\/(png|jpe?g|gif|webp|svg\+xml);base64,[A-Za-z0-9+/=]+$/.test(s)) throw erro(400, 'Logo inválida');
  if (s.length > LOGO_MAX) throw erro(413, 'Logo muito grande (máx. ~1,5 MB)');
  return s;
}

function vozValida(v) {
  if (v === undefined || v === null) return null;
  const itens = String(v).split(',').map(s => s.trim()).filter(Boolean);
  if (itens.some(i => !VOZES.includes(i))) throw erro(400, 'Opções de voz inválidas');
  return itens.join(',');
}

// GET /api/config?unidade_id=1 — público (painel e totem leem sem login)
router.get('/', async (req, res) => {
  const unidadeId = inteiroPositivo(req.query.unidade_id, 'unidade_id');
  const [[cfg]] = await db.query('SELECT * FROM configuracoes WHERE unidade_id = ? LIMIT 1', [unidadeId]);
  res.json(cfg || null);
});

// POST /api/config — só administradores da unidade. Campos ausentes mantêm o valor atual.
router.post('/', auth, perfil('admin_unidade'), async (req, res) => {
  const b = req.body || {};
  const unidadeId = unidadeDaRequisicao(req, b.unidade_id);
  const fundoTipo = umDe(FUNDOS, b.fundo_tipo, 'fundo_tipo');
  const [[atual]] = await db.query('SELECT fundo_tipo FROM configuracoes WHERE unidade_id = ?', [unidadeId]);
  const logo = logoValida(b.logo_base64);

  await db.query('INSERT IGNORE INTO configuracoes (unidade_id) VALUES (?)', [unidadeId]);
  await db.query(`
    UPDATE configuracoes SET
      clinica_nome  = COALESCE(?, clinica_nome),
      papel         = COALESCE(?, papel),
      impressao     = COALESCE(?, impressao),
      tema          = COALESCE(?, tema),
      fundo_tipo    = COALESCE(?, fundo_tipo),
      fundo_valor   = COALESCE(?, fundo_valor),
      clima_cidade  = COALESCE(?, clima_cidade),
      painel_layout = COALESCE(?, painel_layout),
      voz_opcoes    = COALESCE(?, voz_opcoes)
      ${logo === undefined ? '' : ', logo_base64 = ?'}
    WHERE unidade_id = ?`,
    [
      b.clinica_nome === undefined ? null : texto(b.clinica_nome, 'clinica_nome', { max: 100 }),
      umDe(PAPEIS, b.papel, 'papel'),
      umDe(IMPRESSOES, b.impressao, 'impressao'),
      umDe(TEMAS, b.tema, 'tema'),
      fundoTipo,
      fundoValido(fundoTipo || atual?.fundo_tipo || 'cor', b.fundo_valor),
      b.clima_cidade === undefined ? null : texto(b.clima_cidade, 'clima_cidade', { max: 100 }),
      umDe(LAYOUTS, b.painel_layout, 'painel_layout'),
      vozValida(b.voz_opcoes),
      ...(logo === undefined ? [] : [logo]),
      unidadeId,
    ]);
  res.json({ ok: true });
});

module.exports = router;
