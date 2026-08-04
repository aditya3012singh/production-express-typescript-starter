#!/bin/bash
# deploy_aws.sh
# Automated setup for the base backend on an Ubuntu Server EC2 instance

set -e

echo "=========================================================="
echo " Starting Base Backend Deployment on AWS EC2 (Ubuntu)"
echo "=========================================================="

# 1. Update system packages
echo ">>> Updating system packages..."
sudo apt-get update -y
sudo apt-get upgrade -y
sudo apt-get install -y curl wget git unzip dbus-user-session

# 2. Install Docker
if ! command -v docker &> /dev/null; then
    echo ">>> Installing Docker..."
    sudo apt-get install -y ca-certificates curl
    sudo install -m 0755 -d /etc/apt/keyrings
    sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
    sudo chmod a+r /etc/apt/keyrings/docker.asc

    echo \
      "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu \
      $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
      sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
    sudo apt-get update -y
    sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

    sudo usermod -aG docker $USER
    echo ">>> Docker installed."
    sudo systemctl enable docker
    sudo systemctl start docker
else
    echo ">>> Docker is already installed."
fi

# 3. Start Redis Server via Docker
REDIS_PORT="${REDIS_PORT:-6379}"
echo ">>> Starting Redis container on port $REDIS_PORT..."
if ! sudo docker ps | grep -q 'base-backend-redis'; then
    sudo docker run -d --name base-backend-redis -p "$REDIS_PORT:6379" --restart always redis:7-alpine
    echo ">>> Redis started on port $REDIS_PORT."
else
    echo ">>> Redis is already running."
fi

# 4. Install Node.js (v20) via NVM
echo ">>> Installing Node.js..."
export NVM_DIR="$HOME/.nvm"
if [ ! -d "$NVM_DIR" ]; then
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
    \. "$NVM_DIR/nvm.sh"
    nvm install 20
    nvm use 20
    nvm alias default 20
else
    \. "$NVM_DIR/nvm.sh"
    nvm use 20
fi
node -v
npm -v

# 5. Install global npm packages
echo ">>> Installing PM2..."
npm install -g pm2

# 6. Install Backend Dependencies
echo ">>> Installing backend dependencies..."
npm install

# 7. Generate Prisma Client
echo ">>> Generating Prisma Client..."
npx prisma generate

# 8. Compile TypeScript
echo ">>> Compiling TypeScript..."
npm run build

# 9. Start Application with PM2
echo ">>> Starting application with PM2..."
pm2 start ecosystem.config.cjs
pm2 save

echo "=========================================================="
echo " Deployment Complete!"
echo " Backend is running via PM2."
echo " Note: Your .env file must be properly configured!"
echo " Check logs using: pm2 logs"
echo "=========================================================="
