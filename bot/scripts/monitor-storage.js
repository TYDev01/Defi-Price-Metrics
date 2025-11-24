#!/usr/bin/env node
/**
 * AWS Storage Monitor Script
 * Monitors disk usage and triggers cleanup when threshold is reached
 * Can be used as a standalone monitor or integrated into the bot
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Configuration
const CONFIG = {
  threshold: 90, // Trigger cleanup at 90% usage
  checkIntervalMs: 3600000, // Check every hour (3600000ms = 1 hour)
  cleanupScriptPath: path.join(__dirname, 'cleanup-storage.sh'),
  logFile: path.join(__dirname, '../logs/storage-monitor.log'),
  alertWebhook: process.env.STORAGE_ALERT_WEBHOOK, // Optional: webhook for alerts
};

/**
 * Get disk usage percentage
 */
function getDiskUsage() {
  try {
    const output = execSync("df -h / | awk 'NR==2 {print $5}' | sed 's/%//'", {
      encoding: 'utf-8',
    }).trim();
    
    return parseInt(output, 10);
  } catch (error) {
    console.error('Error getting disk usage:', error.message);
    return 0;
  }
}

/**
 * Get detailed disk information
 */
function getDiskInfo() {
  try {
    const output = execSync("df -h / | awk 'NR==2 {print $2,$3,$4,$5}'", {
      encoding: 'utf-8',
    }).trim();
    
    const [total, used, available, percentage] = output.split(' ');
    
    return {
      total,
      used,
      available,
      percentage: parseInt(percentage.replace('%', ''), 10),
    };
  } catch (error) {
    console.error('Error getting disk info:', error.message);
    return null;
  }
}

/**
 * Log message to file and console
 */
function log(message, level = 'INFO') {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] [${level}] ${message}`;
  
  console.log(logMessage);
  
  // Ensure log directory exists
  const logDir = path.dirname(CONFIG.logFile);
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
  
  // Append to log file
  fs.appendFileSync(CONFIG.logFile, logMessage + '\n');
}

/**
 * Send alert (Telegram/Slack/etc)
 */
async function sendAlert(message) {
  if (!CONFIG.alertWebhook) return;
  
  try {
    const response = await fetch(CONFIG.alertWebhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: ` AWS Storage Alert: ${message}`,
      }),
    });
    
    if (!response.ok) {
      log(`Failed to send alert: ${response.statusText}`, 'WARN');
    }
  } catch (error) {
    log(`Error sending alert: ${error.message}`, 'ERROR');
  }
}

/**
 * Run cleanup script
 */
function runCleanup() {
  log('Running automated cleanup...', 'INFO');
  
  try {
    // Make script executable
    execSync(`chmod +x ${CONFIG.cleanupScriptPath}`);
    
    // Run cleanup script in auto mode
    const output = execSync(`${CONFIG.cleanupScriptPath} --auto`, {
      encoding: 'utf-8',
      stdio: 'pipe',
    });
    
    log('Cleanup completed successfully', 'INFO');
    log(output, 'DEBUG');
    
    return true;
  } catch (error) {
    log(`Cleanup failed: ${error.message}`, 'ERROR');
    return false;
  }
}

/**
 * Check storage and trigger cleanup if needed
 */
async function checkStorage() {
  const diskInfo = getDiskInfo();
  
  if (!diskInfo) {
    log('Failed to get disk information', 'ERROR');
    return;
  }
  
  const usage = diskInfo.percentage;
  
  log(`Disk usage: ${usage}% (${diskInfo.used}/${diskInfo.total} used, ${diskInfo.available} available)`, 'INFO');
  
  if (usage >= CONFIG.threshold) {
    log(` WARNING: Disk usage at ${usage}% exceeds threshold of ${CONFIG.threshold}%`, 'WARN');
    
    // Send alert
    await sendAlert(
      `Disk usage at ${usage}% (threshold: ${CONFIG.threshold}%). ` +
      `Used: ${diskInfo.used}/${diskInfo.total}, Available: ${diskInfo.available}`
    );
    
    // Run cleanup
    const cleanupSuccess = runCleanup();
    
    // Check usage after cleanup
    const newUsage = getDiskUsage();
    const freed = usage - newUsage;
    
    if (cleanupSuccess) {
      log(`Cleanup freed ${freed}% of disk space. New usage: ${newUsage}%`, 'INFO');
      await sendAlert(`Cleanup completed. Freed ${freed}%. New usage: ${newUsage}%`);
    } else {
      log('Cleanup failed or did not free enough space', 'ERROR');
      await sendAlert(` WARNING: Cleanup failed. Manual intervention may be required.`);
    }
    
    // If still above threshold, send critical alert
    if (newUsage >= CONFIG.threshold) {
      log(` CRITICAL: Disk usage still at ${newUsage}% after cleanup`, 'ERROR');
      await sendAlert(` WARNING: Disk usage still at ${newUsage}% after cleanup. Manual cleanup required!`);
    }
  } else {
    log(`Disk usage within limits (${usage}% < ${CONFIG.threshold}%)`, 'INFO');
  }
}

/**
 * Start monitoring in daemon mode
 */
function startMonitoring() {
  log('Starting storage monitoring daemon', 'INFO');
  log(`Threshold: ${CONFIG.threshold}%`, 'INFO');
  log(`Check interval: ${CONFIG.checkIntervalMs / 1000 / 60} minutes`, 'INFO');
  
  // Initial check
  checkStorage();
  
  // Periodic checks
  setInterval(() => {
    checkStorage();
  }, CONFIG.checkIntervalMs);
}

/**
 * Display current status
 */
function showStatus() {
  console.log(' AWS Storage Status\n');
  
  const diskInfo = getDiskInfo();
  
  if (!diskInfo) {
    console.error(' Failed to get disk information');
    return;
  }
  
  console.log(`Total: ${diskInfo.total}`);
  console.log(`Used: ${diskInfo.used}`);
  console.log(`Available: ${diskInfo.available}`);
  console.log(`Usage: ${diskInfo.percentage}%`);
  console.log(`Threshold: ${CONFIG.threshold}%`);
  
  if (diskInfo.percentage >= CONFIG.threshold) {
    console.log('\n WARNING: Storage usage exceeds threshold!');
    console.log(`Run: node ${__filename} --cleanup`);
  } else {
    console.log('\n Storage usage is within acceptable limits');
  }
}

// CLI handling
const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  console.log(`
AWS Storage Monitor

Usage:
  node monitor-storage.js [options]

Options:
  --status          Show current disk usage status
  --check           Run a single storage check
  --cleanup         Trigger cleanup immediately
  --monitor         Start monitoring daemon (continuous)
  --threshold <n>   Set threshold percentage (default: 90)
  --help, -h        Show this help message

Environment Variables:
  STORAGE_ALERT_WEBHOOK  Webhook URL for alerts (optional)

Examples:
  node monitor-storage.js --status
  node monitor-storage.js --check
  node monitor-storage.js --cleanup
  node monitor-storage.js --monitor --threshold 85
  `);
  process.exit(0);
}

// Handle commands
if (args.includes('--threshold')) {
  const thresholdIndex = args.indexOf('--threshold');
  const thresholdValue = parseInt(args[thresholdIndex + 1], 10);
  if (!isNaN(thresholdValue) && thresholdValue > 0 && thresholdValue <= 100) {
    CONFIG.threshold = thresholdValue;
  }
}

if (args.includes('--status')) {
  showStatus();
} else if (args.includes('--check')) {
  checkStorage().then(() => process.exit(0));
} else if (args.includes('--cleanup')) {
  const success = runCleanup();
  process.exit(success ? 0 : 1);
} else if (args.includes('--monitor')) {
  startMonitoring();
} else {
  // Default: show status
  showStatus();
}
