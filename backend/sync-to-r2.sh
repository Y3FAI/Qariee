#!/bin/bash

# ============================================================================
# Rabi R2 Sync Script
# Uploads local backend/r2/ files to Cloudflare R2 bucket
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
LOCAL_R2_DIR="$PROJECT_ROOT/backend/r2"
BUCKET_NAME="rabi"

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

# Check if local r2 directory exists
if [ ! -d "$LOCAL_R2_DIR" ]; then
    echo -e "${RED}❌ Local R2 directory not found: $LOCAL_R2_DIR${NC}"
    exit 1
fi

echo -e "${BLUE}📦 Rabi R2 Sync Script${NC}"
echo -e "${BLUE}=======================${NC}"
echo "Local source: $LOCAL_R2_DIR"
echo "R2 bucket:    $BUCKET_NAME"
echo ""

# Find all files (excluding .DS_Store) and store in array
files=()
while IFS= read -r -d '' file; do
    files+=("$file")
done < <(find "$LOCAL_R2_DIR" -type f ! -name ".DS_Store" -print0 | sort -z)

if [ ${#files[@]} -eq 0 ]; then
    echo -e "${YELLOW}⚠️ No files found in $LOCAL_R2_DIR${NC}"
    exit 0
fi

echo -e "${BLUE}📁 Found ${#files[@]} files to sync:${NC}"
for file in "${files[@]}"; do
    # Get relative path from LOCAL_R2_DIR
    rel_path="${file#$LOCAL_R2_DIR/}"
    echo "  • $rel_path"
done

echo ""
echo -e "${YELLOW}⚠️ This will upload files to Cloudflare R2 bucket: $BUCKET_NAME${NC}"
read -p "Continue? (y/N): " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}🚫 Sync cancelled${NC}"
    exit 0
fi

echo -e "${BLUE}🔄 Starting upload...${NC}"

success_count=0
fail_count=0

for local_file in "${files[@]}"; do
    # Get relative path from LOCAL_R2_DIR
    rel_path="${local_file#$LOCAL_R2_DIR/}"

    echo -n "  Uploading $rel_path... "

    # Upload to R2
    if wrangler r2 object put "$BUCKET_NAME/$rel_path" \
        --file "$local_file" \
        --remote 2>/dev/null; then

        echo -e "${GREEN}✅${NC}"
        ((success_count++))
    else
        echo -e "${RED}❌${NC}"
        ((fail_count++))
    fi
done

echo ""
echo -e "${BLUE}📊 Sync Summary${NC}"
echo -e "${BLUE}===============${NC}"
echo -e "${GREEN}✅ Success: $success_count${NC}"
if [ $fail_count -gt 0 ]; then
    echo -e "${RED}❌ Failed: $fail_count${NC}"
fi

if [ $fail_count -eq 0 ]; then
    echo -e "${GREEN}🎉 All files uploaded successfully!${NC}"

    # Test URLs
    echo ""
    echo -e "${BLUE}🔗 Testing CDN URLs:${NC}"

    # Test db.json
    db_url="https://rabi.y3f.me/metadata/db.json"
    if curl -s -f -o /dev/null "$db_url"; then
        echo -e "  ${GREEN}✅ $db_url${NC}"
    else
        echo -e "  ${RED}❌ $db_url (failed)${NC}"
    fi

    # Test reciter images
    for reciter in mishary-alafasy abdul-basit sudais; do
        img_url="https://rabi.y3f.me/images/reciters/$reciter.jpg"
        if curl -s -f -o /dev/null "$img_url"; then
            echo -e "  ${GREEN}✅ $img_url${NC}"
        else
            echo -e "  ${RED}❌ $img_url (missing)${NC}"
        fi
    done
else
    echo -e "${YELLOW}⚠️ Some files failed to upload. Check errors above.${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}🚀 Sync completed!${NC}"
echo "CDN Base URL: https://rabi.y3f.me"