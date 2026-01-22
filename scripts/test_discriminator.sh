#!/bin/bash
# Discriminator Batch Test Script
# Tests 200 cases (100 simple + 100 complex) and collects metrics

SERVER="http://139.196.165.140:10010"
SIMPLE_FILE="backend-java/src/main/resources/data/testing/simple_test_cases.json"
COMPLEX_FILE="backend-java/src/main/resources/data/testing/complex_test_cases.json"
OUTPUT_DIR="test_results"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
RESULT_FILE="${OUTPUT_DIR}/discriminator_test_${TIMESTAMP}.json"
SUMMARY_FILE="${OUTPUT_DIR}/discriminator_summary_${TIMESTAMP}.txt"

# Create output directory
mkdir -p "$OUTPUT_DIR"

# Reset metrics before test
echo "🔄 Resetting discriminator metrics..."
curl -s -X POST "${SERVER}/api/admin/discriminator/metrics/reset" > /dev/null
curl -s -X POST "${SERVER}/api/admin/discriminator/cache/clear" > /dev/null

# Define candidate intents for testing
CANDIDATES='["sales_overview","sales_ranking","sales_trend","inventory","MATERIAL_BATCH_QUERY","PRODUCTION_STATUS_QUERY","EQUIPMENT_STATUS_QUERY","QUALITY_INSPECTION_QUERY","ATTENDANCE_QUERY","SHIPMENT_STATUS_QUERY","ALERT_QUERY","dept_performance","region_analysis","profit_analysis","cost_analysis","compare_period","forecast"]'

# Initialize counters
SIMPLE_CORRECT=0
SIMPLE_TOTAL=0
COMPLEX_CORRECT=0
COMPLEX_TOTAL=0
TOTAL_LATENCY=0
ERRORS=0

# Results array
echo "[" > "$RESULT_FILE"
FIRST=true

run_test() {
    local user_input="$1"
    local expected="$2"
    local category="$3"
    local difficulty="${4:-simple}"

    # Escape special characters in user_input for JSON
    local escaped_input=$(echo "$user_input" | sed 's/"/\\"/g' | sed ':a;N;$!ba;s/\n/\\n/g')

    # Build request body
    local body="{\"userInput\":\"${escaped_input}\",\"intentCodes\":${CANDIDATES}}"

    # Send batch-judge request
    local start_time=$(date +%s%N)
    local response=$(curl -s -X POST "${SERVER}/api/admin/discriminator/batch-judge" \
        -H "Content-Type: application/json" \
        -d "$body" 2>/dev/null)
    local end_time=$(date +%s%N)
    local latency=$(( (end_time - start_time) / 1000000 ))  # Convert to ms

    # Check if response is valid
    if [ -z "$response" ] || [ "$response" == "null" ]; then
        ((ERRORS++))
        return
    fi

    # Extract scores from response
    local scores=$(echo "$response" | jq -r '.data // empty')
    if [ -z "$scores" ]; then
        ((ERRORS++))
        return
    fi

    # Find the intent with highest score
    local top_intent=$(echo "$scores" | jq -r 'to_entries | max_by(.value) | .key')
    local top_score=$(echo "$scores" | jq -r 'to_entries | max_by(.value) | .value')

    # Check if expected intent has score > 0
    local expected_score=0
    if [ "$expected" != "NONE" ]; then
        expected_score=$(echo "$scores" | jq -r ".[\"$expected\"] // 0")
    fi

    # Determine if correct
    local correct=false
    if [ "$expected" == "NONE" ]; then
        # For NONE cases, all scores should be 0 or low
        if (( $(echo "$top_score < 0.5" | bc -l) )); then
            correct=true
        fi
    else
        # Check if expected intent is the top match or has score > 0
        if [ "$top_intent" == "$expected" ] || (( $(echo "$expected_score > 0" | bc -l) )); then
            correct=true
        fi
    fi

    # Update counters
    TOTAL_LATENCY=$((TOTAL_LATENCY + latency))

    if [ "$category" == "simple" ]; then
        ((SIMPLE_TOTAL++))
        if [ "$correct" == "true" ]; then
            ((SIMPLE_CORRECT++))
        fi
    else
        ((COMPLEX_TOTAL++))
        if [ "$correct" == "true" ]; then
            ((COMPLEX_CORRECT++))
        fi
    fi

    # Write result to file
    if [ "$FIRST" != "true" ]; then
        echo "," >> "$RESULT_FILE"
    fi
    FIRST=false

    cat >> "$RESULT_FILE" << EOF
{
  "userInput": "${escaped_input}",
  "expected": "$expected",
  "category": "$category",
  "difficulty": "$difficulty",
  "topIntent": "$top_intent",
  "topScore": $top_score,
  "expectedScore": $expected_score,
  "correct": $correct,
  "latencyMs": $latency
}
EOF
}

echo "🚀 Starting Discriminator Test (200 cases)"
echo "==========================================="
echo ""

# Run simple tests
echo "📋 Testing Simple Cases (100)..."
while IFS= read -r line; do
    user_input=$(echo "$line" | jq -r '.userInput')
    expected=$(echo "$line" | jq -r '.expectedIntent')
    category=$(echo "$line" | jq -r '.category')

    run_test "$user_input" "$expected" "$category"

    # Progress indicator
    if [ $((SIMPLE_TOTAL % 10)) -eq 0 ]; then
        echo "  Progress: $SIMPLE_TOTAL/100"
    fi
done < <(jq -c '.[]' "$SIMPLE_FILE")

echo "  ✅ Simple tests completed: $SIMPLE_TOTAL cases"
echo ""

# Run complex tests
echo "📋 Testing Complex Cases (100)..."
while IFS= read -r line; do
    user_input=$(echo "$line" | jq -r '.userInput')
    expected=$(echo "$line" | jq -r '.expectedIntent')
    category=$(echo "$line" | jq -r '.category')
    difficulty=$(echo "$line" | jq -r '.difficulty // "complex"')

    run_test "$user_input" "$expected" "$category" "$difficulty"

    # Progress indicator
    if [ $((COMPLEX_TOTAL % 10)) -eq 0 ]; then
        echo "  Progress: $COMPLEX_TOTAL/100"
    fi
done < <(jq -c '.[]' "$COMPLEX_FILE")

echo "  ✅ Complex tests completed: $COMPLEX_TOTAL cases"
echo ""

# Close JSON array
echo "]" >> "$RESULT_FILE"

# Get final metrics from server
echo "📊 Fetching server metrics..."
METRICS=$(curl -s "${SERVER}/api/admin/discriminator/metrics")

# Calculate statistics
TOTAL_CASES=$((SIMPLE_TOTAL + COMPLEX_TOTAL))
TOTAL_CORRECT=$((SIMPLE_CORRECT + COMPLEX_CORRECT))
OVERALL_ACCURACY=$(echo "scale=4; $TOTAL_CORRECT / $TOTAL_CASES * 100" | bc)
SIMPLE_ACCURACY=$(echo "scale=4; $SIMPLE_CORRECT / $SIMPLE_TOTAL * 100" | bc)
COMPLEX_ACCURACY=$(echo "scale=4; $COMPLEX_CORRECT / $COMPLEX_TOTAL * 100" | bc)
AVG_LATENCY=$(echo "scale=2; $TOTAL_LATENCY / $TOTAL_CASES" | bc)

# Get cache stats from metrics
CACHE_HITS=$(echo "$METRICS" | jq -r '.data.discriminator.cacheHits // 0')
CACHE_HIT_RATE=$(echo "$METRICS" | jq -r '.data.discriminator.cacheHitRate // 0')
FALLBACK_CALLS=$(echo "$METRICS" | jq -r '.data.discriminator.fallbackCalls // 0')
SERVER_ERRORS=$(echo "$METRICS" | jq -r '.data.discriminator.errors // 0')

# Generate summary
cat > "$SUMMARY_FILE" << EOF
================================================================================
               DISCRIMINATOR TEST SUMMARY
               ${TIMESTAMP}
================================================================================

📊 OVERALL RESULTS
------------------
Total Cases:      $TOTAL_CASES
Total Correct:    $TOTAL_CORRECT
Overall Accuracy: ${OVERALL_ACCURACY}%
Errors:           $ERRORS

📋 BY CATEGORY
--------------
Simple Cases:
  - Total:    $SIMPLE_TOTAL
  - Correct:  $SIMPLE_CORRECT
  - Accuracy: ${SIMPLE_ACCURACY}%

Complex Cases:
  - Total:    $COMPLEX_TOTAL
  - Correct:  $COMPLEX_CORRECT
  - Accuracy: ${COMPLEX_ACCURACY}%

⏱️ PERFORMANCE
--------------
Total Latency:    ${TOTAL_LATENCY}ms
Average Latency:  ${AVG_LATENCY}ms

💾 CACHE STATISTICS
-------------------
Cache Hits:       $CACHE_HITS
Cache Hit Rate:   ${CACHE_HIT_RATE}

🔧 SERVER METRICS
-----------------
Fallback Calls:   $FALLBACK_CALLS
Server Errors:    $SERVER_ERRORS

📁 OUTPUT FILES
---------------
Results:  $RESULT_FILE
Summary:  $SUMMARY_FILE

================================================================================
EOF

# Print summary to console
cat "$SUMMARY_FILE"

# Also print the full metrics
echo ""
echo "📈 Full Server Metrics:"
echo "$METRICS" | jq .

echo ""
echo "✅ Test completed! Results saved to: $OUTPUT_DIR/"
