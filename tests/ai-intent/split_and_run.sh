#!/bin/bash

# Split test files into smaller chunks and run in parallel
# Usage: ./split_and_run.sh

set -eo pipefail  # Removed -u to allow unbound variables

CHUNK_SIZE=35  # Tests per chunk

# Function to split JSON test file into chunks
split_test_file() {
    local input_file=$1
    local output_prefix=$2

    local total_tests=$(jq '.testCases | length' "$input_file")
    local num_chunks=$(( (total_tests + CHUNK_SIZE - 1) / CHUNK_SIZE ))

    echo "Splitting $input_file: $total_tests tests into $num_chunks chunks"

    for ((i=0; i<num_chunks; i++)); do
        local start_idx=$((i * CHUNK_SIZE))
        local chunk_file="${output_prefix}_chunk${i}.json"

        # Create chunk file with subset of tests
        jq --arg start "$start_idx" --arg size "$CHUNK_SIZE" '
            .testCases = (.testCases[($start | tonumber):($start | tonumber) + ($size | tonumber)]) |
            .totalCases = (.testCases | length) |
            .chunkInfo = {
                chunkNumber: (($start | tonumber) / ($size | tonumber) + 1),
                startIndex: ($start | tonumber),
                chunkSize: ($size | tonumber)
            }
        ' "$input_file" > "$chunk_file"

        echo "  Created $chunk_file with $(jq '.testCases | length' "$chunk_file") tests"
    done

    echo "$num_chunks"
}

# Split each test file
echo "=== Splitting Test Files ==="
num_p0_chunks=$(split_test_file "test-cases-p0-remaining-140.json" "p0_remaining")
num_p1_chunks=$(split_test_file "test-cases-p1-complete-165.json" "p1_complete")
num_p2p3_chunks=$(split_test_file "test-cases-p2p3-complete-165.json" "p2p3")

total_chunks=$((num_p0_chunks + num_p1_chunks + num_p2p3_chunks))

echo ""
echo "=== Summary ==="
echo "P0 chunks: $num_p0_chunks"
echo "P1 chunks: $num_p1_chunks"
echo "P2+P3 chunks: $num_p2p3_chunks"
echo "Total chunks: $total_chunks"
echo ""
echo "Ready to execute $total_chunks parallel test batches"
