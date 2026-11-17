export const PLANNED_PRODUCTION_ORIGIN = 'https://derma-sense.onrender.com';

export function normalizeOrigin(value) {
  if (!value || typeof value !== 'string') return null;
  const trimmed = value.trim().replace(/\/+$/, '');
  if (!trimmed || trimmed === 'MY_APP_URL') return null;
  try {
    const parsed = new URL(trimmed);
    return parsed.origin;
  } catch {
    return null;
  }
}

export function getAllowedOrigins() {
  const allowed = new Set([PLANNED_PRODUCTION_ORIGIN]);

  const candidates = [
    process.env.APP_URL,
    process.env.RENDER_EXTERNAL_URL,
    ...(process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : []),
  ];

  for (const candidate of candidates) {
    const normalized = normalizeOrigin(candidate);
    if (normalized) {
      allowed.add(normalized);
    }
  }

  return allowed;
}

export function buildCorsOptions(isProd = process.env.NODE_ENV === 'production') {
  if (!isProd) {
    return {
      origin: true,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    };
  }

  const allowedOrigins = getAllowedOrigins();

  return {
    origin(origin, callback) {
      // Allow same-origin navigation / non-browser requests without an Origin header
      if (!origin) return callback(null, true);
      const normalized = normalizeOrigin(origin);
      if (normalized && allowedOrigins.has(normalized)) {
        return callback(null, true);
      }
      return callback(null, false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  };
}
