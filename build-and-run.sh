#!/bin/bash

echo "=== AccessibleGuitarTabs Build and Run Script ==="
echo ""

# Change to project directory
cd "F:/claude/AccessibleGuitarTabs"

echo "Current directory: $(pwd)"
echo ""

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
    echo ""
fi

echo "Building the project..."
npm run build

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Build successful!"
    echo ""
    echo "You can now:"
    echo "1. Run 'npm run preview' to test the built version"
    echo "2. Run 'npm run dev' for development with hot reloading"
    echo "3. Open firebase-test-standalone.html to test Firebase auth directly"
    echo ""
    
    # Ask user what they want to do
    echo "What would you like to do next?"
    echo "1) Start preview server (built version)"
    echo "2) Start development server"
    echo "3) Exit"
    read -p "Enter choice (1-3): " choice
    
    case $choice in
        1)
            echo "Starting preview server..."
            npm run preview
            ;;
        2)
            echo "Starting development server..."
            npm run dev
            ;;
        3)
            echo "Done! Check the dist folder for built files."
            ;;
        *)
            echo "Invalid choice. Exiting."
            ;;
    esac
else
    echo "❌ Build failed. Check the error messages above."
    echo ""
    echo "Common fixes:"
    echo "1. Make sure Node.js is installed"
    echo "2. Try running 'npm install' first"
    echo "3. Check that all dependencies are properly installed"
fi

echo ""
echo "Press any key to continue..."
read -n 1
