#!/bin/bash

# Health Check Script
# Checks both general app health and queue health

echo "🔍 Checking TeamShots Health..."
echo ""

# App Health
echo "📱 App Health:"
APP_HEALTH=$(curl -s http://localhost:3000/api/health)
echo "$APP_HEALTH" | grep -o '"status":"[^"]*"'
echo ""

# Queue Health
echo "📊 Queue Health:"
QUEUE_HEALTH=$(curl -s http://localhost:3000/api/queue/health)
echo "$QUEUE_HEALTH" | grep -o '"status":"[^"]*"'
echo "$QUEUE_HEALTH" | grep -A 10 '"imageGeneration"'
echo ""

echo "✅ Health check complete!"
