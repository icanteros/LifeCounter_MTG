/**
 * @file Servidor principal
 * @description Punto de entrada para el servidor de LifeCounter MTG
 */

const { startServer } = require('./src/index');

// Inicia el servidor
startServer().catch((err) => {
  console.error('Error al iniciar el servidor:', err);
  process.exit(1);
});

module.exports = { startServer };
