"""Generate the app's bundled SQLite database from db.json."""

import sqlite3
from pathlib import Path

import typer
from rich.console import Console

from ..utils.db_json import read_db_json
from ..utils.paths import APP_ASSETS_DIR

console = Console()

# Surahs data (all 114 surahs)
SURAHS = [
    (1, "الفاتحة", "Al-Fatiha"),
    (2, "البقرة", "Al-Baqarah"),
    (3, "آل عمران", "Aal-E-Imran"),
    (4, "النساء", "An-Nisa"),
    (5, "المائدة", "Al-Ma'idah"),
    (6, "الأنعام", "Al-An'am"),
    (7, "الأعراف", "Al-A'raf"),
    (8, "الأنفال", "Al-Anfal"),
    (9, "التوبة", "At-Tawbah"),
    (10, "يونس", "Yunus"),
    (11, "هود", "Hud"),
    (12, "يوسف", "Yusuf"),
    (13, "الرعد", "Ar-Ra'd"),
    (14, "إبراهيم", "Ibrahim"),
    (15, "الحجر", "Al-Hijr"),
    (16, "النحل", "An-Nahl"),
    (17, "الإسراء", "Al-Isra"),
    (18, "الكهف", "Al-Kahf"),
    (19, "مريم", "Maryam"),
    (20, "طه", "Ta-Ha"),
    (21, "الأنبياء", "Al-Anbiya"),
    (22, "الحج", "Al-Hajj"),
    (23, "المؤمنون", "Al-Mu'minun"),
    (24, "النور", "An-Nur"),
    (25, "الفرقان", "Al-Furqan"),
    (26, "الشعراء", "Ash-Shu'ara"),
    (27, "النمل", "An-Naml"),
    (28, "القصص", "Al-Qasas"),
    (29, "العنكبوت", "Al-Ankabut"),
    (30, "الروم", "Ar-Rum"),
    (31, "لقمان", "Luqman"),
    (32, "السجدة", "As-Sajdah"),
    (33, "الأحزاب", "Al-Ahzab"),
    (34, "سبأ", "Saba"),
    (35, "فاطر", "Fatir"),
    (36, "يس", "Ya-Sin"),
    (37, "الصافات", "As-Saffat"),
    (38, "ص", "Sad"),
    (39, "الزمر", "Az-Zumar"),
    (40, "غافر", "Ghafir"),
    (41, "فصلت", "Fussilat"),
    (42, "الشورى", "Ash-Shura"),
    (43, "الزخرف", "Az-Zukhruf"),
    (44, "الدخان", "Ad-Dukhan"),
    (45, "الجاثية", "Al-Jathiyah"),
    (46, "الأحقاف", "Al-Ahqaf"),
    (47, "محمد", "Muhammad"),
    (48, "الفتح", "Al-Fath"),
    (49, "الحجرات", "Al-Hujurat"),
    (50, "ق", "Qaf"),
    (51, "الذاريات", "Adh-Dhariyat"),
    (52, "الطور", "At-Tur"),
    (53, "النجم", "An-Najm"),
    (54, "القمر", "Al-Qamar"),
    (55, "الرحمن", "Ar-Rahman"),
    (56, "الواقعة", "Al-Waqi'ah"),
    (57, "الحديد", "Al-Hadid"),
    (58, "المجادلة", "Al-Mujadilah"),
    (59, "الحشر", "Al-Hashr"),
    (60, "الممتحنة", "Al-Mumtahanah"),
    (61, "الصف", "As-Saff"),
    (62, "الجمعة", "Al-Jumu'ah"),
    (63, "المنافقون", "Al-Munafiqun"),
    (64, "التغابن", "At-Taghabun"),
    (65, "الطلاق", "At-Talaq"),
    (66, "التحريم", "At-Tahrim"),
    (67, "الملك", "Al-Mulk"),
    (68, "القلم", "Al-Qalam"),
    (69, "الحاقة", "Al-Haqqah"),
    (70, "المعارج", "Al-Ma'arij"),
    (71, "نوح", "Nuh"),
    (72, "الجن", "Al-Jinn"),
    (73, "المزمل", "Al-Muzzammil"),
    (74, "المدثر", "Al-Muddaththir"),
    (75, "القيامة", "Al-Qiyamah"),
    (76, "الإنسان", "Al-Insan"),
    (77, "المرسلات", "Al-Mursalat"),
    (78, "النبأ", "An-Naba"),
    (79, "النازعات", "An-Nazi'at"),
    (80, "عبس", "Abasa"),
    (81, "التكوير", "At-Takwir"),
    (82, "الانفطار", "Al-Infitar"),
    (83, "المطففين", "Al-Mutaffifin"),
    (84, "الانشقاق", "Al-Inshiqaq"),
    (85, "البروج", "Al-Buruj"),
    (86, "الطارق", "At-Tariq"),
    (87, "الأعلى", "Al-A'la"),
    (88, "الغاشية", "Al-Ghashiyah"),
    (89, "الفجر", "Al-Fajr"),
    (90, "البلد", "Al-Balad"),
    (91, "الشمس", "Ash-Shams"),
    (92, "الليل", "Al-Layl"),
    (93, "الضحى", "Ad-Duha"),
    (94, "الشرح", "Ash-Sharh"),
    (95, "التين", "At-Tin"),
    (96, "العلق", "Al-Alaq"),
    (97, "القدر", "Al-Qadr"),
    (98, "البينة", "Al-Bayyinah"),
    (99, "الزلزلة", "Az-Zalzalah"),
    (100, "العاديات", "Al-Adiyat"),
    (101, "القارعة", "Al-Qari'ah"),
    (102, "التكاثر", "At-Takathur"),
    (103, "العصر", "Al-Asr"),
    (104, "الهمزة", "Al-Humazah"),
    (105, "الفيل", "Al-Fil"),
    (106, "قريش", "Quraysh"),
    (107, "الماعون", "Al-Ma'un"),
    (108, "الكوثر", "Al-Kawthar"),
    (109, "الكافرون", "Al-Kafirun"),
    (110, "النصر", "An-Nasr"),
    (111, "المسد", "Al-Masad"),
    (112, "الإخلاص", "Al-Ikhlas"),
    (113, "الفلق", "Al-Falaq"),
    (114, "الناس", "An-Nas"),
]


def generate_db(
    output: Path = typer.Option(None, "--output", "-o", help="Output path for database.db"),
):
    """
    Generate the app's bundled SQLite database from db.json.

    This creates a fresh database.db with reciters and surahs data.
    """
    if output is None:
        output = APP_ASSETS_DIR / "database.db"

    output.parent.mkdir(parents=True, exist_ok=True)

    # Remove existing database
    if output.exists():
        output.unlink()

    console.print(f"[bold]Generating database: {output}[/bold]\n")

    # Read db.json
    db_data = read_db_json()
    reciters = db_data["reciters"]
    version = db_data["version"]

    # Create database
    conn = sqlite3.connect(output)
    cursor = conn.cursor()

    # Create tables
    cursor.executescript("""
        CREATE TABLE IF NOT EXISTS reciters (
            id TEXT PRIMARY KEY,
            name_en TEXT NOT NULL,
            name_ar TEXT NOT NULL,
            color_primary TEXT NOT NULL,
            color_secondary TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS surahs (
            number INTEGER PRIMARY KEY,
            name_ar TEXT NOT NULL,
            name_en TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS downloads (
            reciter_id TEXT NOT NULL,
            surah_number INTEGER NOT NULL,
            local_file_path TEXT NOT NULL,
            downloaded_at TEXT NOT NULL,
            PRIMARY KEY (reciter_id, surah_number),
            FOREIGN KEY (reciter_id) REFERENCES reciters(id),
            FOREIGN KEY (surah_number) REFERENCES surahs(number)
        );

        CREATE TABLE IF NOT EXISTS app_metadata (
            key TEXT PRIMARY KEY,
            value TEXT
        );
    """)

    # Insert reciters
    cursor.executemany(
        "INSERT INTO reciters (id, name_en, name_ar, color_primary, color_secondary) VALUES (?, ?, ?, ?, ?)",
        [(r["id"], r["name_en"], r["name_ar"], r["color_primary"], r["color_secondary"]) for r in reciters],
    )
    console.print(f"  [green]Inserted {len(reciters)} reciters[/green]")

    # Insert surahs
    cursor.executemany(
        "INSERT INTO surahs (number, name_ar, name_en) VALUES (?, ?, ?)",
        SURAHS,
    )
    console.print(f"  [green]Inserted {len(SURAHS)} surahs[/green]")

    # Insert metadata
    cursor.execute(
        "INSERT INTO app_metadata (key, value) VALUES (?, ?)",
        ("data_version", version),
    )
    cursor.execute(
        "INSERT INTO app_metadata (key, value) VALUES (?, ?)",
        ("schema_version", "1"),
    )
    console.print(f"  [green]Set data_version to {version}[/green]")

    conn.commit()
    conn.close()

    console.print(f"\n[green]Database generated successfully![/green]")
    console.print(f"Location: {output}")
