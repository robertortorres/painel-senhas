module.exports = function setupSocket(io) {
  io.on('connection', socket => {
    // Dispositivo (painel, totem, atendente) entra na sala da unidade
    socket.on('join:unidade', ({ unidade_id }) => {
      socket.join(`unidade:${unidade_id}`);
    });

    socket.on('disconnect', () => {});
  });
};
