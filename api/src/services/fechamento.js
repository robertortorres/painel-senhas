// Fechamento diário: senhas que sobraram de dias anteriores ganham um status final,
// para os relatórios não ficarem com senhas "aguardando" para sempre.
// Roda ao iniciar a API e a cada 10 minutos (pega a virada do dia mesmo se o servidor
// estava desligado à meia-noite). É idempotente: só mexe no que ainda está em aberto.
const db = require('../models/db');
const { fechamentoDiario } = require('../config');

const INTERVALO_MS = 10 * 60 * 1000;

async function fecharDiasAnteriores() {
  // Emitida ou chamada e nunca concluída: o paciente não compareceu
  const [faltas] = await db.query(
    `UPDATE senhas SET status = 'nao_compareceu'
     WHERE status IN ('aguardando', 'chamada') AND criado_em < CURDATE()`);
  // Ficou "em atendimento": foi atendido, só não clicaram em Concluir.
  // concluido_em fica vazio para não distorcer o tempo médio de atendimento.
  const [esquecidas] = await db.query(
    `UPDATE senhas SET status = 'concluido'
     WHERE status = 'atendimento' AND criado_em < CURDATE()`);
  if (faltas.affectedRows || esquecidas.affectedRows) {
    console.log(`[fechamento] ${faltas.affectedRows} marcada(s) como não compareceu, `
      + `${esquecidas.affectedRows} em atendimento marcada(s) como concluída(s)`);
  }
}

function agendarFechamento() {
  if (!fechamentoDiario) {
    console.log('[fechamento] desligado (FECHAMENTO_DIARIO=0)');
    return;
  }
  const rodar = () => fecharDiasAnteriores().catch(e => console.error('[fechamento] erro:', e.message));
  rodar();
  setInterval(rodar, INTERVALO_MS).unref();
}

module.exports = { agendarFechamento, fecharDiasAnteriores };
