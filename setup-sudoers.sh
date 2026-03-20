#!/bin/bash
# Grants the current user passwordless sudo for the specific commands
# used by my-remote. Run this once with: sudo bash setup-sudoers.sh

set -euo pipefail

USER_NAME="${SUDO_USER:-$(whoami)}"
SUDOERS_FILE="/etc/sudoers.d/my-remote"

cat > "$SUDOERS_FILE" <<EOF
# Allow my-remote server to manage Remote Login and File Sharing
$USER_NAME ALL=(root) NOPASSWD: /usr/sbin/systemsetup -getremotelogin
$USER_NAME ALL=(root) NOPASSWD: /usr/sbin/systemsetup -setremotelogin on
$USER_NAME ALL=(root) NOPASSWD: /usr/sbin/systemsetup -setremotelogin off
$USER_NAME ALL=(root) NOPASSWD: /usr/sbin/systemsetup -f -setremotelogin off
$USER_NAME ALL=(root) NOPASSWD: /bin/launchctl load -w /System/Library/LaunchDaemons/com.apple.smbd.plist
$USER_NAME ALL=(root) NOPASSWD: /bin/launchctl unload -w /System/Library/LaunchDaemons/com.apple.smbd.plist
$USER_NAME ALL=(root) NOPASSWD: /bin/launchctl list com.apple.smbd
EOF

chmod 0440 "$SUDOERS_FILE"
echo "Sudoers file created at $SUDOERS_FILE for user $USER_NAME"
