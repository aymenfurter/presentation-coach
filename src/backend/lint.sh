#!/bin/bash
# Python linting script using ruff
set -e

cd "$(dirname "$0")"

# Install ruff if not present
if ! command -v ruff &> /dev/null; then
    echo "Installing ruff..."
    pip install ruff --quiet
fi

echo "Running Python linter (ruff)..."
ruff check src/ tests/

echo "Linting complete!"
