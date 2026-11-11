class HttpError extends Error {
  constructor(status, mensagem) {
    super(mensagem);
    this.status = status;
  }
}

const erro = (status, mensagem) => new HttpError(status, mensagem);

function inteiroPositivo(valor, nome) {
  const n = Number(valor);
  if (!Number.isInteger(n) || n <= 0) throw erro(400, `${nome} inválido`);
  return n;
}

function texto(valor, nome, { min = 1, max = 100, padrao } = {}) {
  if (valor === undefined || valor === null) {
    if (padrao !== undefined) return padrao;
    throw erro(400, `${nome} obrigatório`);
  }
  const s = String(valor).trim();
  if (s.length < min || s.length > max) throw erro(400, `${nome} deve ter entre ${min} e ${max} caracteres`);
  return s;
}

// Para PUT parcial: undefined vira null (o SQL usa COALESCE para manter o valor atual)
const opcional = v => (v === undefined || v === '' ? null : v);

const booleano = v => (v === undefined || v === null ? null : (v === true || v === 1 || v === '1' || v === 'true') ? 1 : 0);

function dataISO(valor, nome) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(valor || ''))) throw erro(400, `${nome} deve estar no formato AAAA-MM-DD`);
  return valor;
}

function errorHandler(err, _req, res, _next) {
  if (err instanceof HttpError) return res.status(err.status).json({ erro: err.message });
  if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ erro: 'Registro duplicado' });
  if (err.code === 'ER_NO_REFERENCED_ROW_2') return res.status(400).json({ erro: 'Referência inválida' });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ erro: 'JSON inválido' });
  console.error(err);
  res.status(500).json({ erro: 'Erro interno' });
}

module.exports = { HttpError, erro, inteiroPositivo, texto, opcional, booleano, dataISO, errorHandler };
