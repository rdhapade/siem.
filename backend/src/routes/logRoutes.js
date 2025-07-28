const express = require('express');
const Log = require('../models/Log');
const { verifyToken } = require('./authRoutes');
const logger = require('../utils/logger');
const { body, query, validationResult } = require('express-validator');

const router = express.Router();

// Apply authentication to all routes
router.use(verifyToken);

// Validation middleware
const validateLogCreation = [
  body('level').isIn(['debug', 'info', 'warn', 'error', 'critical']).withMessage('Invalid log level'),
  body('source').trim().isLength({ min: 1, max: 100 }).withMessage('Source must be between 1 and 100 characters'),
  body('message').trim().isLength({ min: 1, max: 1000 }).withMessage('Message must be between 1 and 1000 characters'),
  body('category').optional().isIn(['security', 'system', 'application', 'network', 'database']).withMessage('Invalid category'),
  body('severity').optional().isInt({ min: 1, max: 10 }).withMessage('Severity must be between 1 and 10')
];

const validateLogQuery = [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('level').optional().isIn(['debug', 'info', 'warn', 'error', 'critical']).withMessage('Invalid log level'),
  query('category').optional().isIn(['security', 'system', 'application', 'network', 'database']).withMessage('Invalid category'),
  query('startDate').optional().isISO8601().withMessage('Invalid start date format'),
  query('endDate').optional().isISO8601().withMessage('Invalid end date format')
];

// Create new log entry
router.post('/', validateLogCreation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation Error',
        details: errors.array()
      });
    }

    const logData = {
      ...req.body,
      userId: req.user._id,
      sourceIp: req.ip,
      userAgent: req.get('User-Agent')
    };

    const log = new Log(logData);
    await log.save();

    // Emit real-time log event
    const io = req.app.get('io');
    if (io) {
      io.to('security-monitoring').emit('new-log', log);
    }

    logger.info(`New log entry created: ${log._id}`);

    res.status(201).json({
      message: 'Log entry created successfully',
      log
    });

  } catch (error) {
    logger.error('Log creation error:', error);
    res.status(500).json({
      error: 'Log Creation Failed',
      message: 'An error occurred while creating log entry'
    });
  }
});

// Get logs with filtering and pagination
router.get('/', validateLogQuery, async (req, res) => {
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
      level,
      category,
      source,
      startDate,
      endDate,
      search,
      severity
    } = req.query;

    // Build query
    const query = {};

    if (level) query.level = level;
    if (category) query.category = category;
    if (source) query.source = new RegExp(source, 'i');
    if (severity) query.severity = { $gte: parseInt(severity) };

    // Date range filter
    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = new Date(startDate);
      if (endDate) query.timestamp.$lte = new Date(endDate);
    }

    // Text search
    if (search) {
      query.$text = { $search: search };
    }

    // Execute query with pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const logs = await Log.find(query)
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('userId', 'name email');

    // Get total count for pagination
    const total = await Log.countDocuments(query);

    res.json({
      logs,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
        total,
        limit: parseInt(limit)
      }
    });

  } catch (error) {
    logger.error('Log retrieval error:', error);
    res.status(500).json({
      error: 'Log Retrieval Failed',
      message: 'An error occurred while retrieving logs'
    });
  }
});

// Get log by ID
router.get('/:id', async (req, res) => {
  try {
    const log = await Log.findById(req.params.id).populate('userId', 'name email');
    
    if (!log) {
      return res.status(404).json({
        error: 'Log Not Found',
        message: 'Log entry not found'
      });
    }

    res.json({ log });

  } catch (error) {
    logger.error('Log retrieval error:', error);
    res.status(500).json({
      error: 'Log Retrieval Failed',
      message: 'An error occurred while retrieving log'
    });
  }
});

// Update log entry
router.put('/:id', validateLogCreation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation Error',
        details: errors.array()
      });
    }

    const log = await Log.findByIdAndUpdate(
      req.params.id,
      { ...req.body, updatedBy: req.user._id },
      { new: true, runValidators: true }
    );

    if (!log) {
      return res.status(404).json({
        error: 'Log Not Found',
        message: 'Log entry not found'
      });
    }

    logger.info(`Log entry updated: ${log._id} by ${req.user.email}`);

    res.json({
      message: 'Log entry updated successfully',
      log
    });

  } catch (error) {
    logger.error('Log update error:', error);
    res.status(500).json({
      error: 'Log Update Failed',
      message: 'An error occurred while updating log entry'
    });
  }
});

// Delete log entry
router.delete('/:id', async (req, res) => {
  try {
    const log = await Log.findByIdAndDelete(req.params.id);

    if (!log) {
      return res.status(404).json({
        error: 'Log Not Found',
        message: 'Log entry not found'
      });
    }

    logger.info(`Log entry deleted: ${req.params.id} by ${req.user.email}`);

    res.json({
      message: 'Log entry deleted successfully'
    });

  } catch (error) {
    logger.error('Log deletion error:', error);
    res.status(500).json({
      error: 'Log Deletion Failed',
      message: 'An error occurred while deleting log entry'
    });
  }
});

// Get log statistics
router.get('/stats/summary', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    // Build date filter
    const dateFilter = {};
    if (startDate || endDate) {
      dateFilter.timestamp = {};
      if (startDate) dateFilter.timestamp.$gte = new Date(startDate);
      if (endDate) dateFilter.timestamp.$lte = new Date(endDate);
    }

    // Aggregate statistics
    const stats = await Log.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          byLevel: {
            $push: {
              level: '$level',
              count: 1
            }
          },
          byCategory: {
            $push: {
              category: '$category',
              count: 1
            }
          },
          avgSeverity: { $avg: '$severity' },
          maxSeverity: { $max: '$severity' }
        }
      }
    ]);

    // Get level distribution
    const levelStats = await Log.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: '$level',
          count: { $sum: 1 }
        }
      }
    ]);

    // Get category distribution
    const categoryStats = await Log.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 }
        }
      }
    ]);

    res.json({
      summary: stats[0] || { total: 0, avgSeverity: 0, maxSeverity: 0 },
      levelDistribution: levelStats,
      categoryDistribution: categoryStats
    });

  } catch (error) {
    logger.error('Log statistics error:', error);
    res.status(500).json({
      error: 'Statistics Retrieval Failed',
      message: 'An error occurred while retrieving log statistics'
    });
  }
});

// Mark logs as processed
router.post('/process', async (req, res) => {
  try {
    const { logIds } = req.body;

    if (!Array.isArray(logIds) || logIds.length === 0) {
      return res.status(400).json({
        error: 'Invalid Input',
        message: 'logIds must be a non-empty array'
      });
    }

    const result = await Log.updateMany(
      { _id: { $in: logIds } },
      { processed: true, processedBy: req.user._id, processedAt: new Date() }
    );

    logger.info(`${result.modifiedCount} logs marked as processed by ${req.user.email}`);

    res.json({
      message: `${result.modifiedCount} logs marked as processed`,
      modifiedCount: result.modifiedCount
    });

  } catch (error) {
    logger.error('Log processing error:', error);
    res.status(500).json({
      error: 'Log Processing Failed',
      message: 'An error occurred while processing logs'
    });
  }
});

module.exports = router;