const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const db = require('../models/db');
const { limiteSenhasPorMinuto } = require('../config');
const { auth, perfil, unidadeDaRequisicao, garantirUnidade } = require('../middleware/auth');
const { erro, inteiroPositivo } = require('../lib/http');
const svc = require('../services/senhas');

const ATENDEM = ['atendente', 'medico', 'admin_unidade'];

const limiteTotem = rateLimit({
  windowMs: 60 * 1000,
  limit: limiteSenhasPorMinuto,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { erro: 'Muitas senhas geradas em pouco tempo. Aguarde um instante.' },
});

function listaSetores(valor) {
  if (valor === undefined || valor === null || valor === '') return [];
  const lista = Array.isArray(valor) ? valor : String(valor).split(',');
  return lista.map(v => inteiroPositivo(v, 'setor')).slice(0, 50);
}

async function senhaDaUnidade(req) {
  const senha = await svc.buscarSenha(inteiroPositivo(req.params.id, 'id'));
  if (!senha) throw erro(404, 'Senha não encontrada');
  garantirUnidade(req, senha.unidade_id);
  return senha;
}

async function localDaUnidade(localId, unidadeId) {
  const id = inteiroPositivo(localId, 'local_id');
  const [[local]] = await db.query('SELECT id FROM locais WHERE id = ? AND unidade_id = ? AND ativo = 1', [id, unidadeId]);
  if (!local) throw erro(400, 'Local inválido para esta unidade');
  return id;
}

// POST /api/senhas — gerar nova senha (totem). Público, com limite por IP.
router.post('/', limiteTotem, async (req, res) => {
  const senha = await svc.criarSenha(req.body || {});
  req.io.to(`unidade:${senha.unidade_id}`).emit('senha:criada', senha);
  res.status(201).json({ senha, escpos: svc.montarEscPos(senha) });
});

// GET /api/senhas/fila?unidade_id=1&setores=1,2
router.get('/fila', auth, async (req, res) => {
  const unidadeId = unidadeDaRequisicao(req, req.query.unidade_id);
  const setores = listaSetores(req.query.setores);
  const params = [unidadeId];
  let filtro = '';
  if (setores.length) { filtro = 'AND s.setor_id IN (?)'; params.push(setores); }
  const [fila] = await db.query(`${svc.SELECT_SENHA}
    WHERE s.unidade_id = ? AND s.status IN ('aguardando','chamada','atendimento')
      AND s.criado_em >= CURDATE() ${filtro}
    ORDER BY s.tipo DESC, s.criado_em ASC, s.id ASC`, params);
  res.json(fila);
});

// GET /api/senhas/atual — senha em andamento do usuário logado (sobrevive a reload)
router.get('/atual', auth, async (req, res) => {
  const [[senha]] = await db.query(`${svc.SELECT_SENHA}
    WHERE s.usuario_id = ? AND s.status IN ('chamada','atendimento') AND s.criado_em >= CURDATE()
    ORDER BY s.chamado_em DESC LIMIT 1`, [req.usuario.id]);
  res.json(senha || null);
});

// GET /api/senhas/finalizadas?busca=AC003 — concluídas/canceladas de hoje (aba "Finalizados")
router.get('/finalizadas', auth, perfil(...ATENDEM), async (req, res) => {
  const unidadeId = unidadeDaRequisicao(req, req.query.unidade_id);
  const busca = String(req.query.busca || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);
  const params = [unidadeId];
  let filtro = '';
  if (busca) { filtro = 'AND s.codigo LIKE ?'; params.push(`%${busca}%`); }
  const [rows] = await db.query(`${svc.SELECT_SENHA}
    WHERE s.unidade_id = ? AND s.status IN ('concluido','cancelado') AND s.criado_em >= CURDATE() ${filtro}
    ORDER BY COALESCE(s.concluido_em, s.chamado_em, s.criado_em) DESC, s.id DESC
    LIMIT 100`, params);
  res.json(rows);
});

// POST /api/senhas/proxima — o servidor escolhe a próxima senha { local_id, setores: [ids] }
router.post('/proxima', auth, perfil(...ATENDEM), async (req, res) => {
  const unidadeId = unidadeDaRequisicao(req, req.body?.unidade_id);
  const localId = await localDaUnidade(req.body?.local_id, unidadeId);
  const senha = await svc.chamarProxima({
    unidadeId, localId, usuarioId: req.usuario.id, setores: listaSetores(req.body?.setores),
  });
  if (!senha) return res.status(404).json({ erro: 'Nenhuma senha aguardando' });
  svc.emitirChamada(req.io, senha);
  res.json(senha);
});

// POST /api/senhas/:id/chamar — chamar uma senha específica da fila
router.post('/:id/chamar', auth, perfil(...ATENDEM), async (req, res) => {
  const atual = await senhaDaUnidade(req);
  if (['chamada', 'atendimento'].includes(atual.status) && atual.usuario_id === req.usuario.id) {
    svc.emitirChamada(req.io, atual, { rechamada: true });   // rechamada pela tela antiga
    return res.json(atual);
  }
  const localId = await localDaUnidade(req.body?.local_id, atual.unidade_id);
  const ok = await svc.marcarChamada(atual.id, atual.unidade_id, localId, req.usuario.id);
  if (!ok) throw erro(409, `Senha ${atual.codigo} já foi chamada ou não está mais aguardando`);
  const senha = await svc.buscarSenha(atual.id);
  svc.emitirChamada(req.io, senha);
  res.json(senha);
});

// POST /api/senhas/:id/rechamar — repete o anúncio no painel sem mudar o status
router.post('/:id/rechamar', auth, perfil(...ATENDEM), async (req, res) => {
  const senha = await senhaDaUnidade(req);
  if (!['chamada', 'atendimento'].includes(senha.status)) throw erro(409, 'Senha não está em chamada');
  svc.emitirChamada(req.io, senha, { rechamada: true });
  res.json(senha);
});

// POST /api/senhas/:id/chamar-novamente { local_id }
// Chama de volta uma senha já finalizada hoje (ex.: o paciente precisa voltar à recepção).
// Só anuncia no painel, no local de quem chamou: não reabre o atendimento nem altera os tempos dos relatórios.
router.post('/:id/chamar-novamente', auth, perfil(...ATENDEM), async (req, res) => {
  const senha = await senhaDaUnidade(req);
  if (!['concluido', 'cancelado'].includes(senha.status)) {
    throw erro(409, `A senha ${senha.codigo} ainda está em andamento: use "Rechamar"`);
  }
  const [[deHoje]] = await db.query('SELECT id FROM senhas WHERE id = ? AND criado_em >= CURDATE()', [senha.id]);
  if (!deHoje) throw erro(409, 'Só é possível chamar de novo senhas de hoje');
  const localId = await localDaUnidade(req.body?.local_id, senha.unidade_id);
  const [[local]] = await db.query('SELECT nome FROM locais WHERE id = ?', [localId]);
  svc.emitirChamada(req.io, { ...senha, local_nome: local.nome }, { retorno: true });
  console.log(`[retorno] ${senha.codigo} chamada novamente para ${local.nome} por ${req.usuario.login}`);
  res.json({ ok: true, codigo: senha.codigo, local_nome: local.nome });
});

async function mudarStatus(req, novo, permitidos, extraSet = '') {
  const senha = await senhaDaUnidade(req);
  const [r] = await db.query(
    `UPDATE senhas SET status = ? ${extraSet} WHERE id = ? AND status IN (?)`,
    [novo, senha.id, permitidos]);
  if (!r.affectedRows) throw erro(409, `Não é possível passar a senha ${senha.codigo} de "${senha.status}" para "${novo}"`);
  req.io.to(`unidade:${senha.unidade_id}`).emit('fila:atualizada');
  return svc.buscarSenha(senha.id);
}

router.post('/:id/atender', auth, perfil(...ATENDEM), async (req, res) => {
  res.json(await mudarStatus(req, 'atendimento', ['chamada']));
});

router.post('/:id/concluir', auth, perfil(...ATENDEM), async (req, res) => {
  res.json(await mudarStatus(req, 'concluido', ['chamada', 'atendimento'], ', concluido_em = NOW()'));
});

router.post('/:id/cancelar', auth, perfil(...ATENDEM), async (req, res) => {
  res.json(await mudarStatus(req, 'cancelado', ['aguardando', 'chamada', 'atendimento']));
});

module.exports = router;
