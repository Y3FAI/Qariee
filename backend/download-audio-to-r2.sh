#!/bin/bash

# ============================================================================
# Rabi Audio Download & Upload Script
# Downloads audio from mp3quran.net and uploads to Cloudflare R2 bucket
# ============================================================================

set -e  # Exit on error
set -u  # Treat unset variables as error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BUCKET_NAME="rabi"
TEMP_DIR="/tmp/rabi-audio-$(date +%s)"

# Default values (for testing)
DEFAULT_RECITER="hussary"
DEFAULT_BASE_URL="https://server13.mp3quran.net/husr"
DEFAULT_TEST_SURAHS=(1 113 114)  # Test with short surahs

# Parse command line arguments
if [ $# -eq 0 ]; then
    # No arguments: use defaults for testing
    RECITER_ID="$DEFAULT_RECITER"
    MP3QURAN_BASE="$DEFAULT_BASE_URL"
    TEST_SURAHS=("${DEFAULT_TEST_SURAHS[@]}")
    echo -e "${YELLOW}⚠️ Using default values for testing:${NC}"
    echo "  Reciter: $RECITER_ID"
    echo "  Source:  $MP3QURAN_BASE"
    echo "  Surahs:  ${TEST_SURAHS[*]}"
    echo ""
elif [ $# -eq 2 ] || [ $# -eq 4 ]; then
    # Two arguments: reciter_id and base_url (download all 114 surahs)
    # Four arguments: reciter_id, base_url, start_surah, end_surah
    RECITER_ID="$1"
    MP3QURAN_BASE="$2"

    if [ $# -eq 2 ]; then
        # Generate array of all 114 surahs
        START_SURAH=1
        END_SURAH=114
        echo -e "${GREEN}📥 Will download all 114 surahs for reciter: $RECITER_ID${NC}"
    else
        START_SURAH="$3"
        END_SURAH="$4"
        echo -e "${GREEN}📥 Will download surahs $START_SURAH to $END_SURAH for reciter: $RECITER_ID${NC}"
    fi

    # Validate surah range
    if ! [[ "$START_SURAH" =~ ^[0-9]+$ ]] || ! [[ "$END_SURAH" =~ ^[0-9]+$ ]]; then
        echo -e "${RED}❌ Start and end surah must be numbers${NC}"
        exit 1
    fi

    if [ "$START_SURAH" -lt 1 ] || [ "$START_SURAH" -gt 114 ]; then
        echo -e "${RED}❌ Start surah must be between 1 and 114${NC}"
        exit 1
    fi

    if [ "$END_SURAH" -lt 1 ] || [ "$END_SURAH" -gt 114 ]; then
        echo -e "${RED}❌ End surah must be between 1 and 114${NC}"
        exit 1
    fi

    if [ "$START_SURAH" -gt "$END_SURAH" ]; then
        echo -e "${RED}❌ Start surah cannot be greater than end surah${NC}"
        exit 1
    fi

    # Generate array of surahs
    TEST_SURAHS=()
    for ((i=START_SURAH; i<=END_SURAH; i++)); do
        TEST_SURAHS+=($i)
    done
else
    echo -e "${RED}❌ Usage:${NC}"
    echo "  Test mode (short surahs): $0"
    echo "  Full upload (all 114):    $0 <reciter_id> <base_url>"
    echo "  Custom range:             $0 <reciter_id> <base_url> <start> <end>"
    echo ""
    echo "Examples:"
    echo "  $0"
    echo "  $0 hussary https://server13.mp3quran.net/husr"
    echo "  $0 sudais https://server11.mp3quran.net/download/sds/"
    echo "  $0 hussary https://server13.mp3quran.net/husr 1 30"
    exit 1
fi

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    echo -e "${RED}❌ wrangler CLI is not installed${NC}"
    echo "Install with: npm install -g wrangler"
    exit 1
fi

# Check if authenticated
if ! wrangler whoami &> /dev/null; then
    echo -e "${RED}❌ Not authenticated with Cloudflare${NC}"
    echo "Run: wrangler login"
    exit 1
fi

echo -e "${BLUE}📦 Rabi Audio Download & Upload Script${NC}"
echo -e "${BLUE}=======================================${NC}"
echo "Reciter:      $RECITER_ID"
echo "Source:       $MP3QURAN_BASE"
echo "R2 bucket:    $BUCKET_NAME"

# Display surah info
if [ ${#TEST_SURAHS[@]} -eq 114 ]; then
    echo "Surahs:       All 114 surahs"
elif [ ${#TEST_SURAHS[@]} -le 5 ]; then
    echo "Test surahs:  ${TEST_SURAHS[*]}"
else
    echo "Surahs:       ${#TEST_SURAHS[@]} surahs"
fi
echo ""

# Create temp directory
mkdir -p "$TEMP_DIR"
echo -e "${BLUE}📁 Created temp directory: $TEMP_DIR${NC}"

echo -e "${YELLOW}⚠️ This will download ${#TEST_SURAHS[@]} surahs and upload to Cloudflare R2${NC}"
read -p "Continue? (y/N): " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}🚫 Operation cancelled${NC}"
    rm -rf "$TEMP_DIR"
    exit 0
fi

echo -e "${BLUE}🔄 Starting download & upload...${NC}"

success_count=0
fail_count=0

for surah in "${TEST_SURAHS[@]}"; do
    # Format surah number as 3 digits
    surah_padded=$(printf "%03d" $surah)
    local_file="$TEMP_DIR/$surah_padded.mp3"
    remote_path="audio/$RECITER_ID/$surah_padded.mp3"

    echo -n "  Surah $surah_padded... "

    # Download from mp3quran
    if curl -s -f -o "$local_file" "$MP3QURAN_BASE/$surah_padded.mp3"; then
        # Upload to R2
        if wrangler r2 object put "$BUCKET_NAME/$remote_path" \
            --file "$local_file" \
            --remote 2>/dev/null; then

            echo -e "${GREEN}✅${NC}"
            ((success_count++))
        else
            echo -e "${RED}❌ Upload failed${NC}"
            ((fail_count++))
        fi

        # Delete local file immediately
        rm -f "$local_file"
    else
        echo -e "${RED}❌ Download failed${NC}"
        ((fail_count++))
    fi
done

# Clean up temp directory
rm -rf "$TEMP_DIR"

echo ""
echo -e "${BLUE}📊 Summary${NC}"
echo -e "${BLUE}=========${NC}"
echo -e "${GREEN}✅ Success: $success_count${NC}"
if [ $fail_count -gt 0 ]; then
    echo -e "${RED}❌ Failed: $fail_count${NC}"
fi

if [ $fail_count -eq 0 ]; then
    echo -e "${GREEN}🎉 All surahs uploaded successfully!${NC}"

    # Test a few URLs
    echo ""
    echo -e "${BLUE}🔗 Testing CDN URLs:${NC}"

    for surah in "${TEST_SURAHS[@]}"; do
        surah_padded=$(printf "%03d" $surah)
        test_url="https://rabi.y3f.me/audio/$RECITER_ID/$surah_padded.mp3"
        if curl -s -f -o /dev/null "$test_url"; then
            echo -e "  ${GREEN}✅ $test_url${NC}"
        else
            echo -e "  ${RED}❌ $test_url (failed)${NC}"
        fi
    done
else
    echo -e "${YELLOW}⚠️ Some surahs failed. Check errors above.${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}🚀 Audio upload completed!${NC}"
echo "CDN Base URL: https://rabi.y3f.me"
echo "Audio path: /audio/$RECITER_ID/{surah}.mp3"