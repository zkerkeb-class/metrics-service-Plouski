# ═══════════════════════════════════════════════════════════════
# VARIABLES GLOBALES PARTAGÉES
# ═══════════════════════════════════════════════════════════════
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
CLIENT_URL=http://localhost:3000
CORS_ORIGIN=http://localhost:3000

# JWT CONFIGURATION (OBLIGATOIRE - partagé par tous les services)
JWT_SECRET=roadTripTopSecret2024-super-secure-key
JWT_REFRESH_SECRET=roadTripRefreshSecret2024-ultra-secure
JWT_EXPIRES_IN=24h
JWT_REFRESH_EXPIRES_IN=7d

# DATABASE CONFIGURATION (OBLIGATOIRE)
MONGODB_URI=mongodb://localhost:27017/roadtrip-dev
MONGO_URI=mongodb://localhost:27017/roadtrip-dev

# ═══════════════════════════════════════════════════════════════
# METRICS SERVICE (Port 5006)
# ═══════════════════════════════════════════════════════════════
# Variables spécifiques à metrics-service

# Port et config
PORT=5006
SERVICE_NAME=metrics-service
METRICS_PORT=9006

# URLs de monitoring
PROMETHEUS_URL=http://localhost:9090
GRAFANA_URL=http://localhost:3000
GRAFANA_API_KEY=your-grafana-api-key-here
