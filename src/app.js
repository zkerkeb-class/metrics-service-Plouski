const express = require('express');
const cors = require('cors');
const axios = require('axios');
const promClient = require('prom-client');

const app = express();
const PORT = process.env.PORT || 5006;
const METRICS_PORT = process.env.METRICS_PORT || 9090;

// Configuration CORS
const corsOptions = {
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.use(express.json());

// ═══════════════════════════════════════════════════════════════
// MÉTRIQUES PROMETHEUS
// ═══════════════════════════════════════════════════════════════

// Registre pour les métriques
const register = new promClient.Registry();
promClient.collectDefaultMetrics({ register });

// Métriques custom pour le metrics-service
const httpRequestDuration = new promClient.Histogram({
  name: 'metrics_service_http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register]
});

const prometheusQueries = new promClient.Counter({
  name: 'metrics_service_prometheus_queries_total',
  help: 'Total number of Prometheus queries executed',
  labelNames: ['query_type', 'status'],
  registers: [register]
});

// Middleware pour mesurer les requêtes
app.use((req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    httpRequestDuration
      .labels(req.method, req.route?.path || req.path, res.statusCode)
      .observe(duration);
  });
  
  next();
});

// ═══════════════════════════════════════════════════════════════
// ROUTES API
// ═══════════════════════════════════════════════════════════════

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    service: 'metrics-service',
    timestamp: new Date().toISOString()
  });
});

// Endpoint pour les métriques Prometheus
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

// ═══════════════════════════════════════════════════════════════
// API POUR LE FRONTEND
// ═══════════════════════════════════════════════════════════════

// Dashboard principal - Vue d'ensemble de tous les services
app.get('/api/dashboard', async (req, res) => {
  try {
    const prometheusUrl = process.env.PROMETHEUS_URL || 'http://prometheus:9090';
    
    // Requêtes Prometheus pour obtenir les métriques clés
    const queries = {
      // Statut des services (up/down)
      servicesStatus: 'up',
      // Requêtes HTTP par seconde (adaptées à vos services)
      httpRequestsRate: 'rate(http_requests_total[5m])',
      // Temps de réponse (vos services utilisent http_request_duration_seconds)
      responseTime: 'histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))',
      // Taux d'erreur
      errorRate: 'rate(http_requests_total{status_code=~"5.."}[5m]) / rate(http_requests_total[5m]) * 100',
      // Santé des services (vos métriques custom)
      serviceHealth: 'service_health_status',
      // Connexions actives (data-service)
      activeConnections: 'active_connections',
      // Base de données (data-service et paiement-service)
      databaseStatus: 'database_status',
      // Métriques business spécifiques
      authAttempts: 'rate(auth_attempts_total[5m])',
      notificationsSent: 'rate(notifications_sent_total[5m])',
      paymentsTotal: 'rate(payments_total[5m])',
      webhooksReceived: 'rate(webhooks_received_total[5m])'
    };

    const results = {};
    
    for (const [key, query] of Object.entries(queries)) {
      try {
        const response = await axios.get(`${prometheusUrl}/api/v1/query`, {
          params: { query },
          timeout: 5000
        });
        
        results[key] = response.data.data.result;
        prometheusQueries.labels(key, 'success').inc();
      } catch (error) {
        console.error(`Erreur requête ${key}:`, error.message);
        results[key] = [];
        prometheusQueries.labels(key, 'error').inc();
      }
    }

    // Formatage des données pour le frontend
    const dashboard = formatDashboardData(results);
    
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      data: dashboard
    });
    
  } catch (error) {
    console.error('Erreur dashboard:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération des métriques'
    });
  }
});

// Métriques spécifiques à un service
app.get('/api/service/:serviceName/metrics', async (req, res) => {
  try {
    const { serviceName } = req.params;
    const prometheusUrl = process.env.PROMETHEUS_URL || 'http://prometheus:9090';
    
    const serviceQueries = {
      requests: `rate(http_requests_total{job="${serviceName}"}[5m])`,
      errors: `rate(http_requests_total{job="${serviceName}",status_code=~"5.."}[5m])`,
      latency: `histogram_quantile(0.95, rate(http_request_duration_seconds_bucket{job="${serviceName}"}[5m]))`,
      uptime: `up{job="${serviceName}"}`
    };

    const results = {};
    
    for (const [key, query] of Object.entries(serviceQueries)) {
      try {
        const response = await axios.get(`${prometheusUrl}/api/v1/query`, {
          params: { query },
          timeout: 5000
        });
        results[key] = response.data.data.result;
      } catch (error) {
        console.error(`Erreur requête ${key} pour ${serviceName}:`, error.message);
        results[key] = [];
      }
    }

    res.json({
      success: true,
      service: serviceName,
      timestamp: new Date().toISOString(),
      metrics: results
    });
    
  } catch (error) {
    console.error('Erreur métriques service:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération des métriques du service'
    });
  }
});

// Métriques business (métriques métier)
app.get('/api/business-metrics', async (req, res) => {
  try {
    const prometheusUrl = process.env.PROMETHEUS_URL || 'http://prometheus:9090';
    
    const businessQueries = {
      // Authentifications
      userLogins: 'increase(auth_service_login_attempts_total[1h])',
      userRegistrations: 'increase(auth_service_registrations_total[1h])',
      
      // Paiements
      paymentTransactions: 'increase(payment_service_transactions_total[1h])',
      paymentRevenue: 'increase(payment_service_revenue_total[1h])',
      
      // Notifications
      notificationsSent: 'increase(notification_service_sent_total[1h])',
      notificationsDelivered: 'increase(notification_service_delivered_total[1h])',
      
      // IA
      aiRequests: 'increase(ai_service_requests_total[1h])',
      aiTokensUsed: 'increase(ai_service_tokens_used_total[1h])'
    };

    const results = {};
    
    for (const [key, query] of Object.entries(businessQueries)) {
      try {
        const response = await axios.get(`${prometheusUrl}/api/v1/query`, {
          params: { query },
          timeout: 5000
        });
        results[key] = response.data.data.result;
      } catch (error) {
        console.error(`Erreur requête business ${key}:`, error.message);
        results[key] = [];
      }
    }

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      businessMetrics: results
    });
    
  } catch (error) {
    console.error('Erreur métriques business:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération des métriques business'
    });
  }
});

// Historique des métriques sur une période
app.get('/api/metrics/history', async (req, res) => {
  try {
    const { query, start, end, step = '1m' } = req.query;
    const prometheusUrl = process.env.PROMETHEUS_URL || 'http://prometheus:9090';
    
    if (!query) {
      return res.status(400).json({
        success: false,
        error: 'Paramètre query requis'
      });
    }

    const response = await axios.get(`${prometheusUrl}/api/v1/query_range`, {
      params: {
        query,
        start: start || Math.floor(Date.now() / 1000) - 3600, // 1h par défaut
        end: end || Math.floor(Date.now() / 1000),
        step
      },
      timeout: 10000
    });

    res.json({
      success: true,
      query,
      data: response.data.data.result
    });
    
  } catch (error) {
    console.error('Erreur historique métriques:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération de l\'historique'
    });
  }
});

// ═══════════════════════════════════════════════════════════════
// FONCTIONS UTILITAIRES
// ═══════════════════════════════════════════════════════════════

function formatDashboardData(rawData) {
  const services = ['ai-service', 'auth-service', 'data-service', 'notification-service', 'paiement-service'];
  
  return {
    overview: {
      totalServices: services.length,
      servicesUp: countServicesUp(rawData.servicesStatus || []),
      totalRequests: sumMetricValues(rawData.httpRequestsRate || []),
      avgResponseTime: calculateAvgResponseTime(rawData.responseTime || []),
      errorRate: calculateErrorRate(rawData.errorRate || []),
      healthScore: calculateHealthScore(rawData.serviceHealth || [])
    },
    services: services.map(service => ({
      name: service,
      status: getServiceStatus(rawData.servicesStatus || [], service),
      health: getServiceHealth(rawData.serviceHealth || [], service),
      requests: getServiceMetric(rawData.httpRequestsRate || [], service),
      responseTime: getServiceMetric(rawData.responseTime || [], service),
      errors: getServiceMetric(rawData.errorRate || [], service)
    })),
    systemMetrics: {
      activeConnections: formatSystemMetric(rawData.activeConnections || []),
      databaseStatus: formatSystemMetric(rawData.databaseStatus || [])
    },
    businessMetrics: {
      authAttempts: sumMetricValues(rawData.authAttempts || []),
      notificationsSent: sumMetricValues(rawData.notificationsSent || []),
      payments: sumMetricValues(rawData.paymentsTotal || []),
      webhooks: sumMetricValues(rawData.webhooksReceived || [])
    }
  };
}

function countServicesUp(upMetrics) {
  return upMetrics.filter(metric => parseFloat(metric.value[1]) === 1).length;
}

function sumMetricValues(metrics) {
  return metrics.reduce((sum, metric) => sum + parseFloat(metric.value[1] || 0), 0);
}

function calculateAvgResponseTime(metrics) {
  if (metrics.length === 0) return 0;
  const sum = metrics.reduce((sum, metric) => sum + parseFloat(metric.value[1] || 0), 0);
  return (sum / metrics.length).toFixed(3);
}

function calculateErrorRate(metrics) {
  if (metrics.length === 0) return 0;
  const sum = metrics.reduce((sum, metric) => sum + parseFloat(metric.value[1] || 0), 0);
  return (sum / metrics.length).toFixed(2);
}

function calculateHealthScore(healthMetrics) {
  if (!healthMetrics || healthMetrics.length === 0) return 100;
  const healthyServices = healthMetrics.filter(metric => parseFloat(metric.value[1]) === 1).length;
  return Math.round((healthyServices / healthMetrics.length) * 100);
}

function getServiceStatus(upMetrics, serviceName) {
  const serviceMetric = upMetrics.find(metric => 
    metric.metric.job === serviceName || 
    metric.metric.instance?.includes(serviceName)
  );
  return serviceMetric ? (parseFloat(serviceMetric.value[1]) === 1 ? 'up' : 'down') : 'unknown';
}

function getServiceHealth(healthMetrics, serviceName) {
  const serviceMetric = healthMetrics.find(metric => 
    metric.metric.service_name === serviceName
  );
  return serviceMetric ? (parseFloat(serviceMetric.value[1]) === 1 ? 'healthy' : 'unhealthy') : 'unknown';
}

function getServiceMetric(metrics, serviceName) {
  const serviceMetric = metrics.find(metric => 
    metric.metric.job === serviceName || 
    metric.metric.instance?.includes(serviceName)
  );
  return serviceMetric ? parseFloat(serviceMetric.value[1]) : 0;
}

function formatSystemMetric(metrics) {
  if (!metrics) return [];
  return metrics.map(metric => ({
    service: metric.metric.job || metric.metric.service_name || 'unknown',
    value: parseFloat(metric.value[1]),
    timestamp: metric.value[0]
  }));
}

// ═══════════════════════════════════════════════════════════════
// DÉMARRAGE DU SERVEUR
// ═══════════════════════════════════════════════════════════════

app.listen(PORT, () => {
  console.log(`🚀 Metrics Service démarré sur le port ${PORT}`);
  console.log(`📊 Métriques Prometheus disponibles sur http://localhost:${PORT}/metrics`);
  console.log(`📈 API Dashboard disponible sur http://localhost:${PORT}/api/dashboard`);
});

// Gestion des erreurs non capturées
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});