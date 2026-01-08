# Qariee Backend Management Scripts

This directory contains scripts for managing the Qariee app's content delivery via Cloudflare R2.

## Prerequisites

1. **Cloudflare Account**: You need a Cloudflare account with R2 access
2. **Wrangler CLI**: Install with `npm install -g wrangler`
3. **Authentication**: Run `wrangler login` to authenticate
4. **R2 Bucket**: Create an R2 bucket named `qariee` in Cloudflare dashboard
5. **Custom Domain**: Connect `qariee-storage.y3f.me` to your R2 bucket (optional but recommended)

## Directory Structure

```
backend/
├── r2/                    # Local assets (mirrors R2 bucket)
│   ├── metadata/
│   │   └── db.json       # App configuration & reciter data
│   └── images/
│       └── reciters/     # Reciter profile images
├── sync-to-r2.sh         # Sync local assets → R2 bucket
├── download-audio-to-r2.sh # Download audio → upload to R2
└── README.md            # This file
```

## Script 1: `sync-to-r2.sh`

Syncs local `backend/r2/` files to Cloudflare R2 bucket.

### Purpose

-   Upload metadata (`db.json`) and images to R2
-   Maintain local-first asset management
-   Test CDN URLs after upload

### Usage

```bash
# Run with confirmation prompt
bash sync-to-r2.sh

# Auto-confirm (for scripting)
echo y | bash sync-to-r2.sh
```

### What it does

1. Checks for `wrangler` installation and authentication
2. Lists all files in `backend/r2/` (excluding `.DS_Store`)
3. Shows upload preview and asks for confirmation
4. Uploads each file to R2 bucket `qariee`
5. Tests CDN accessibility for uploaded files
6. Shows success/failure summary

### Example Output

```
📦 Qariee R2 Sync Script
=======================
Local source: /Users/yousef/dev/qariee/backend/r2
R2 bucket:    qariee

📁 Found 4 files to sync:
  • images/reciters/hussary.jpg
  • metadata/db.json
...
🎉 All files uploaded successfully!
```

## Script 2: `download-audio-to-r2.sh`

Downloads Quran audio from mp3quran.net and uploads directly to R2 bucket.

### Purpose

-   Stream audio from mp3quran.net → R2 bucket
-   No local storage of large audio files
-   Support for any reciter with mp3quran.net URL pattern
-   Upload in batches or full 114 surahs

### Usage Modes

#### **Mode 1: Test with default values** (3 short surahs)

```bash
# Uses default reciter "hussary"
# Downloads surahs 001, 113, 114
bash download-audio-to-r2.sh
```

#### **Mode 2: Full upload** (all 114 surahs)

```bash
# Syntax: <reciter_id> <mp3quran_base_url>
bash download-audio-to-r2.sh hussary https://server13.mp3quran.net/husr
```

#### **Mode 3: Custom range upload**

```bash
# Syntax: <reciter_id> <mp3quran_base_url> <start_surah> <end_surah>
bash download-audio-to-r2.sh hussary https://server13.mp3quran.net/husr 1 30
```

### Examples for different reciters

```bash
# Hussary (Mahmoud Khalil Al-Hussary)
bash download-audio-to-r2.sh hussary https://server13.mp3quran.net/husr

# Sudais (Abdur-Rahman As-Sudais) - hypothetical URL
bash download-audio-to-r2.sh sudais https://server11.mp3quran.net/download/sds/

# Mishary Alafasy - hypothetical URL
bash download-audio-to-r2.sh mishary https://server8.mp3quran.net/afs/
```

### What it does

1. Validates command line arguments
2. Creates temporary directory for downloads
3. For each surah:
    - Downloads MP3 from mp3quran.net
    - Uploads to R2 at `audio/<reciter_id>/<surah>.mp3`
    - Deletes local MP3 immediately
4. Tests CDN URLs after completion
5. Cleans up temporary directory

### Safety Features

-   Surah range validation (1-114)
-   Start must be ≤ end
-   Automatic cleanup on cancellation
-   Progress tracking with success/failure counts
-   CDN URL testing after upload

## R2 Bucket Structure

After running both scripts, your R2 bucket will contain:

```
qariee/ (R2 bucket)
├── metadata/
│   └── db.json                 # App configuration
├── images/
│   └── reciters/
│       ├── hussary.jpg         # Reciter profile images
│       └── [other_reciters].jpg
└── audio/
    └── hussary/                # Reciter audio directory
        ├── 001.mp3             # Surah 1
        ├── 002.mp3             # Surah 2
        ├── ...                 # Surahs 3-112
        ├── 113.mp3             # Surah 113 (Al-Falaq)
        └── 114.mp3             # Surah 114 (An-Nas)
```

## CDN URLs

With custom domain `qariee-storage.y3f.me` connected to R2:

-   **Metadata**: `https://qariee-storage.y3f.me/metadata/db.json`
-   **Reciter Images**: `https://qariee-storage.y3f.me/images/reciters/{reciter_id}.jpg`
-   **Audio Files**: `https://qariee-storage.y3f.me/audio/{reciter_id}/{surah}.mp3`

## App Integration

The React Native app uses these URLs via:

-   `app/src/constants/config.ts` - URL builders
-   `app/src/services/dataSync.ts` - Data synchronization
-   CDN base URL configurable in `db.json` → `settings.cdn_base_url`

## Workflow for Adding New Reciter

1. **Add reciter to `db.json`**:

    ```json
    {
        "id": "sudais",
        "name_en": "Abdur-Rahman As-Sudais",
        "name_ar": "عبد الرحمن السديس",
        "color_primary": "#FFE66D",
        "color_secondary": "#FFF4A3"
    }
    ```

2. **Add reciter image**:

    ```bash
    # Save as backend/r2/images/reciters/sudais.jpg
    ```

3. **Upload images & updated db.json**:

    ```bash
    bash sync-to-r2.sh
    ```

4. **Upload audio files**:

    ```bash
    # Find mp3quran.net URL for Sudais, then:
    bash download-audio-to-r2.sh sudais https://server11.mp3quran.net/download/sds/
    ```

5. **Test CDN URLs**:
    ```bash
    curl -I https://qariee-storage.y3f.me/images/reciters/sudais.jpg
    curl -I https://qariee-storage.y3f.me/audio/sudais/001.mp3
    ```

## Troubleshooting

### Common Issues

1. **"wrangler not found"**

    ```bash
    npm install -g wrangler
    ```

2. **"Not authenticated with Cloudflare"**

    ```bash
    wrangler login
    ```

3. **CDN URLs return 404**

    - Wait a few minutes for CDN propagation
    - Check R2 bucket permissions are public
    - Verify custom domain is connected to R2 bucket

4. **Audio download fails**

    - Check mp3quran.net URL format
    - Ensure reciter has 114 surahs at that URL
    - Try downloading single file: `curl -I https://server13.mp3quran.net/husr/001.mp3`

5. **Upload takes too long**
    - Use custom range mode to upload in batches
    - Surah 2 (Al-Baqarah) is largest (~50MB), others are 5-20MB
    - Total upload size: ~1-2GB per reciter

### Script Options

Both scripts:

-   Show colored output for clarity
-   Ask for confirmation before upload
-   Provide detailed success/failure summary
-   Test CDN URLs after completion
-   Exit cleanly on cancellation

## Best Practices

1. **Test first**: Always run test mode (`bash download-audio-to-r2.sh`) before full upload
2. **Batch uploads**: For large reciters, upload in batches of 30-50 surahs
3. **Verify URLs**: Test a few CDN URLs after upload
4. **Check db.json**: Ensure `cdn_base_url` matches your custom domain
5. **Monitor usage**: R2 has free tier limits (10GB storage, 1M operations/month)

## Notes

-   **Audio files are not stored locally** - downloaded temporarily then deleted
-   **Local `r2/` directory** is the source of truth for metadata/images
-   **CDN caching**: New files may take a few minutes to propagate
-   **Costs**: R2 is inexpensive ($0.015/GB storage, $0.36/GB egress)

For questions or issues, contact: yousef.contact.apps@gmail.com
