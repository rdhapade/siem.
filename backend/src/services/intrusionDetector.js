const Log = require('../models/Log');
const IntrusionAlert = require('../models/IntrusionAlert');
const logger = require('../utils/logger');
const cron = require('node-cron');

class IntrusionDetector {
  constructor() {
    this.isRunning = false;
    this.detectionRules = [
      {
        name: 'Brute Force Detection',
        type: 'brute_force',
        condition: this.detectBruteForce.bind(this),
        severity: 'high',
        enabled: true
      },
      {
        name: 'SQL Injection Detection',
        type: 'sql_injection',
        condition: this.detectSQLInjection.bind(this),
        severity: 'critical',
        enabled: true
      },
      {
        name: 'Unusual Traffic Pattern',
        type: 'anomaly',
        condition: this.detectAnomalousTraffic.bind(this),
        severity: 'medium',
        enabled: true
      },
      {
        name: 'Privilege Escalation',
        type: 'privilege_escalation',
        condition: this.detectPrivilegeEscalation.bind(this),
        severity: 'high',
        enabled: true
      },
      {
        name: 'Data Exfiltration',
        type: 'data_exfiltration',
        condition: this.detectDataExfiltration.bind(this),
        severity: 'critical',
        enabled: true
      }
    ];
    this.detectionInterval = null;
    this.alertThresholds = {
      bruteForceAttempts: 5,
      timeWindow: 300000, // 5 minutes in milliseconds
      anomalyThreshold: 3, // Standard deviations
      dataTransferThreshold: 100 * 1024 * 1024 // 100MB
    };
  }

  initialize() {
    logger.info('Initializing Intrusion Detection service');
    this.startDetection();
    this.schedulePeriodicDetection();
  }

  startDetection() {
    if (this.isRunning) {
      logger.warn('Intrusion Detector is already running');
      return;
    }

    this.isRunning = true;
    logger.info('Intrusion Detector started');

    // Start real-time detection
    this.monitorForIntrusions();
  }

  stopDetection() {
    if (!this.isRunning) {
      logger.warn('Intrusion Detector is not running');
      return;
    }

    this.isRunning = false;
    if (this.detectionInterval) {
      clearInterval(this.detectionInterval);
    }
    logger.info('Intrusion Detector stopped');
  }

  schedulePeriodicDetection() {
    // Run comprehensive detection every 2 minutes
    cron.schedule('*/2 * * * *', () => {
      if (this.isRunning) {
        this.runDetectionCycle();
      }
    });

    // Run deep analysis every hour
    cron.schedule('0 * * * *', () => {
      if (this.isRunning) {
        this.runDeepAnalysis();
      }
    });
  }

  async monitorForIntrusions() {
    // Real-time monitoring every 30 seconds
    this.detectionInterval = setInterval(async () => {
      if (this.isRunning) {
        await this.runDetectionCycle();
      }
    }, 30000);
  }

  async runDetectionCycle() {
    try {
      logger.debug('Starting intrusion detection cycle');

      // Get recent unprocessed logs
      const recentLogs = await Log.find({
        timestamp: { $gte: new Date(Date.now() - this.alertThresholds.timeWindow) },
        processed: false
      }).sort({ timestamp: -1 });

      // Run each detection rule
      for (const rule of this.detectionRules) {
        if (rule.enabled) {
          await this.executeDetectionRule(rule, recentLogs);
        }
      }

      // Mark logs as processed
      const logIds = recentLogs.map(log => log._id);
      if (logIds.length > 0) {
        await Log.updateMany(
          { _id: { $in: logIds } },
          { processed: true }
        );
      }

      logger.debug('Intrusion detection cycle completed');
    } catch (error) {
      logger.error('Error during intrusion detection cycle:', error);
    }
  }

  async executeDetectionRule(rule, logs) {
    try {
      const detections = await rule.condition(logs);
      
      for (const detection of detections) {
        await this.createAlert({
          ...detection,
          type: rule.type,
          severity: rule.severity,
          detectionMethod: 'signature'
        });
      }
    } catch (error) {
      logger.error(`Error executing detection rule ${rule.name}:`, error);
    }
  }

  async detectBruteForce(logs) {
    const detections = [];
    const failedAttempts = new Map();

    // Group failed login attempts by source IP
    logs.forEach(log => {
      if (log.category === 'security' && 
          log.message.toLowerCase().includes('failed') &&
          log.sourceIp) {
        
        if (!failedAttempts.has(log.sourceIp)) {
          failedAttempts.set(log.sourceIp, []);
        }
        failedAttempts.get(log.sourceIp).push(log);
      }
    });

    // Check for brute force patterns
    failedAttempts.forEach((attempts, sourceIp) => {
      if (attempts.length >= this.alertThresholds.bruteForceAttempts) {
        detections.push({
          title: `Brute Force Attack Detected from ${sourceIp}`,
          description: `${attempts.length} failed login attempts detected from IP ${sourceIp} within ${this.alertThresholds.timeWindow / 60000} minutes`,
          sourceIp: sourceIp,
          confidence: Math.min(95, 60 + (attempts.length * 5)),
          relatedLogs: attempts.map(log => log._id),
          attackVector: 'Authentication brute force',
          affectedAssets: ['Authentication System']
        });
      }
    });

    return detections;
  }

  async detectSQLInjection(logs) {
    const detections = [];
    const sqlPatterns = [
      /union\s+select/i,
      /or\s+1\s*=\s*1/i,
      /drop\s+table/i,
      /insert\s+into/i,
      /delete\s+from/i,
      /update\s+.*\s+set/i,
      /exec\s*\(/i,
      /script\s*>/i
    ];

    logs.forEach(log => {
      if (log.category === 'application' || log.category === 'database') {
        const message = log.message.toLowerCase();
        
        for (const pattern of sqlPatterns) {
          if (pattern.test(message)) {
            detections.push({
              title: 'SQL Injection Attempt Detected',
              description: `Potential SQL injection detected in log: ${log.message.substring(0, 100)}...`,
              sourceIp: log.sourceIp,
              confidence: 85,
              relatedLogs: [log._id],
              attackVector: 'SQL Injection',
              affectedAssets: ['Database', 'Web Application']
            });
            break;
          }
        }
      }
    });

    return detections;
  }

  async detectAnomalousTraffic(logs) {
    const detections = [];
    const trafficByIp = new Map();

    // Analyze traffic patterns
    logs.forEach(log => {
      if (log.sourceIp && log.category === 'application') {
        if (!trafficByIp.has(log.sourceIp)) {
          trafficByIp.set(log.sourceIp, 0);
        }
        trafficByIp.set(log.sourceIp, trafficByIp.get(log.sourceIp) + 1);
      }
    });

    // Calculate baseline and detect anomalies
    const requestCounts = Array.from(trafficByIp.values());
    if (requestCounts.length > 0) {
      const mean = requestCounts.reduce((a, b) => a + b, 0) / requestCounts.length;
      const variance = requestCounts.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / requestCounts.length;
      const stdDev = Math.sqrt(variance);
      const threshold = mean + (this.alertThresholds.anomalyThreshold * stdDev);

      trafficByIp.forEach((count, sourceIp) => {
        if (count > threshold && count > 50) { // Minimum threshold
          detections.push({
            title: `Anomalous Traffic Pattern Detected from ${sourceIp}`,
            description: `Unusual traffic volume detected: ${count} requests (${Math.round((count - mean) / stdDev * 100) / 100}σ above normal)`,
            sourceIp: sourceIp,
            confidence: Math.min(90, 50 + ((count - threshold) / threshold * 40)),
            attackVector: 'Traffic anomaly',
            affectedAssets: ['Web Application']
          });
        }
      });
    }

    return detections;
  }

  async detectPrivilegeEscalation(logs) {
    const detections = [];
    const privilegePatterns = [
      /sudo\s+su/i,
      /chmod\s+777/i,
      /chown\s+root/i,
      /privilege.*escalat/i,
      /admin.*access/i,
      /root.*shell/i
    ];

    logs.forEach(log => {
      if (log.category === 'system' || log.category === 'security') {
        const message = log.message.toLowerCase();
        
        for (const pattern of privilegePatterns) {
          if (pattern.test(message)) {
            detections.push({
              title: 'Privilege Escalation Attempt Detected',
              description: `Potential privilege escalation detected: ${log.message.substring(0, 100)}...`,
              sourceIp: log.sourceIp,
              confidence: 75,
              relatedLogs: [log._id],
              attackVector: 'Privilege escalation',
              affectedAssets: ['System']
            });
            break;
          }
        }
      }
    });

    return detections;
  }

  async detectDataExfiltration(logs) {
    const detections = [];
    const dataTransferByIp = new Map();

    // Analyze data transfer patterns
    logs.forEach(log => {
      if (log.details && log.details.size && log.sourceIp) {
        const size = parseInt(log.details.size) || 0;
        if (!dataTransferByIp.has(log.sourceIp)) {
          dataTransferByIp.set(log.sourceIp, 0);
        }
        dataTransferByIp.set(log.sourceIp, dataTransferByIp.get(log.sourceIp) + size);
      }
    });

    // Check for excessive data transfer
    dataTransferByIp.forEach((totalSize, sourceIp) => {
      if (totalSize > this.alertThresholds.dataTransferThreshold) {
        detections.push({
          title: `Potential Data Exfiltration from ${sourceIp}`,
          description: `Excessive data transfer detected: ${Math.round(totalSize / (1024 * 1024))}MB transferred`,
          sourceIp: sourceIp,
          confidence: 70,
          attackVector: 'Data exfiltration',
          affectedAssets: ['Data Storage', 'Network']
        });
      }
    });

    return detections;
  }

  async createAlert(alertData) {
    try {
      // Check if similar alert already exists
      const existingAlert = await IntrusionAlert.findOne({
        type: alertData.type,
        sourceIp: alertData.sourceIp,
        status: { $in: ['active', 'investigating'] },
        createdAt: { $gte: new Date(Date.now() - this.alertThresholds.timeWindow) }
      });

      if (existingAlert) {
        // Update existing alert instead of creating duplicate
        existingAlert.confidence = Math.max(existingAlert.confidence, alertData.confidence);
        if (alertData.relatedLogs) {
          existingAlert.relatedLogs.push(...alertData.relatedLogs);
        }
        await existingAlert.save();
        logger.info(`Updated existing alert: ${existingAlert.alertId}`);
        return existingAlert;
      }

      // Create new alert
      const alert = new IntrusionAlert(alertData);
      await alert.save();

      logger.warn(`New intrusion alert created: ${alert.alertId} - ${alert.title}`);

      // Trigger immediate notification for high/critical severity
      if (['high', 'critical'].includes(alert.severity)) {
        await this.triggerImmediateNotification(alert);
      }

      return alert;
    } catch (error) {
      logger.error('Error creating intrusion alert:', error);
      throw error;
    }
  }

  async triggerImmediateNotification(alert) {
    try {
      // This would integrate with notification service
      logger.warn(`IMMEDIATE ATTENTION REQUIRED: ${alert.severity.toUpperCase()} severity alert - ${alert.title}`);
      
      // In a real implementation, this would send emails, SMS, or webhook notifications
      // For now, we'll just log it
    } catch (error) {
      logger.error('Error triggering immediate notification:', error);
    }
  }

  async runDeepAnalysis() {
    try {
      logger.info('Running deep intrusion analysis');

      // Analyze patterns over longer time periods
      const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const logs = await Log.find({
        timestamp: { $gte: last24Hours },
        category: 'security'
      });

      // Perform correlation analysis
      await this.performCorrelationAnalysis(logs);

      logger.info('Deep intrusion analysis completed');
    } catch (error) {
      logger.error('Error during deep analysis:', error);
    }
  }

  async performCorrelationAnalysis(logs) {
    // Implement advanced correlation logic here
    // This could include machine learning models, behavioral analysis, etc.
    logger.debug('Performing correlation analysis on security logs');
  }

  updateDetectionRule(ruleName, updates) {
    const rule = this.detectionRules.find(r => r.name === ruleName);
    if (rule) {
      Object.assign(rule, updates);
      logger.info(`Detection rule updated: ${ruleName}`);
    }
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      rulesCount: this.detectionRules.length,
      enabledRules: this.detectionRules.filter(r => r.enabled).length,
      lastDetection: new Date().toISOString(),
      thresholds: this.alertThresholds
    };
  }
}

module.exports = new IntrusionDetector();