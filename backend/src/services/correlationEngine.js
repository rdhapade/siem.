const Log = require('../models/Log');
const IntrusionAlert = require('../models/IntrusionAlert');
const logger = require('../utils/logger');
const cron = require('node-cron');

class CorrelationEngine {
  constructor() {
    this.isRunning = false;
    this.correlationRules = [
      {
        name: 'Multi-Stage Attack Detection',
        type: 'attack_chain',
        condition: this.detectAttackChain.bind(this),
        timeWindow: 3600000, // 1 hour
        enabled: true
      },
      {
        name: 'Coordinated Attack Detection',
        type: 'coordinated_attack',
        condition: this.detectCoordinatedAttack.bind(this),
        timeWindow: 1800000, // 30 minutes
        enabled: true
      },
      {
        name: 'Lateral Movement Detection',
        type: 'lateral_movement',
        condition: this.detectLateralMovement.bind(this),
        timeWindow: 7200000, // 2 hours
        enabled: true
      },
      {
        name: 'Data Breach Pattern',
        type: 'data_breach',
        condition: this.detectDataBreachPattern.bind(this),
        timeWindow: 3600000, // 1 hour
        enabled: true
      }
    ];
    this.correlationInterval = null;
    this.eventCache = new Map();
  }

  initialize() {
    logger.info('Initializing Correlation Engine service');
    this.startCorrelation();
    this.schedulePeriodicCorrelation();
  }

  startCorrelation() {
    if (this.isRunning) {
      logger.warn('Correlation Engine is already running');
      return;
    }

    this.isRunning = true;
    logger.info('Correlation Engine started');
    this.monitorForCorrelations();
  }

  stopCorrelation() {
    if (!this.isRunning) {
      logger.warn('Correlation Engine is not running');
      return;
    }

    this.isRunning = false;
    if (this.correlationInterval) {
      clearInterval(this.correlationInterval);
    }
    logger.info('Correlation Engine stopped');
  }

  schedulePeriodicCorrelation() {
    // Run correlation analysis every 5 minutes
    cron.schedule('*/5 * * * *', () => {
      if (this.isRunning) {
        this.runCorrelationCycle();
      }
    });

    // Run deep correlation analysis every hour
    cron.schedule('0 * * * *', () => {
      if (this.isRunning) {
        this.runDeepCorrelation();
      }
    });

    // Clean up old cache entries daily
    cron.schedule('0 0 * * *', () => {
      this.cleanupCache();
    });
  }

  async monitorForCorrelations() {
    // Real-time correlation monitoring every 2 minutes
    this.correlationInterval = setInterval(async () => {
      if (this.isRunning) {
        await this.runCorrelationCycle();
      }
    }, 120000);
  }

  async runCorrelationCycle() {
    try {
      logger.debug('Starting correlation analysis cycle');

      // Get recent logs and alerts for correlation
      const timeWindow = Math.max(...this.correlationRules.map(r => r.timeWindow));
      const cutoffTime = new Date(Date.now() - timeWindow);

      const recentLogs = await Log.find({
        timestamp: { $gte: cutoffTime }
      }).sort({ timestamp: -1 });

      const recentAlerts = await IntrusionAlert.find({
        createdAt: { $gte: cutoffTime }
      }).sort({ createdAt: -1 });

      // Run correlation rules
      for (const rule of this.correlationRules) {
        if (rule.enabled) {
          await this.executeCorrelationRule(rule, recentLogs, recentAlerts);
        }
      }

      logger.debug('Correlation analysis cycle completed');
    } catch (error) {
      logger.error('Error during correlation analysis:', error);
    }
  }

  async executeCorrelationRule(rule, logs, alerts) {
    try {
      const correlations = await rule.condition(logs, alerts, rule.timeWindow);
      
      for (const correlation of correlations) {
        await this.createCorrelatedAlert(correlation, rule);
      }
    } catch (error) {
      logger.error(`Error executing correlation rule ${rule.name}:`, error);
    }
  }

  async detectAttackChain(logs, alerts, timeWindow) {
    const correlations = [];
    const attackStages = [
      'reconnaissance',
      'initial_access',
      'privilege_escalation',
      'lateral_movement',
      'data_exfiltration'
    ];

    // Group events by source IP
    const eventsByIp = new Map();
    
    logs.forEach(log => {
      if (log.sourceIp) {
        if (!eventsByIp.has(log.sourceIp)) {
          eventsByIp.set(log.sourceIp, { logs: [], alerts: [] });
        }
        eventsByIp.get(log.sourceIp).logs.push(log);
      }
    });

    alerts.forEach(alert => {
      if (alert.sourceIp) {
        if (!eventsByIp.has(alert.sourceIp)) {
          eventsByIp.set(alert.sourceIp, { logs: [], alerts: [] });
        }
        eventsByIp.get(alert.sourceIp).alerts.push(alert);
      }
    });

    // Analyze each IP for attack chain patterns
    eventsByIp.forEach((events, sourceIp) => {
      const stageIndicators = this.identifyAttackStages(events);
      
      if (stageIndicators.length >= 3) { // Multi-stage attack detected
        correlations.push({
          title: `Multi-Stage Attack Chain Detected from ${sourceIp}`,
          description: `Attack progression detected: ${stageIndicators.join(' → ')}`,
          sourceIp: sourceIp,
          confidence: Math.min(95, 60 + (stageIndicators.length * 10)),
          relatedLogs: events.logs.map(log => log._id),
          relatedAlerts: events.alerts.map(alert => alert._id),
          attackVector: 'Multi-stage attack chain',
          affectedAssets: this.extractAffectedAssets(events),
          correlationId: `CHAIN-${Date.now()}-${sourceIp.replace(/\./g, '')}`
        });
      }
    });

    return correlations;
  }

  identifyAttackStages(events) {
    const stages = [];
    const allEvents = [...events.logs, ...events.alerts];
    
    // Sort events by timestamp
    allEvents.sort((a, b) => {
      const timeA = a.timestamp || a.createdAt;
      const timeB = b.timestamp || b.createdAt;
      return new Date(timeA) - new Date(timeB);
    });

    // Identify stages based on event patterns
    allEvents.forEach(event => {
      const message = (event.message || event.title || '').toLowerCase();
      
      if (message.includes('scan') || message.includes('probe')) {
        if (!stages.includes('reconnaissance')) stages.push('reconnaissance');
      } else if (message.includes('login') || message.includes('access')) {
        if (!stages.includes('initial_access')) stages.push('initial_access');
      } else if (message.includes('privilege') || message.includes('escalat')) {
        if (!stages.includes('privilege_escalation')) stages.push('privilege_escalation');
      } else if (message.includes('lateral') || message.includes('movement')) {
        if (!stages.includes('lateral_movement')) stages.push('lateral_movement');
      } else if (message.includes('data') || message.includes('exfiltrat')) {
        if (!stages.includes('data_exfiltration')) stages.push('data_exfiltration');
      }
    });

    return stages;
  }

  async detectCoordinatedAttack(logs, alerts, timeWindow) {
    const correlations = [];
    const ipGroups = new Map();
    
    // Group similar attacks by type and time
    alerts.forEach(alert => {
      const key = `${alert.type}-${Math.floor(new Date(alert.createdAt).getTime() / 300000)}`; // 5-minute buckets
      
      if (!ipGroups.has(key)) {
        ipGroups.set(key, []);
      }
      ipGroups.get(key).push(alert);
    });

    // Detect coordinated attacks (multiple IPs, same attack type, similar timeframe)
    ipGroups.forEach((alertGroup, key) => {
      const uniqueIps = new Set(alertGroup.map(alert => alert.sourceIp).filter(ip => ip));
      
      if (uniqueIps.size >= 3) { // Coordinated attack from multiple IPs
        const attackType = key.split('-')[0];
        correlations.push({
          title: `Coordinated ${attackType.replace('_', ' ').toUpperCase()} Attack Detected`,
          description: `Coordinated attack from ${uniqueIps.size} different IP addresses`,
          confidence: Math.min(90, 50 + (uniqueIps.size * 10)),
          relatedAlerts: alertGroup.map(alert => alert._id),
          attackVector: `Coordinated ${attackType}`,
          affectedAssets: [...new Set(alertGroup.flatMap(alert => alert.affectedAssets || []))],
          correlationId: `COORD-${Date.now()}-${attackType}`
        });
      }
    });

    return correlations;
  }

  async detectLateralMovement(logs, alerts, timeWindow) {
    const correlations = [];
    const movementPatterns = new Map();

    // Track authentication and access patterns across different systems
    logs.forEach(log => {
      if (log.category === 'security' && log.sourceIp && log.details?.user) {
        const key = `${log.details.user}-${log.sourceIp}`;
        
        if (!movementPatterns.has(key)) {
          movementPatterns.set(key, { systems: new Set(), events: [] });
        }
        
        movementPatterns.get(key).systems.add(log.source);
        movementPatterns.get(key).events.push(log);
      }
    });

    // Detect lateral movement (same user/IP accessing multiple systems)
    movementPatterns.forEach((pattern, key) => {
      if (pattern.systems.size >= 3) { // Accessed multiple systems
        const [user, sourceIp] = key.split('-');
        correlations.push({
          title: `Lateral Movement Detected - User: ${user}`,
          description: `User ${user} from ${sourceIp} accessed ${pattern.systems.size} different systems`,
          sourceIp: sourceIp,
          confidence: Math.min(85, 40 + (pattern.systems.size * 15)),
          relatedLogs: pattern.events.map(event => event._id),
          attackVector: 'Lateral movement',
          affectedAssets: Array.from(pattern.systems),
          correlationId: `LATERAL-${Date.now()}-${user}`
        });
      }
    });

    return correlations;
  }

  async detectDataBreachPattern(logs, alerts, timeWindow) {
    const correlations = [];
    const breachIndicators = new Map();

    // Look for patterns indicating data breach
    const breachEvents = logs.filter(log => {
      const message = log.message.toLowerCase();
      return message.includes('database') || 
             message.includes('file') || 
             message.includes('download') ||
             message.includes('export') ||
             message.includes('backup');
    });

    // Group by source IP and analyze patterns
    breachEvents.forEach(log => {
      if (log.sourceIp) {
        if (!breachIndicators.has(log.sourceIp)) {
          breachIndicators.set(log.sourceIp, { events: [], dataVolume: 0 });
        }
        
        breachIndicators.get(log.sourceIp).events.push(log);
        
        // Estimate data volume if available
        if (log.details?.size) {
          breachIndicators.get(log.sourceIp).dataVolume += parseInt(log.details.size) || 0;
        }
      }
    });

    // Detect potential data breach patterns
    breachIndicators.forEach((indicators, sourceIp) => {
      const hasHighVolume = indicators.dataVolume > 50 * 1024 * 1024; // 50MB
      const hasMultipleAccess = indicators.events.length >= 5;
      
      if (hasHighVolume || hasMultipleAccess) {
        correlations.push({
          title: `Potential Data Breach Pattern from ${sourceIp}`,
          description: `Suspicious data access pattern: ${indicators.events.length} events, ${Math.round(indicators.dataVolume / (1024 * 1024))}MB transferred`,
          sourceIp: sourceIp,
          confidence: hasHighVolume && hasMultipleAccess ? 80 : 60,
          relatedLogs: indicators.events.map(event => event._id),
          attackVector: 'Data breach',
          affectedAssets: ['Database', 'File System'],
          correlationId: `BREACH-${Date.now()}-${sourceIp.replace(/\./g, '')}`
        });
      }
    });

    return correlations;
  }

  extractAffectedAssets(events) {
    const assets = new Set();
    
    events.logs.forEach(log => {
      assets.add(log.source);
    });
    
    events.alerts.forEach(alert => {
      if (alert.affectedAssets) {
        alert.affectedAssets.forEach(asset => assets.add(asset));
      }
    });

    return Array.from(assets);
  }

  async createCorrelatedAlert(correlationData, rule) {
    try {
      // Check if similar correlation already exists
      const existingAlert = await IntrusionAlert.findOne({
        correlationId: correlationData.correlationId,
        status: { $in: ['active', 'investigating'] }
      });

      if (existingAlert) {
        logger.debug(`Correlation already exists: ${correlationData.correlationId}`);
        return existingAlert;
      }

      // Create new correlated alert
      const alert = new IntrusionAlert({
        ...correlationData,
        type: rule.type,
        severity: this.calculateCorrelationSeverity(correlationData),
        detectionMethod: 'correlation'
      });

      await alert.save();

      logger.warn(`New correlated alert created: ${alert.alertId} - ${alert.title}`);

      return alert;
    } catch (error) {
      logger.error('Error creating correlated alert:', error);
      throw error;
    }
  }

  calculateCorrelationSeverity(correlationData) {
    // Calculate severity based on confidence and impact
    const confidence = correlationData.confidence || 50;
    const assetCount = (correlationData.affectedAssets || []).length;
    
    if (confidence >= 80 && assetCount >= 3) return 'critical';
    if (confidence >= 70 || assetCount >= 2) return 'high';
    if (confidence >= 60) return 'medium';
    return 'low';
  }

  async runDeepCorrelation() {
    try {
      logger.info('Running deep correlation analysis');

      // Analyze patterns over extended time periods
      const last7Days = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      
      // Perform advanced correlation analysis
      await this.analyzeHistoricalPatterns(last7Days);
      await this.updateThreatIntelligence();

      logger.info('Deep correlation analysis completed');
    } catch (error) {
      logger.error('Error during deep correlation analysis:', error);
    }
  }

  async analyzeHistoricalPatterns(since) {
    // Implement historical pattern analysis
    logger.debug('Analyzing historical attack patterns');
    
    // This could include:
    // - Trend analysis
    // - Seasonal pattern detection
    // - Threat actor profiling
    // - Attack campaign identification
  }

  async updateThreatIntelligence() {
    // Update threat intelligence based on correlations
    logger.debug('Updating threat intelligence database');
    
    // This could include:
    // - IP reputation updates
    // - Attack signature updates
    // - Behavioral pattern updates
  }

  cleanupCache() {
    const cutoffTime = Date.now() - 24 * 60 * 60 * 1000; // 24 hours
    
    for (const [key, value] of this.eventCache.entries()) {
      if (value.timestamp < cutoffTime) {
        this.eventCache.delete(key);
      }
    }
    
    logger.debug(`Cleaned up correlation cache, ${this.eventCache.size} entries remaining`);
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      rulesCount: this.correlationRules.length,
      enabledRules: this.correlationRules.filter(r => r.enabled).length,
      cacheSize: this.eventCache.size,
      lastCorrelation: new Date().toISOString()
    };
  }
}

module.exports = new CorrelationEngine();