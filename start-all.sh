#!/bin/bash

echo "🚀 Starting TrustChain Platform..."

# Start University Portal (Port 3000)
echo "Starting University Portal (port 3000)..."
cd university-portal
cross-env PORT=3000 npm start &
P1=$!
cd ..

# Start Verifier Portal (Port 3001)
echo "Starting Verifier Portal (port 3001)..."
cd verifier-portal
cross-env PORT=3001 npm start &
P2=$!
cd ..

# Start Student Wallet
echo "Starting Student Wallet (Expo)..."
cd student-wallet
npx expo start &
P3=$!
cd ..

echo "✅ All services started!"
echo ""
echo "🏛️  University Portal: http://localhost:3000"
echo "✅ Verifier Portal: http://localhost:3001"
echo "📱 Student Wallet: Check terminal for Expo QR code"
echo ""
echo "Press Ctrl+C to stop all services"

# Trap to kill all background processes on script exit
trap "echo \nStopping all services...; kill $P1 $P2 $P3; exit" SIGINT

wait