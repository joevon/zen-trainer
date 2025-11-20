#!/bin/bash
# Simple script to start a local web server for testing
# This is needed because ES6 modules require HTTP (not file://)

echo "Starting local web server..."
echo "Open your browser to: http://localhost:8000"
echo "Press Ctrl+C to stop the server"
echo ""

# Try Python 3 first, then Python 2, then node's http-server
if command -v python3 &> /dev/null; then
    python3 -m http.server 8000
elif command -v python &> /dev/null; then
    python -m SimpleHTTPServer 8000
elif command -v npx &> /dev/null; then
    npx serve -p 8000
else
    echo "Error: No web server found. Please install Python or Node.js"
    exit 1
fi
