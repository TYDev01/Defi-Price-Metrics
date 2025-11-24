#!/bin/bash
#
# Setup Storage Monitoring for AWS EC2
# Run this script once to configure automated storage monitoring
#

set -e

echo "Setting up AWS Storage Monitoring"
echo ""

# Make scripts executable
chmod +x scripts/cleanup-storage.sh

# Create logs directory
mkdir -p logs

# Test the monitor
echo "Testing storage monitor..."
node scripts/monitor-storage.js --status
echo ""

# Ask about setup method
echo "Choose setup method:"
echo "1) Cron job (recommended for simple setup)"
echo "2) systemd service (recommended for production)"
echo "3) Manual (I'll set it up myself)"
read -p "Enter choice (1-3): " choice

case $choice in
  1)
    echo ""
    echo "Setting up cron job..."
    
    # Check every hour
    CRON_CMD="cd $(pwd) && node scripts/monitor-storage.js --check >> logs/storage-monitor.log 2>&1"
    
    # Add to crontab
    (crontab -l 2>/dev/null | grep -v "monitor-storage.js"; echo "15 * * * * $CRON_CMD") | crontab -
    
    echo "Cron job installed!"
    echo "Storage will be checked every hour at :15"
    echo ""
    echo "View logs: tail -f logs/storage-monitor.log"
    echo "List cron jobs: crontab -l"
    echo "Remove cron job: crontab -e"
    ;;
    
  2)
    echo ""
    echo "Creating systemd service..."
    
    SERVICE_FILE="/etc/systemd/system/storage-monitor.service"
    
    cat > /tmp/storage-monitor.service << EOF
[Unit]
Description=Storage Monitor Service
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$(pwd)
ExecStart=/usr/bin/node $(pwd)/scripts/monitor-storage.js --monitor --threshold 90
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF
    
    echo "Service file created. To install:"
    echo ""
    echo "  sudo cp /tmp/storage-monitor.service $SERVICE_FILE"
    echo "  sudo systemctl daemon-reload"
    echo "  sudo systemctl enable storage-monitor"
    echo "  sudo systemctl start storage-monitor"
    echo ""
    echo "Then check status:"
    echo "  sudo systemctl status storage-monitor"
    echo "  sudo journalctl -u storage-monitor -f"
    ;;
    
  3)
    echo ""
    echo "Manual setup selected."
    echo ""
    echo "To run manually:"
    echo "  node scripts/monitor-storage.js --check"
    echo ""
    echo "To start monitoring daemon:"
    echo "  node scripts/monitor-storage.js --monitor"
    echo ""
    echo "See STORAGE_MONITOR_README.md for more options."
    ;;
    
  *)
    echo "Invalid choice. Exiting."
    exit 1
    ;;
esac

echo ""
echo " Storage monitoring setup complete!"
echo ""
echo " See STORAGE_MONITOR_README.md for full documentation"
