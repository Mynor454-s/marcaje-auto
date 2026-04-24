// Configuración del marcaje automático
// Copia este archivo como config.js y llena tus datos
// NUNCA subas config.js al repositorio

export const config = {
  // Portal RRHH
  baseUrl: 'https://recursos.bi.com.gt/Evolution',

  // Contraseña (usar variable de entorno en producción)
  password: process.env.PORTAL_PASS || 'TU_PASSWORD_AQUI',

  // Array de usuarios a marcar
  usuarios: [
    // '12345', // Nombre Apellido
  ],

  // Tipo de marcaje
  tipoSeleccion: '1', // 1 = Presencial, 2 = Home Office

  // Tipos de marca
  tipoMarca: {
    ENTRADA: '1',
    INICIA_ALMUERZO: '2',
    FIN_ALMUERZO: '3',
    INICIA_VISITA: '4',
    FIN_VISITA: '5',
    SALIDA: '6',
  },

  // Rangos de hora para marcaje (se genera una hora aleatoria dentro del rango)
  horarios: {
    entrada: {
      horaInicio: { hora: 7, minuto: 0 },
      horaFin: { hora: 7, minuto: 30 },
    },
    salida: {
      horaInicio: { hora: 17, minuto: 35 },
      horaFin: { hora: 17, minuto: 45 },
    },
  },

  // Timezone
  timezone: 'America/Guatemala',
};
