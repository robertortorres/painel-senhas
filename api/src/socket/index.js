module.exports = function setupSocket(io) {
  io.on('connection', socket => {
    // Painel, atendimento: entram na sala da unidade (e saem de qualquer outra)
    socket.on('join:unidade', (dados = {}) => {
      const id = Number(dados.unidade_id);
      if (!Number.isInteger(id) || id <= 0) return;
      for (const sala of socket.rooms) {
        if (sala.startsWith('unidade:')) socket.leave(sala);
      }
      socket.join(`unidade:${id}`);
    });
  });
};
