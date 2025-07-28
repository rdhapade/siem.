const Log = require('../models/Log');
const logger = require('../utils/logger');
const cron = require('node-cron');
const fs = require('fs').promises;
const path = require('path');

class LogCollector {
  constructor() {
    this.isRunning = false;
    this.collectionInterval = null;
    this.logSources = [
      {
        name: 'System Logs',
        path: '/var/log/syslog',
        type: 'system',
        parser: this.parseSystemLog.bind(this)
      },
      {
        name: 'Apache Access Logs',
        path: '/var/log/apache2/access.log',
        type: 'web',
        parser: this.parseApacheLog.bind(this)
      },
      {
        name: 'Security Logs',
        path: '/var/log/auth.log',
        type: 'security',
        parser: this.parseSecurityLog.bind(this)
      }
    ];
    this.lastProcessedPositions = new Map();
  }

  initialize() {
    logger.info('Initializing Log Collector service');
    this.startCollection();
    this.schedulePeriodicCollection();
  }

  startCollection() {
    if (this.isRunning) {
      logger.warn('Log Collector is already running');
      return;
    }

    this.isRunning = true;
    logger.info('Log Collector started');

    // Start real-time log monitoring
    this.monitorLogs();
  }

  stopCollection() {
    if (!this.isRunning) {
      logger.warn('Log Collector is not running');
      return;
    }

    this.isRunning = false;
    if (this.collectionInterval) {
      clearInterval(this.collectionInterval);
    }
    logger.info('Log Collector stopped');
  }

  schedulePeriodicCollection() {
    // Run log collection every 5 minutes
    cron.schedule('*/5 * * * *', () => {
      if (this.isRunning) {
        this.collectLogs();
      }
    });

    // Run log cleanup daily at 2 AM
    cron.schedule('0 2 * * *', () => {
      this.cleanupOldLogs();
    });
  }

  async monitorLogs() {
    // Simulate real-time log monitoring
    this.collectionInterval = setInterval(async () => {
      if (this.isRunning) {
        await this.collectLogs();
        await this.generateSampleLogs(); // For demonstration
      }
    }, 10000); // Every 10 seconds
  }

  async collectLogs() {
    try {
      logger.debug('Starting log collection cycle');

      for (const source of this.logSources) {
        await this.collectFromSource(source);
      }

      logger.debug('Log collection cycle completed');
    } catch (error) {
      logger.error('Error during log collection:', error);
    }
  }

  async collectFromSource(source) {
    try {
      // In a real implementation, this would read from actual log files
      // For demonstration, we'll simulate log collection
      logger.debug(`Collecting logs from ${source.name}`);

      // Simulate reading new log entries
      const newEntries = await this.simulateLogReading(source);
      
      for (const entry of newEntries) {
        const parsedLog = source.parser(entry);
        if (parsedLog) {
          await this.storeLog(parsedLog);
        }
      }

    } catch (error) {
      logger.error(`Error collecting from ${source.name}:`, error);
    }
  }

  async simulateLogReading(source) {
    // Simulate reading log entries - in production, this would read actual files
    const sampleEntries = [];
    const entryCount = Math.floor(Math.random() * 5) + 1;

    for (let i = 0; i < entryCount; i++) {
      sampleEntries.push(this.generateSampleLogEntry(source.type));
    }

    return sampleEntries;
  }

  generateSampleLogEntry(type) {
    const timestamp = new Date().toISOString();
    const sourceIps = ['192.168.1.100', '10.0.0.50', '172.16.0.25', '203.0.113.10'];
    const randomIp = sourceIps[Math.floor(Math.random() * sourceIps.length)];

    switch (type) {
      case 'system':
        return {
          timestamp,
          level: 'info',
          source: 'systemd',
          message: 'Service started successfully',
          details: { service: 'nginx', pid: Math.floor(Math.random() * 10000) }
        };

      case 'web':
        return {
          timestamp,
          level: 'info',
          source: 'apache',
          message: `${randomIp} - - [${timestamp}] "GET /api/logs HTTP/1.1" 200 1234`,
          details: { 
            method: 'GET', 
            path: '/api/logs', 
            status: 200, 
            size: 1234,
            sourceIp: randomIp
          }
        };

      case 'security':
        const isFailure = Math.random() > 0.7;
        return {
          timestamp,
          level: isFailure ? 'warn' : 'info',
          source: 'sshd',
          message: isFailure ? 
            `Failed password for user admin from ${randomIp}` :
            `Accepted password for user admin from ${randomIp}`,
          details: { 
            user: 'admin', 
            sourceIp: randomIp,
            success: !isFailure
          }
        };

      default:
        return {
          timestamp,
          level: 'info',
          source: 'unknown',
          message: 'Generic log entry',
          details: {}
        };
    }
  }

  parseSystemLog(entry) {
    return {
      timestamp: entry.timestamp || new Date(),
      level: entry.level || 'info',
      source: entry.source || 'system',
      message: entry.message,
      details: entry.details || {},
      category: 'system',
      severity: this.calculateSeverity(entry.level),
      sourceIp: entry.details?.sourceIp
    };
  }

  parseApacheLog(entry) {
    return {
      timestamp: entry.timestamp || new Date(),
      level: entry.level || 'info',
      source: entry.source || 'apache',
      message: entry.message,
      details: entry.details || {},
      category: 'application',
      severity: this.calculateSeverity(entry.level),
      sourceIp: entry.details?.sourceIp
    };
  }

  parseSecurityLog(entry) {
    const isSecurityEvent = entry.message.includes('Failed') || 
                           entry.message.includes('authentication') ||
                           entry.message.includes('login');
    
    return {
      timestamp: entry.timestamp || new Date(),
      level: entry.level || 'info',
      source: entry.source || 'auth',
      message: entry.message,
      details: entry.details || {},
      category: 'security',
      severity: isSecurityEvent ? 
        (entry.level === 'warn' ? 7 : 5) : 
        this.calculateSeverity(entry.level),
      sourceIp: entry.details?.sourceIp,
      threatLevel: isSecurityEvent && entry.level === 'warn' ? 'medium' : 'low'
    };
  }

  calculateSeverity(level) {
    const severityMap = {
      'debug': 1,
      'info': 3,
      'warn': 6,
      'error': 8,
      'critical': 10
    };
    return severityMap[level] || 5;
  }

  async storeLog(logData) {
    try {
      const log = new Log(logData);
      await log.save();
      
      // Emit real-time event if high severity
      if (log.severity >= 7) {
        // This would be handled by the main app's socket.io instance
        logger.info(`High severity log detected: ${log._id}`);
      }

    } catch (error) {
      logger.error('Error storing log:', error);
    }
  }

  async generateSampleLogs() {
    // Generate some sample logs for demonstration
    const sampleLogs = [
      {
        level: 'info',
        source: 'web-server',
        message: 'User login successful',
        category: 'security',
        details: { userId: 'user123', ip: '192.168.1.100' }
      },
      {
        level: 'warn',
        source: 'database',
        message: 'Slow query detected',
        category: 'database',
        details: { query: 'SELECT * FROM users', duration: '5.2s' }
      },
      {
        level: 'error',
        source: 'firewall',
        message: 'Blocked suspicious traffic',
        category: 'network',
        details: { sourceIp: '203.0.113.10', port: 22, protocol: 'TCP' }
      }
    ];

    // Randomly select and store a sample log
    if (Math.random() > 0.7) {
      const randomLog = sampleLogs[Math.floor(Math.random() * sampleLogs.length)];
      await this.storeLog({
        ...randomLog,
        timestamp: new Date(),
        severity: this.calculateSeverity(randomLog.level)
      });
    }
  }

  async cleanupOldLogs() {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - 90); // Keep logs for 90 days

      const result = await Log.deleteMany({
        timestamp: { $lt: cutoffDate },
        level: { $in: ['debug', 'info'] } // Only cleanup low-priority logs
      });

      logger.info(`Cleaned up ${result.deletedCount} old log entries`);
    } catch (error) {
      logger.error('Error during log cleanup:', error);
    }
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      sourcesCount: this.logSources.length,
      lastCollection: new Date().toISOString()
    };
  }
}

module.exports = new LogCollector();