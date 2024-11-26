#!/bin/bash

# Exit on any error
set -e

# First argument is the token name
TOKEN_NAME="$1"
if [ -z "$TOKEN_NAME" ]; then
    echo "Usage: $0 TOKEN_NAME" >&2
    exit 1
fi

# Define token storage directory and file
TOKEN_DIR="$HOME/.enschedule"
TOKEN_FILE="$TOKEN_DIR/tokens"

# Create directory with secure permissions if it doesn't exist
if [ ! -d "$TOKEN_DIR" ]; then
    mkdir -p "$TOKEN_DIR"
    chmod 700 "$TOKEN_DIR"
fi

# Create or secure the tokens file
if [ ! -f "$TOKEN_FILE" ]; then
    touch "$TOKEN_FILE"
    chmod 600 "$TOKEN_FILE"
fi

# Function to generate a secure random token
generate_token() {
    # Generate 32 bytes of random data and encode as base64
    # Using /dev/urandom for cryptographically secure random data
    head -c 32 /dev/urandom | base64 | tr -d '\n/'
}

# Check if token already exists
existing_token=$(grep "^${TOKEN_NAME}=" "$TOKEN_FILE" 2>/dev/null | cut -d'=' -f2)

if [ -n "$existing_token" ]; then
    # Token exists, return it
    echo "$existing_token"
else
    # Generate new token
    new_token=$(generate_token)
    
    # Store the token
    echo "${TOKEN_NAME}=${new_token}" >> "$TOKEN_FILE"
    
    # Output the new token
    echo "$new_token"
fi
