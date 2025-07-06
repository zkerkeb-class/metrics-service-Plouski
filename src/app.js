const express = require('express');
const cors = require('cors');
const axios = require('axios');
const promClient = require('prom-client');

const app = express();
const PORT = process.env.PORT || 5006;

// Configuration
app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:3000' }));
app.use(express.json());

// Métriques Prometheus
const register = new promClient.Registry();
promClient.collectDefaultMetrics({ register });

// ═══════════════════════════════════════════════════════════════
// MVP - ENDPOINTS ESSENTIELS SEULEMENT
// ═══════════════════════════════════════════════════════════════

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    service: 'metrics-service',
    timestamp: new Date().toISOString()
  });
});

// Métriques Prometheus (pour Prometheus lui-même)
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

// 📊 MVP: Dashboard simple - JUSTE les infos essentielles
app.get('/api/dashboard', async (req, res) => {
  try {
    const prometheusUrl = process.env.PROMETHEUS_URL || 'http://prometheus:9090';
    
    // Juste 2 requêtes essentielles pour le MVP
    const [upResponse, requestsResponse] = await Promise.all([
      axios.get(`${prometheusUrl}/api/v1/query?query=up`).catch(() => ({ data: { data: { result: [] } } })),
      axios.get(`${prometheusUrl}/api/v1/query?query=rate(http_requests_total[5m])`).catch(() => ({ data: { data: { result: [] } } }))
    ]);

    const upMetrics = upResponse.data.data.result || [];
    const requestMetrics = requestsResponse.data.data.result || [];

    // Format simple pour le MVP
    const dashboard = {
      timestamp: new Date().toISOString(),
      services: {
        total: 5, // Vos 5 microservices
        up: upMetrics.filter(m => m.value[1] === '1').length,
        down: upMetrics.filter(m => m.value[1] === '0').length
      },
      requests: {
        totalPerSecond: requestMetrics.reduce((sum, m) => sum + parseFloat(m.value[1] || 0), 0).toFixed(2)
      },
      details: upMetrics.map(metric => ({
        service: metric.metric.job,
        status: metric.value[1] === '1' ? 'UP' : 'DOWN',
        instance: metric.metric.instance
      }))
    };

    res.json({ success: true, data: dashboard });
    
  } catch (error) {
    console.error('Erreur dashboard MVP:', error.message);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération des métriques'
    });
  }
});

// 📈 MVP: Vue d'ensemble simple des services
app.get('/api/services/status', async (req, res) => {
  try {
    const prometheusUrl = process.env.PROMETHEUS_URL || 'http://prometheus:9090';
    const response = await axios.get(`${prometheusUrl}/api/v1/query?query=up`);
    
    const services = response.data.data.result.map(metric => ({
      name: metric.metric.job,
      status: metric.value[1] === '1' ? 'healthy' : 'down',
      instance: metric.metric.instance,
      lastCheck: new Date().toISOString()
    }));

    res.json({ success: true, services });
    
  } catch (error) {
    console.error('Erreur status services:', error.message);
    res.status(500).json({ success: false, error: 'Erreur services status' });
  }
});

// 🏠 Page d'accueil simple
app.get('/', (req, res) => {
  res.json({
    service: 'Metrics Service API - MVP',
    version: '1.0.0',
    endpoints: [
      'GET /health - Service health',
      'GET /metrics - Prometheus metrics',
      'GET /api/dashboard - Dashboard simple',
      'GET /api/services/status - Services status'
    ],
    grafana: 'http://localhost:3100',
    prometheus: 'http://localhost:9090'
  });
});

// Démarrage
app.listen(PORT, () => {
  console.log(`🚀 Metrics Service (MVP) démarré sur le port ${PORT}`);
  console.log(`📊 Dashboard: http://localhost:${PORT}/api/dashboard`);
  console.log(`📈 Services: http://localhost:${PORT}/api/services/status`);
});