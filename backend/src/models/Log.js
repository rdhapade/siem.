const mongoose = require('mongoose');

const logSchema = new mongoose.Schema({
  timestamp: {
    type: Date,
    default: Date.now,
    required: true,
    index: true
  },
  level: {
    type: String,
    enum: ['debug', 'info', 'warn', 'error', 'critical'],
    required: true,
    index: true
  },
  source: {
    type: String,
    required: true,
    trim: true,
    maxlength: [100, 'Source cannot exceed 100 characters'],
    index: true
  },
  message: {
    type: String,
    required: true,
    maxlength: [1000, 'Message cannot exceed 1000 characters']
  },
  details: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  category: {
    type: String,
    enum: ['security', 'system', 'application', 'network', 'database'],
    default: 'system',
    index: true
  },
  severity: {
    type: Number,
    min: 1,
    max: 10,
    default: 5
  },
  sourceIp: {
    type: String,
    trim: true,
    match: [/^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$|^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/, 'Invalid IP address format']
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  sessionId: {
    type: String,
    trim: true
  },
  userAgent: {
    type: String,
    trim: true
  },
  tags: [{
    type: String,
    trim: true
  }],
  processed: {
    type: Boolean,
    default: false,
    index: true
  },
  correlationId: {
    type: String,
    trim: true,
    index: true
  },
  geoLocation: {
    country: String,
    city: String,
    latitude: Number,
    longitude: Number
  },
  threatLevel: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'low'
  },
  alertGenerated: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Compound indexes for common queries
logSchema.index({ timestamp: -1, level: 1 });
logSchema.index({ source: 1, timestamp: -1 });
logSchema.index({ category: 1, severity: -1 });
logSchema.index({ sourceIp: 1, timestamp: -1 });
logSchema.index({ processed: 1, timestamp: 1 });

// Text index for searching
logSchema.index({
  message: 'text',
  source: 'text',
  'details.description': 'text'
});

// TTL index to automatically delete old logs (optional)
// Uncomment to enable automatic deletion after 90 days
// logSchema.index({ timestamp: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

// Static method to get logs by date range
logSchema.statics.getLogsByDateRange = function(startDate, endDate, filters = {}) {
  const query = {
    timestamp: {
      $gte: startDate,
      $lte: endDate
    },
    ...filters
  };
  
  return this.find(query).sort({ timestamp: -1 });
};

// Static method to get logs by severity
logSchema.statics.getLogsBySeverity = function(minSeverity) {
  return this.find({ severity: { $gte: minSeverity } }).sort({ timestamp: -1 });
};

// Static method to get unprocessed logs
logSchema.statics.getUnprocessedLogs = function() {
  return this.find({ processed: false }).sort({ timestamp: 1 });
};

// Method to mark log as processed
logSchema.methods.markAsProcessed = function() {
  this.processed = true;
  return this.save();
};

// Pre-save middleware to set threat level based on severity and category
logSchema.pre('save', function(next) {
  if (this.category === 'security' && this.severity >= 8) {
    this.threatLevel = 'critical';
  } else if (this.severity >= 7) {
    this.threatLevel = 'high';
  } else if (this.severity >= 5) {
    this.threatLevel = 'medium';
  } else {
    this.threatLevel = 'low';
  }
  
  next();
});

module.exports = mongoose.model('Log', logSchema);