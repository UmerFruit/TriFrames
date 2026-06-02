#!/bin/bash

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

cleanup() {
    echo ""
    echo "Shutting down servers..."
    kill 0
}

trap cleanup SIGINT SIGTERM EXIT

echo "Starting Backend..."
cd "$PROJECT_ROOT/backend" || exit 1

if [ ! -d "venv" ]; then
    echo "Creating venv and installing requirements..."
    python3 -m venv venv
    ./venv/bin/pip install -r requirements.txt
fi

./venv/bin/python3 app.py &

echo "Starting Frontend..."
cd "$PROJECT_ROOT/frontend" || exit 1

if [ ! -d "node_modules" ]; then
    echo "Installing npm dependencies..."
    npm install
fi

npm run dev &

echo ""
echo "Stack is running."
echo "Frontend: http://localhost:5173"
echo "Backend:  http://localhost:5000"
echo "Press Ctrl+C to stop."

wait