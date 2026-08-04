#!/bin/bash
# Base Backend Nginx & SSL setup script
# Run this directly on your EC2 instance

set -e

echo "=========================================================="
echo " Starting Nginx & SSL Setup"
echo "=========================================================="

echo ">>> 1. Installing Nginx and Certbot..."
sudo apt-get update
sudo apt-get install -y nginx certbot python3-certbot-nginx

echo ">>> 2. Configuring Nginx..."
# Copy the config over
sudo cp ~/base-backend/backend-ts-starter/deploy/nginx.conf /etc/nginx/sites-available/base-backend

# Create symlink
sudo ln -sf /etc/nginx/sites-available/base-backend /etc/nginx/sites-enabled/

# Remove default site to avoid conflict on port 80
sudo rm -f /etc/nginx/sites-enabled/default

# Test Nginx configuration
sudo nginx -t

echo ">>> 3. Restarting Nginx..."
sudo systemctl restart nginx
sudo systemctl enable nginx

echo ">>> 4. Setting up SSL via Certbot Let's Encrypt..."
echo "You will be prompted to enter your email address for renewal notices."
# Please customize the domain name when running certbot
# sudo certbot --nginx -d api.yourdomain.com

echo "=========================================================="
echo " Setup complete! Nginx is now securing your API."
echo " Let's Encrypt will automatically renew the certificate."
echo "=========================================================="
