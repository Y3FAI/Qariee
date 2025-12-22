#!/bin/bash

# ============================================================================
# Rabi Audio Download & Upload Script (Final)
# ============================================================================

# Treat unset variables as error
set -u
# NOTE: set -e is removed so one failure doesn't kill the whole loop

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BUCKET_NAME="rabi"
TEMP_DIR="/tmp/rabi-audio-$(date +%s)"

# Default settings
DEFAULT_RECITER="hussary"
DEFAULT_BASE_URL="https://server13.mp3quran.net/husr"
MAX_RETRIES=3

# --- 1. Cleanup Function ---
cleanup() {
    if [ -d "$TEMP_DIR" ]; then
        rm -rf "$TEMP_DIR"
    fi
}
trap cleanup EXIT INT TERM

# --- 2. Check Prerequisites ---
if ! command -v wrangler &> /dev/null; then
    echo -e "${RED}❌ Error: 'wrangler' is not installed.${NC}"
    exit 1
fi

# --- 3. Parse Arguments ---
if [ $# -eq 0 ]; then
    RECITER_ID="$DEFAULT_RECITER"
    MP3QURAN_BASE="$DEFAULT_BASE_URL"
    TEST_SURAHS=(1 113 114)
    echo -e "${YELLOW}⚠️  Running in TEST mode (3 files only).${NC}"
elif [ $# -eq 2 ] || [ $# -eq 4 ]; then
    RECITER_ID="$1"
    MP3QURAN_BASE="$2"
    
    if [ $# -eq 2 ]; then
        START_SURAH=1
        END_SURAH=114
    else
        START_SURAH="$3"
        END_SURAH="$4"
    fi

    if ! [[ "$START_SURAH" =~ ^[0-9]+$ ]] || ! [[ "$END_SURAH" =~ ^[0-9]+$ ]] || [ "$START_SURAH" -gt "$END_SURAH" ]; then
        echo -e "${RED}❌ Invalid Surah range.${NC}"; exit 1
    fi

    TEST_SURAHS=()
    for ((i=START_SURAH; i<=END_SURAH; i++)); do
        TEST_SURAHS+=($i)
    done
else
    echo -e "${RED}❌ Usage: $0 [reciter_id base_url [start end]]${NC}"
    exit 1
fi

# --- 4. Main Loop ---
mkdir -p "$TEMP_DIR"
echo -e "${BLUE}📦 Starting Batch Job: $RECITER_ID (${#TEST_SURAHS[@]} files)${NC}"

success_count=0
fail_count=0

for surah in "${TEST_SURAHS[@]}"; do
    surah_padded=$(printf "%03d" $surah)
    local_file="$TEMP_DIR/$surah_padded.mp3"
    remote_path="audio/$RECITER_ID/$surah_padded.mp3"
    
    echo -n "  Surah $surah_padded... "

    # --- DOWNLOAD ---
    download_ok=false
    for ((i=1; i<=MAX_RETRIES; i++)); do
        if curl -s -f -L -o "$local_file" "$MP3QURAN_BASE/$surah_padded.mp3"; then
            download_ok=true
            break
        else
            [ $i -lt $MAX_RETRIES ] && sleep 1
        fi
    done

    if [ "$download_ok" = false ]; then
        echo -e "${RED}❌ Download Failed${NC}"
        ((fail_count++))
        continue
    fi

    # --- UPLOAD (Fixed with --remote) ---
    upload_ok=false
    for ((i=1; i<=MAX_RETRIES; i++)); do
        # Added --remote flag here
        if output=$(wrangler r2 object put "$BUCKET_NAME/$remote_path" --file "$local_file" --remote 2>&1); then
            upload_ok=true
            break
        else
            [ $i -lt $MAX_RETRIES ] && sleep 2
        fi
    done

    rm -f "$local_file"

    if [ "$upload_ok" = true ]; then
        echo -e "${GREEN}✅${NC}"
        ((success_count++))
    else
        echo -e "${RED}❌ Upload Failed${NC}"
        echo -e "${YELLOW}   Debug: $output${NC}"
        ((fail_count++))
    fi
    
    sleep 0.2
done

# --- 5. Summary ---
echo ""
echo -e "${BLUE}📊 Success: ${GREEN}$success_count${BLUE} | Failed: ${RED}$fail_count${NC}"
if [ $fail_count -gt 0 ]; then exit 1; fi