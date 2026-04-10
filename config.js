// Game Configuration Constants
module.exports = {
    // Game settings
    STARTING_LIFE: 40,
    MIN_LIFE: -999,
    MAX_LIFE: 999,
    MAX_DELTA: 100,  // Maximum life change per event

    // Validation limits
    MAX_NAME_LENGTH: 20,
    MIN_NAME_LENGTH: 1,
    ROOM_CODE_LENGTH: 5,
    ROOM_CODE_CHARS: 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789',

    // Thresholds
    COMMANDER_DAMAGE_THRESHOLD: 21,
    POISON_CRITICAL_THRESHOLD: 10,
    POISON_MAX: 99,

    // Player limits
    MAX_PLAYERS: 4,
    MIN_PLAYERS: 1,

    // Timing (milliseconds)
    ROOM_CLEANUP_DELAY: 30 * 60 * 1000,  // 30 minutes
    RECONNECT_WINDOW: 5 * 60 * 1000,      // 5 minutes to reconnect

    // Rate limiting
    RATE_LIMIT_EVENTS: 10,    // events per window
    RATE_LIMIT_WINDOW: 1000,  // 1 second window
    RATE_LIMIT_CREATE_ROOM: 5, // creations per minute

    // Server
    DEFAULT_PORT: 3000,
    HEALTH_CHECK_PATH: '/health',
};
