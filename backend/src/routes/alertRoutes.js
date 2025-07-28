const express = require('express');
const IntrusionAlert = require('../models/IntrusionAlert');
const { verifyToken } = require('./authRoutes');
const logger = require('../utils/logger');
const { body, query, validationResult } = require('express-validator');

const router = express.Router();

// Apply authentication to all routes
router.use(verifyToken);

// Validation middleware
const validateAlertCreation = [
  body('title').trim().isLength({ min: 1, max: 200 }).withMessage('Title must be between 1 and 200 characters'),
  body('description').trim().isLength({ min: 1, max: 1000 }).withMessage('Description must be between 1 and 1000 characters'),
  body('severity').isIn(['low', 'medium', 'high', 'critical']).withMessage('Invalid severity level'),
  body('type').isIn([
    'brute_force', 'sql_injection', 'xss_attack', 'ddos', 'malware',
    'unauthorized_access', 'data_exfiltration', 'privilege_escalation',
    'anomaly', 'policy_violation', 'other'
  ]).withMessage('Invalid alert type'),
  body('confidence').optional().isInt({ min: 0, max: 100 }).withMessage('Confidence must be between 0 and 100')
];

const validateAlertQuery = [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('severity').optional().isIn(['low', 'medium', 'high', 'critical']).withMessage('Invalid severity level'),
  query('status').optional().isIn(['active', 'investigating', 'resolved', 'false_positive']).withMessage('Invalid status'),
  query('type').optional().isIn([
    'brute_force', 'sql_injection', 'xss_attack', 'ddos', 'malware',
    'unauthorized_access', 'data_exfiltration', 'privilege_escalation',
    'anomaly', 'policy_violation', 'other'
  ]).withMessage('Invalid alert type')
];

// Create new alert
router.post('/', validateAlertCreation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation Error',
        details: errors.array()
      });
    }

    const alert = new IntrusionAlert({
      ...req.body,
      detectionMethod: req.body.detectionMethod || 'signature'
    });

    await alert.save();

    // Emit real-time alert event
    const io = req.app.get('io');
    if (io) {
      io.to('security-monitoring').emit('new-alert', alert);
    }

    logger.warn(`New security alert created: ${alert.alertId} - ${alert.title}`);

    res.status(201).json({
      message: 'Alert created successfully',
      alert
    });

  } catch (error) {
    logger.error('Alert creation error:', error);
    res.status(500).json({
      error: 'Alert Creation Failed',
      message: 'An error occurred while creating alert'
    });
  }
});

// Get alerts with filtering and pagination
router.get('/', validateAlertQuery, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation Error',
        details: errors.array()
      });
    }

    const {
      page = 1,
      limit = 50,
      severity,
      status,
      type,
      assignedTo,
      search,
      startDate,
      endDate
    } = req.query;

    // Build query
    const query = {};

    if (severity) query.severity = severity;
    if (status) query.status = status;
    if (type) query.type = type;
    if (assignedTo) query.assignedTo = assignedTo;

    // Date range filter
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    // Text search
    if (search) {
      query.$text = { $search: search };
    }

    // Execute query with pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const alerts = await IntrusionAlert.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('assignedTo', 'name email')
      .populate('resolvedBy', 'name email')
      .populate('relatedLogs');

    // Get total count for pagination
    const total = await IntrusionAlert.countDocuments(query);

    res.json({
      alerts,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
        total,
        limit: parseInt(limit)
      }
    });

  } catch (error) {
    logger.error('Alert retrieval error:', error);
    res.status(500).json({
      error: 'Alert Retrieval Failed',
      message: 'An error occurred while retrieving alerts'
    });
  }
});

// Get alert by ID
router.get('/:id', async (req, res) => {
  try {
    const alert = await IntrusionAlert.findById(req.params.id)
      .populate('assignedTo', 'name email')
      .populate('resolvedBy', 'name email')
      .populate('relatedLogs')
      .populate('timeline.user', 'name email');
    
    if (!alert) {
      return res.status(404).json({
        error: 'Alert Not Found',
        message: 'Alert not found'
      });
    }

    res.json({ alert });

  } catch (error) {
    logger.error('Alert retrieval error:', error);
    res.status(500).json({
      error: 'Alert Retrieval Failed',
      message: 'An error occurred while retrieving alert'
    });
  }
});

// Update alert status
router.put('/:id/status', async (req, res) => {
  try {
    const { status, notes } = req.body;

    if (!['active', 'investigating', 'resolved', 'false_positive'].includes(status)) {
      return res.status(400).json({
        error: 'Invalid Status',
        message: 'Invalid status value'
      });
    }

    const alert = await IntrusionAlert.findById(req.params.id);
    if (!alert) {
      return res.status(404).json({
        error: 'Alert Not Found',
        message: 'Alert not found'
      });
    }

    await alert.updateStatus(status, req.user._id, notes);

    // Emit real-time update
    const io = req.app.get('io');
    if (io) {
      io.to('security-monitoring').emit('alert-updated', alert);
    }

    logger.info(`Alert ${alert.alertId} status updated to ${status} by ${req.user.email}`);

    res.json({
      message: 'Alert status updated successfully',
      alert
    });

  } catch (error) {
    logger.error('Alert status update error:', error);
    res.status(500).json({
      error: 'Status Update Failed',
      message: 'An error occurred while updating alert status'
    });
  }
});

// Assign alert to user
router.put('/:id/assign', async (req, res) => {
  try {
    const { userId } = req.body;

    const alert = await IntrusionAlert.findById(req.params.id);
    if (!alert) {
      return res.status(404).json({
        error: 'Alert Not Found',
        message: 'Alert not found'
      });
    }

    await alert.assignTo(userId);

    // Emit real-time update
    const io = req.app.get('io');
    if (io) {
      io.to('security-monitoring').emit('alert-assigned', alert);
    }

    logger.info(`Alert ${alert.alertId} assigned to user ${userId} by ${req.user.email}`);

    res.json({
      message: 'Alert assigned successfully',
      alert
    });

  } catch (error) {
    logger.error('Alert assignment error:', error);
    res.status(500).json({
      error: 'Assignment Failed',
      message: 'An error occurred while assigning alert'
    });
  }
});

// Add evidence to alert
router.post('/:id/evidence', async (req, res) => {
  try {
    const { type, description, path, hash } = req.body;

    if (!type || !description) {
      return res.status(400).json({
        error: 'Missing Required Fields',
        message: 'Type and description are required'
      });
    }

    const alert = await IntrusionAlert.findById(req.params.id);
    if (!alert) {
      return res.status(404).json({
        error: 'Alert Not Found',
        message: 'Alert not found'
      });
    }

    const evidence = {
      type,
      description,
      path,
      hash,
      addedBy: req.user._id
    };

    await alert.addEvidence(evidence);

    logger.info(`Evidence added to alert ${alert.alertId} by ${req.user.email}`);

    res.json({
      message: 'Evidence added successfully',
      alert
    });

  } catch (error) {
    logger.error('Evidence addition error:', error);
    res.status(500).json({
      error: 'Evidence Addition Failed',
      message: 'An error occurred while adding evidence'
    });
  }
});

// Get alert statistics
router.get('/stats/summary', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    // Build date filter
    const dateFilter = {};
    if (startDate || endDate) {
      dateFilter.createdAt = {};
      if (startDate) dateFilter.createdAt.$gte = new Date(startDate);
      if (endDate) dateFilter.createdAt.$lte = new Date(endDate);
    }

    // Get overall statistics
    const totalAlerts = await IntrusionAlert.countDocuments(dateFilter);
    const activeAlerts = await IntrusionAlert.countDocuments({ ...dateFilter, status: 'active' });
    const resolvedAlerts = await IntrusionAlert.countDocuments({ ...dateFilter, status: 'resolved' });

    // Get severity distribution
    const severityStats = await IntrusionAlert.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: '$severity',
          count: { $sum: 1 }
        }
      }
    ]);

    // Get type distribution
    const typeStats = await IntrusionAlert.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 }
        }
      }
    ]);

    // Get average resolution time for resolved alerts
    const resolutionStats = await IntrusionAlert.aggregate([
      { 
        $match: { 
          ...dateFilter, 
          status: 'resolved',
          resolvedAt: { $exists: true }
        }
      },
      {
        $project: {
          resolutionTime: {
            $divide: [
              { $subtract: ['$resolvedAt', '$createdAt'] },
              1000 * 60 * 60 // Convert to hours
            ]
          }
        }
      },
      {
        $group: {
          _id: null,
          avgResolutionTime: { $avg: '$resolutionTime' },
          minResolutionTime: { $min: '$resolutionTime' },
          maxResolutionTime: { $max: '$resolutionTime' }
        }
      }
    ]);

    res.json({
      summary: {
        total: totalAlerts,
        active: activeAlerts,
        resolved: resolvedAlerts,
        investigating: await IntrusionAlert.countDocuments({ ...dateFilter, status: 'investigating' }),
        falsePositive: await IntrusionAlert.countDocuments({ ...dateFilter, status: 'false_positive' })
      },
      severityDistribution: severityStats,
      typeDistribution: typeStats,
      resolutionStats: resolutionStats[0] || {
        avgResolutionTime: 0,
        minResolutionTime: 0,
        maxResolutionTime: 0
      }
    });

  } catch (error) {
    logger.error('Alert statistics error:', error);
    res.status(500).json({
      error: 'Statistics Retrieval Failed',
      message: 'An error occurred while retrieving alert statistics'
    });
  }
});

// Get unassigned alerts
router.get('/unassigned/list', async (req, res) => {
  try {
    const alerts = await IntrusionAlert.getUnassignedAlerts();
    
    res.json({
      alerts,
      count: alerts.length
    });

  } catch (error) {
    logger.error('Unassigned alerts retrieval error:', error);
    res.status(500).json({
      error: 'Retrieval Failed',
      message: 'An error occurred while retrieving unassigned alerts'
    });
  }
});

module.exports = router;