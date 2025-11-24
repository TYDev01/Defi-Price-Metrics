#!/bin/bash
#
# AWS EC2 Storage Cleanup Script
# Monitors disk usage and cleans up when storage reaches 90% capacity
# Can be run manually or as a cron job
#

set -e

# Configuration
THRESHOLD=90
LOG_DIR="/var/log"
TEMP_DIRS="/tmp /var/tmp"
OLD_LOGS_DAYS=7
DOCKER_CLEANUP=true
APT_CLEANUP=true

# Colors for output
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

# Function to get disk usage percentage
get_disk_usage() {
    df -h / | awk 'NR==2 {print $5}' | sed 's/%//'
}

# Function to print colored output
print_status() {
    local color=$1
    local message=$2
    echo -e "${color}${message}${NC}"
}

# Function to clean old logs
clean_old_logs() {
    print_status "$YELLOW" "  Cleaning logs older than $OLD_LOGS_DAYS days..."
    
    # Clean application logs
    if [ -d "logs" ]; then
        find logs -name "*.log" -type f -mtime +$OLD_LOGS_DAYS -delete 2>/dev/null || true
        print_status "$GREEN" "   ✓ Application logs cleaned"
    fi
    
    # Clean system logs (requires sudo)
    if [ "$EUID" -eq 0 ]; then
        find $LOG_DIR -name "*.log" -type f -mtime +$OLD_LOGS_DAYS -delete 2>/dev/null || true
        find $LOG_DIR -name "*.gz" -type f -mtime +$OLD_LOGS_DAYS -delete 2>/dev/null || true
        print_status "$GREEN" "   ✓ System logs cleaned"
    fi
}

# Function to clean temporary files
clean_temp_files() {
    print_status "$YELLOW" "  Cleaning temporary files..."
    
    for dir in $TEMP_DIRS; do
        if [ -d "$dir" ]; then
            # Delete files older than 7 days
            find $dir -type f -atime +7 -delete 2>/dev/null || true
            print_status "$GREEN" "   ✓ Cleaned $dir"
        fi
    done
}

# Function to clean Docker resources
clean_docker() {
    if [ "$DOCKER_CLEANUP" = true ] && command -v docker &> /dev/null; then
        print_status "$YELLOW" "  Cleaning Docker resources..."
        
        # Remove unused containers
        docker container prune -f 2>/dev/null || true
        print_status "$GREEN" "   ✓ Removed stopped containers"
        
        # Remove unused images
        docker image prune -a -f 2>/dev/null || true
        print_status "$GREEN" "   ✓ Removed unused images"
        
        # Remove unused volumes
        docker volume prune -f 2>/dev/null || true
        print_status "$GREEN" "   ✓ Removed unused volumes"
        
        # Remove build cache
        docker builder prune -a -f 2>/dev/null || true
        print_status "$GREEN" "   ✓ Removed build cache"
    fi
}

# Function to clean APT cache
clean_apt_cache() {
    if [ "$APT_CLEANUP" = true ] && [ "$EUID" -eq 0 ] && command -v apt-get &> /dev/null; then
        print_status "$YELLOW" "  Cleaning APT cache..."
        
        apt-get clean 2>/dev/null || true
        apt-get autoclean 2>/dev/null || true
        apt-get autoremove -y 2>/dev/null || true
        
        print_status "$GREEN" "   ✓ APT cache cleaned"
    fi
}

# Function to clean npm cache
clean_npm_cache() {
    if command -v npm &> /dev/null; then
        print_status "$YELLOW" "  Cleaning npm cache..."
        npm cache clean --force 2>/dev/null || true
        print_status "$GREEN" "   ✓ npm cache cleaned"
    fi
}

# Function to clean node_modules (oldest first)
clean_old_node_modules() {
    print_status "$YELLOW" "  Finding old node_modules directories..."
    
    # Find node_modules older than 30 days (not in current project)
    local current_dir=$(pwd)
    cd ~
    find . -name "node_modules" -type d -mtime +30 -not -path "$current_dir/*" 2>/dev/null | while read dir; do
        if [ -d "$dir" ]; then
            size=$(du -sh "$dir" 2>/dev/null | cut -f1)
            print_status "$YELLOW" "   Found: $dir ($size)"
            read -p "   Delete this directory? (y/N): " -n 1 -r
            echo
            if [[ $REPLY =~ ^[Yy]$ ]]; then
                rm -rf "$dir"
                print_status "$GREEN" "   ✓ Deleted $dir"
            fi
        fi
    done
    cd "$current_dir"
}

# Function to show disk usage breakdown
show_disk_usage() {
    print_status "$YELLOW" "Current disk usage breakdown:"
    echo ""
    
    # Overall disk usage
    df -h / | awk 'NR==1 || NR==2'
    echo ""
    
    # Top 10 largest directories
    print_status "$YELLOW" "Top 10 largest directories:"
    du -h --max-depth=1 ~ 2>/dev/null | sort -hr | head -10
    echo ""
}

# Main cleanup function
perform_cleanup() {
    print_status "$YELLOW" "  Starting storage cleanup..."
    echo ""
    
    local before_usage=$(get_disk_usage)
    print_status "$YELLOW" "Disk usage before cleanup: ${before_usage}%"
    echo ""
    
    clean_old_logs
    clean_temp_files
    clean_docker
    clean_apt_cache
    clean_npm_cache
    
    echo ""
    local after_usage=$(get_disk_usage)
    local freed=$((before_usage - after_usage))
    
    print_status "$GREEN" "  Cleanup complete!"
    print_status "$GREEN" "Disk usage after cleanup: ${after_usage}%"
    print_status "$GREEN" "Space freed: ${freed}%"
}

# Main script
main() {
    print_status "$GREEN" "AWS Storage Monitor & Cleanup Script"
    echo ""
    
    local current_usage=$(get_disk_usage)
    
    print_status "$YELLOW" "Current disk usage: ${current_usage}%"
    print_status "$YELLOW" "Threshold: ${THRESHOLD}%"
    echo ""
    
    if [ "$current_usage" -ge "$THRESHOLD" ]; then
        print_status "$RED" "  WARNING: Disk usage is at ${current_usage}% (threshold: ${THRESHOLD}%)"
        echo ""
        
        show_disk_usage
        
        # Automated cleanup
        if [ "$1" = "--auto" ]; then
            print_status "$YELLOW" "Running automated cleanup..."
            perform_cleanup
        else
            # Interactive mode
            read -p "Would you like to run cleanup now? (y/N): " -n 1 -r
            echo
            if [[ $REPLY =~ ^[Yy]$ ]]; then
                perform_cleanup
                
                # Check if we need more aggressive cleanup
                local final_usage=$(get_disk_usage)
                if [ "$final_usage" -ge "$THRESHOLD" ]; then
                    print_status "$YELLOW" "Still at ${final_usage}%. Consider manual cleanup of old node_modules:"
                    clean_old_node_modules
                fi
            fi
        fi
    else
        print_status "$GREEN" "  Disk usage is within acceptable limits (${current_usage}%)"
        
        if [ "$1" = "--force" ]; then
            print_status "$YELLOW" "  Force cleanup requested..."
            perform_cleanup
        fi
    fi
    
    echo ""
    print_status "$GREEN" "Done!"
}

# Run main function
main "$@"
