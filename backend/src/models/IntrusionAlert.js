const mongoose = require('mongoose');

const intrusionAlertSchema = new mongoose.Schema({
  alertId: {
    type: String,
    unique: true,
    required: true,
    default: () => `ALERT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  },
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  description: {
    type: String,
    required: true,
    maxlength: [1000, 'Description cannot exceed 1000 characters']
  },
  severity: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    required: true,
    index: true
  },
  type: {
    type: String,
    enum: [
      'brute_force',
      'sql_injection',
      'xss_attack',
      'ddos',
      'malware',
      'unauthorized_access',
      'data_exfiltration',
      'privilege_escalation',
      'anomaly',
      'policy_violation',
      'other'
    ],
    required: true,
    index: true
  },
  status: {
    type: String,
    enum: ['active', 'investigating', 'resolved', 'false_positive'],
    default: 'active',
    index: true
  },
  sourceIp: {
    type: String,
    trim: true,
    match: [/^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$|^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/, 'Invalid IP address format']
  },
  targetIp: {
    type: String,
    trim: true,
    match: [/^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$|^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/, 'Invalid IP address format']
  },
  affectedAssets: [{
    type: String,
    trim: true
  }],
  attackVector: {
    type: String,
    trim: true
  },
  confidence: {
    type: Number,
    min: 0,
    max: 100,
    default: 50
  },
  riskScore: {
    type: Number,
    min: 0,
    max: 10,
    default: 5
  },
  relatedLogs: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Log'
  }],
  correlationId: {
    type: String,
    trim: true,
    index: true
  },
  detectionMethod: {
    type: String,
    enum: ['signature', 'anomaly', 'behavioral', 'ml', 'correlation'],
    required: true
  },
  mitigationSteps: [{
    step: String,
    completed: {
      type: Boolean,
      default: false
    },
    completedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    completedAt: Date
  }],
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  tags: [{
    type: String,
    trim: true
  }],
  evidence: [{
    type: {
      type: String,
      enum: ['log', 'file', 'network_capture', 'screenshot', 'other']
    },
    description: String,
    path: String,
    hash: String,
    timestamp: {
      type: Date,
      default: Date.now
    }
  }],
  timeline: [{
    timestamp: {
      type: Date,
      default: Date.now
    },
    event: String,
    details: String,
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }],
  notifications: [{
    method: {
      type: String,
      enum: ['email', 'sms', 'webhook', 'dashboard']
    },
    recipient: String,
    sentAt: Date,
    status: {
      type: String,
      enum: ['pending', 'sent', 'failed'],
      default: 'pending'
    }
  }],
  resolvedAt: Date,
  resolvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  resolutionNotes: String,
  falsePositiveReason: String
}, {
  timestamps: true
});

// Indexes for performance
intrusionAlertSchema.index({ alertId: 1 });
intrusionAlertSchema.index({ createdAt: -1 });
intrusionAlertSchema.index({ severity: 1, status: 1 });
intrusionAlertSchema.index({ type: 1, createdAt: -1 });
intrusionAlertSchema.index({ sourceIp: 1 });
intrusionAlertSchema.index({ status: 1, assignedTo: 1 });

// Text index for searching
intrusionAlertSchema.index({
  title: 'text',
  description: 'text',
  tags: 'text'
});

// Virtual for alert age
intrusionAlertSchema.virtual('ageInHours').get(function() {
  return Math.floor((Date.now() - this.createdAt) / (1000 * 60 * 60));
});

// Static method to get active alerts
intrusionAlertSchema.statics.getActiveAlerts = function() {
  return this.find({ status: 'active' }).sort({ createdAt: -1 });
};

// Static method to get alerts by severity
intrusionAlertSchema.statics.getAlertsBySeverity = function(severity) {
  return this.find({ severity }).sort({ createdAt: -1 });
};

// Static method to get unassigned alerts
intrusionAlertSchema.statics.getUnassignedAlerts = function() {
  return this.find({ assignedTo: { $exists: false }, status: 'active' }).sort({ severity: -1, createdAt: -1 });
};

// Method to assign alert to user
intrusionAlertSchema.methods.assignTo = function(userId) {
  this.assignedTo = userId;
  this.timeline.push({
    event: 'Alert Assigned',
    details: `Alert assigned to user ${userId}`,
    user: userId
  });
  return this.save();
};

// Method to update status
intrusionAlertSchema.methods.updateStatus = function(newStatus, userId, notes) {
  const oldStatus = this.status;
  this.status = newStatus;
  
  this.timeline.push({
    event: 'Status Changed',
    details: `Status changed from ${oldStatus} to ${newStatus}${notes ? ': ' + notes : ''}`,
    user: userId
  });
  
  if (newStatus === 'resolved') {
    this.resolvedAt = new Date();
    this.resolvedBy = userId;
    if (notes) this.resolutionNotes = notes;
  }
  
  return this.save();
};

// Method to add evidence
intrusionAlertSchema.methods.addEvidence = function(evidence) {
  this.evidence.push(evidence);
  this.timeline.push({
    event: 'Evidence Added',
    details: `Evidence added: ${evidence.description}`,
    user: evidence.addedBy
  });
  return this.save();
};

// Pre-save middleware to calculate risk score
intrusionAlertSchema.pre('save', function(next) {
  // Calculate risk score based on severity and confidence
  const severityWeight = {
    'low': 2,
    'medium': 5,
    'high': 8,
    'critical': 10
  };
  
  const baseScore = severityWeight[this.severity] || 5;
  this.riskScore = Math.min(10, (baseScore * (this.confidence / 100)));
  
  next();
});

module.exports = mongoose.model('IntrusionAlert', intrusionAlertSchema);