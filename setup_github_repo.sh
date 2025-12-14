#!/bin/bash

# Script to set up GitHub repository for batt_consumption_wattmetter
# This script will guide you through creating a new GitHub repository
# and pushing your code to it.

echo "=========================================="
echo "GitHub Repository Setup for batt_consumption_wattmetter"
echo "=========================================="
echo ""

echo "All references have been updated from 'zachgoldberg' to 'DarkPhilosophy':"
echo "  - metadata.json: URL and UUID updated"
echo "  - prefs.js: Project homepage links updated"
echo "  - README.md: Added maintenance notice"
echo "  - Directory renamed: batt_consumption_wattmetter@DarkPhilosophy.shell-extension"
echo ""

echo "Current Git status:"
cd ~/Projects/batt_consumption_wattmetter
git status
echo ""

echo "=========================================="
echo "OPTION 1: Manual Repository Creation"
echo "=========================================="
echo ""
echo "1. Go to https://github.com/new"
echo "2. Create a new repository named: batt_consumption_wattmetter"
echo "3. Make it PUBLIC (required for GNOME extensions)"
echo "4. Do NOT initialize with README, .gitignore, or license"
echo "5. Click 'Create repository'"
echo ""
echo "Then run this command to add the remote and push:"
echo "  git remote add origin git@github.com:DarkPhilosophy/batt_consumption_wattmetter.git"
echo "  git push -u origin main"
echo ""

echo "=========================================="
echo "OPTION 2: Automatic Repository Creation"
echo "=========================================="
echo ""
echo "If you have a GitHub Personal Access Token with 'repo' scope,"
echo "I can create the repository automatically for you."
echo ""
echo "Please provide your GitHub Personal Access Token:"
echo "(This token will NOT be stored, only used once to create the repo)"
echo ""

read -p "Enter your choice (1 for manual, 2 for automatic, or any other key to exit): " choice

echo ""

if [ "$choice" = "1" ]; then
    echo "Please create the repository manually as described above."
    echo "After creating it, run:"
    echo "  cd ~/Projects/batt_consumption_wattmetter"
    echo "  git remote add origin git@github.com:DarkPhilosophy/batt_consumption_wattmetter.git"
    echo "  git push -u origin main"
    
elif [ "$choice" = "2" ]; then
    read -p "Enter your GitHub Personal Access Token: " token
    echo ""
    
    if [ -z "$token" ]; then
        echo "No token provided. Please use Option 1 instead."
        exit 1
    fi
    
    echo "Creating repository on GitHub..."
    
    # Create repository using GitHub API
    response=$(curl -s -X POST \
        -H "Authorization: token $token" \
        -H "Accept: application/vnd.github.v3+json" \
        https://api.github.com/user/repos \
        -d '{"name":"batt_consumption_wattmetter","description":"Battery Time Remaining, Percentage, Watt Meter in Panel","private":false,"has_issues":true,"has_projects":false,"has_wiki":false}')
    
    if echo "$response" | grep -q ""\"full_name\"\":\"DarkPhilosophy/batt_consumption_wattmetter\""; then
        echo "Repository created successfully!"
        echo ""
        echo "Adding remote and pushing code..."
        git remote add origin git@github.com:DarkPhilosophy/batt_consumption_wattmetter.git
        git push -u origin main
        echo ""
        echo "All done! Your repository is now on GitHub."
        echo "URL: https://github.com/DarkPhilosophy/batt_consumption_wattmetter"
    else
        echo "Failed to create repository. Error:"
        echo "$response" | python3 -c "import sys, json; print(json.dumps(json.loads(sys.stdin.read()), indent=2))"
        echo ""
        echo "Please use Option 1 instead."
    fi
    
else
    echo "Exiting without changes."
    exit 0
fi