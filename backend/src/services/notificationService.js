const IntrusionAlert = require('../models/IntrusionAlert');
const logger = require('../utils/logger');
const cron = require('node-cron');

class NotificationService {
  constructor() {
    this.isRunning = false;
    this.notificationChannels = [
      {
        name: 'email',
        enabled: true,
        handler: this.sendEmailNotification.bind(this)
      },
      {
        name: 'webhook',
        enabled: true,
        handler: this.sendWebhookNotification.bind(this)
      },
      {
        name: 'dashboard',
        enabled: true,
        handler: this.sendDashboardNotification.bind(this)
      }
    ];
    this.notificationQueue = [];
    this.processingInterval = null;
    this.escalationRules = [
      {
        severity: 'critical',
        escalateAfter: 300000, // 5 minutes
        channels: ['email', 'webhook', 'dashboard']
      },
      {
        severity: 'high',
        escalateAfter: 900000, // 15 minutes
        channels: ['email', 'dashboard']
      },
      {
        severity: 'medium',
        escalateAfter: 1800000, // 30 minutes
        channels: ['dashboard']
      }
    ];
  }

  initialize() {
    logger.info('Initializing Notification Service');
    this.startNotificationProcessing();
    this.schedulePeriodicTasks();
  }

  startNotificationProcessing() {
    if (this.isRunning) {
      logger.warn('Notification Service is already running');
      return;
    }

    this.isRunning = true;
    logger.info('Notification Service started');

    // Process notification queue every 30 seconds
    this.processingInterval = setInterval(async () => {
      if (this.isRunning) {
        await this.processNotificationQueue();
      }
    }, 30000);
  }

  stopNotificationProcessing() {
    if (!this.isRunning) {
      logger.warn('Notification Service is not running');
      return;
    }

    this.isRunning = false;
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
    }
    logger.info('Notification Service stopped');
  }

  schedulePeriodicTasks() {
    // Check for escalations every 5 minutes
    cron.schedule('*/5 * * * *', () => {
      if (this.isRunning) {
        this.checkEscalations();
      }
    });

    // Send daily summary at 8 AM
    cron.schedule('0 8 * * *', () => {
      if (this.isRunning) {
        this.sendDailySummary();
      }
    });

    // Clean up old notifications weekly
    cron.schedule('0 0 * * 0', () => {
      if (this.isRunning) {
        this.cleanupOldNotifications();
      }
    });
  }

  async queueNotification(alert, channels = ['dashboard']) {
    try {
      const notification = {
        id: `NOTIF-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        alertId: alert._id,
        alert: alert,
        channels: channels,
        priority: this.calculatePriority(alert.severity),
        createdAt: new Date(),
        attempts: 0,
        maxAttempts: 3,
        status: 'pending'
      };

      this.notificationQueue.push(notification);
      logger.info(`Notification queued for alert ${alert.alertId}: ${channels.join(', ')}`);

      // Process immediately for critical alerts
      if (alert.severity === 'critical') {
        await this.processNotificationQueue();
      }

    } catch (error) {
      logger.error('Error queuing notification:', error);
    }
  }

  async processNotificationQueue() {
    if (this.notificationQueue.length === 0) {
      return;
    }

    logger.debug(`Processing ${this.notificationQueue.length} notifications`);

    const pendingNotifications = this.notificationQueue.filter(n => n.status === 'pending');
    
    for (const notification of pendingNotifications) {
      await this.processNotification(notification);
    }

    // Remove completed or failed notifications
    this.notificationQueue = this.notificationQueue.filter(n => 
      n.status === 'pending' && n.attempts < n.maxAttempts
    );
  }

  async processNotification(notification) {
    try {
      notification.attempts++;
      
      for (const channelName of notification.channels) {
        const channel = this.notificationChannels.find(c => c.name === channelName);
        
        if (channel && channel.enabled) {
          await channel.handler(notification);
        }
      }

      notification.status = 'sent';
      notification.sentAt = new Date();

      // Update alert with notification record
      await this.updateAlertNotificationStatus(notification);

      logger.info(`Notification sent for alert ${notification.alert.alertId}`);

    } catch (error) {
      logger.error(`Error processing notification ${notification.id}:`, error);
      
      if (notification.attempts >= notification.maxAttempts) {
        notification.status = 'failed';
        logger.error(`Notification failed after ${notification.maxAttempts} attempts: ${notification.id}`);
      }
    }
  }

  async sendEmailNotification(notification) {
    // In a real implementation, this would integrate with an email service
    // For demonstration, we'll simulate email sending
    
    const alert = notification.alert;
    const emailContent = this.generateEmailContent(alert);
    
    logger.info(`EMAIL NOTIFICATION: ${alert.title}`);
    logger.info(`To: security-team@company.com`);
    logger.info(`Subject: [SIEM Alert] ${alert.severity.toUpperCase()} - ${alert.title}`);
    logger.debug(`Content: ${emailContent.substring(0, 100)}...`);

    // Simulate email sending delay
    await new Promise(resolve => setTimeout(resolve, 1000));

    return {
      method: 'email',
      recipient: 'security-team@company.com',
      sentAt: new Date(),
      status: 'sent'
    };
  }

  async sendWebhookNotification(notification) {
    // In a real implementation, this would send HTTP POST to webhook URLs
    
    const alert = notification.alert;
    const webhookPayload = {
      alertId: alert.alertId,
      title: alert.title,
      severity: alert.severity,
      type: alert.type,
      sourceIp: alert.sourceIp,
      timestamp: alert.createdAt,
      description: alert.description,
      confidence: alert.confidence
    };

    logger.info(`WEBHOOK NOTIFICATION: ${alert.title}`);
    logger.debug(`Payload: ${JSON.stringify(webhookPayload, null, 2)}`);

    // Simulate webhook sending
    await new Promise(resolve => setTimeout(resolve, 500));

    return {
      method: 'webhook',
      url: 'https://hooks.company.com/siem-alerts',
      sentAt: new Date(),
      status: 'sent'
    };
  }

  async sendDashboardNotification(notification) {
    // Send real-time notification to dashboard via Socket.IO
    
    const alert = notification.alert;
    
    // This would be handled by the main application's Socket.IO instance
    logger.info(`DASHBOARD NOTIFICATION: ${alert.title}`);

    return {
      method: 'dashboard',
      sentAt: new Date(),
      status: 'sent'
    };
  }

  generateEmailContent(alert) {
    return `
SECURITY ALERT - ${alert.severity.toUpperCase()}

Alert ID: ${alert.alertId}
Title: ${alert.title}
Type: ${alert.type}
Severity: ${alert.severity}
Confidence: ${alert.confidence}%

Description:
${alert.description}

Source IP: ${alert.sourceIp || 'Unknown'}
Affected Assets: ${(alert.affectedAssets || []).join(', ') || 'Unknown'}
Detection Method: ${alert.detectionMethod}

Timestamp: ${alert.createdAt}

Please investigate this alert immediately and take appropriate action.

SIEM Security Operations Center
    `.trim();
  }

  async updateAlertNotificationStatus(notification) {
    try {
      await IntrusionAlert.findByIdAndUpdate(
        notification.alertId,
        {
          $push: {
            notifications: {
              method: notification.channels.join(','),
              recipient: 'security-team',
              sentAt: notification.sentAt,
              status: notification.status
            }
          }
        }
      );
    } catch (error) {
      logger.error('Error updating alert notification status:', error);
    }
  }

  async checkEscalations() {
    try {
      logger.debug('Checking for alert escalations');

      for (const rule of this.escalationRules) {
        const cutoffTime = new Date(Date.now() - rule.escalateAfter);
        
        const alertsToEscalate = await IntrusionAlert.find({
          severity: rule.severity,
          status: 'active',
          createdAt: { $lte: cutoffTime },
          'notifications.method': { $not: { $regex: rule.channels.join('|') } }
        });

        for (const alert of alertsToEscalate) {
          logger.warn(`Escalating alert ${alert.alertId} due to ${rule.severity} severity timeout`);
          await this.queueNotification(alert, rule.channels);
        }
      }

    } catch (error) {
      logger.error('Error checking escalations:', error);
    }
  }

  async sendDailySummary() {
    try {
      logger.info('Generating daily security summary');

      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(0, 0, 0, 0);

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Get yesterday's statistics
      const stats = await IntrusionAlert.aggregate([
        {
          $match: {
            createdAt: { $gte: yesterday, $lt: today }
          }
        },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            critical: { $sum: { $cond: [{ $eq: ['$severity', 'critical'] }, 1, 0] } },
            high: { $sum: { $cond: [{ $eq: ['$severity', 'high'] }, 1, 0] } },
            medium: { $sum: { $cond: [{ $eq: ['$severity', 'medium'] }, 1, 0] } },
            low: { $sum: { $cond: [{ $eq: ['$severity', 'low'] }, 1, 0] } },
            resolved: { $sum: { $cond: [{ $eq: ['$status', 'resolved'] }, 1, 0] } }
          }
        }
      ]);

      const summary = stats[0] || {
        total: 0, critical: 0, high: 0, medium: 0, low: 0, resolved: 0
      };

      const summaryContent = `
Daily Security Summary - ${yesterday.toDateString()}

Total Alerts: ${summary.total}
- Critical: ${summary.critical}
- High: ${summary.high}
- Medium: ${summary.medium}
- Low: ${summary.low}

Resolved: ${summary.resolved}
Resolution Rate: ${summary.total > 0 ? Math.round((summary.resolved / summary.total) * 100) : 0}%

Please review the security dashboard for detailed analysis.
      `.trim();

      logger.info('DAILY SUMMARY EMAIL');
      logger.info(summaryContent);

    } catch (error) {
      logger.error('Error generating daily summary:', error);
    }
  }

  async cleanupOldNotifications() {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - 30); // Keep notifications for 30 days

      const result = await IntrusionAlert.updateMany(
        {},
        {
          $pull: {
            notifications: {
              sentAt: { $lt: cutoffDate }
            }
          }
        }
      );

      logger.info(`Cleaned up old notifications from ${result.modifiedCount} alerts`);
    } catch (error) {
      logger.error('Error cleaning up old notifications:', error);
    }
  }

  calculatePriority(severity) {
    const priorityMap = {
      'critical': 1,
      'high': 2,
      'medium': 3,
      'low': 4
    };
    return priorityMap[severity] || 4;
  }

  updateNotificationChannel(channelName, enabled) {
    const channel = this.notificationChannels.find(c => c.name === channelName);
    if (channel) {
      channel.enabled = enabled;
      logger.info(`Notification channel ${channelName} ${enabled ? 'enabled' : 'disabled'}`);
    }
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      queueSize: this.notificationQueue.length,
      channels: this.notificationChannels.map(c => ({
        name: c.name,
        enabled: c.enabled
      })),
      escalationRules: this.escalationRules.length
    };
  }
}

module.exports = new NotificationService();