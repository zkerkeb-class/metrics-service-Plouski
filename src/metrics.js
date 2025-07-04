const promClient = require('prom-client');

// Créer un registre pour les métriques
const register = new promClient.Registry();

// Métriques par défaut (CPU, mémoire, etc.)
promClient.collectDefaultMetrics({
  register,
  prefix: 'metrics_service_',
});

// ═══════════════════════════════════════════════════════════════
// MÉTRIQUES CUSTOM POUR LE METRICS-SERVICE
// ═══════════════════════════════════════════════════════════════

// Santé du service
const serviceHealthStatus = new promClient.Gauge({
  name: 'service_health_status',
  help: 'Health status of the service (1 = healthy, 0 = unhealthy)',
  labelNames: ['service_name'],
  registers: [register]
});

// Durée des requêtes HTTP
const httpRequestDuration = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10],
  registers: [register]
});

// Total des requêtes HTTP
const httpRequestsTotal = new promClient.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register]
});

// Protocole des requêtes (HTTP/HTTPS)
const requestProtocol = new promClient.Counter({
  name: 'request_protocol_total',
  help: 'Total requests by protocol',
  labelNames: ['protocol'],
  registers: [register]
});

// Requêtes Prometheus exécutées
const prometheusQueries = new promClient.Counter({
  name: 'metrics_service_prometheus_queries_total',
  help: 'Total number of Prometheus queries executed',
  labelNames: ['query_type', 'status'],
  registers: [register]
});

// Temps de réponse des requêtes Prometheus
const prometheusQueryDuration = new promClient.Histogram({
  name: 'metrics_service_prometheus_query_duration_seconds',
  help: 'Duration of Prometheus queries in seconds',
  labelNames: ['query_type'],
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
  registers: [register]
});

// Cache des métriques (pour éviter de surcharger Prometheus)
const metricsCache = new promClient.Gauge({
  name: 'metrics_service_cache_hits_total',
  help: 'Number of cache hits for metrics requests',
  labelNames: ['cache_type'],
  registers: [register]
});

// Services externes surveillés
const externalServiceHealth = new promClient.Gauge({
  name: 'external_service_health',
  help: 'Health status of external services (1 = healthy, 0 = unhealthy)',
  labelNames: ['service_name'],
  registers: [register]
});

// Métriques de données agrégées
const aggregatedMetrics = new promClient.Gauge({
  name: 'metrics_service_aggregated_data',
  help: 'Aggregated metrics data for dashboard',
  labelNames: ['metric_type', 'service'],
  registers: [register]
});

module.exports = {
  register,
  serviceHealthStatus,
  httpRequestDuration,
  httpRequestsTotal,
  requestProtocol,
  prometheusQueries,
  prometheusQueryDuration,
  metricsCache,
  externalServiceHealth,
  aggregatedMetrics
};