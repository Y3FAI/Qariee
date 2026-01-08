"""Color utilities for generating random reciter colors."""

import random

# Predefined color palettes that look good together
# Each tuple is (primary, secondary)
COLOR_PALETTES = [
    ("#4A90E2", "#8CB4FF"),  # Blue
    ("#7B68EE", "#A594F9"),  # Purple
    ("#20B2AA", "#5ED4CD"),  # Teal
    ("#E67E22", "#F5A962"),  # Orange
    ("#27AE60", "#6FCF97"),  # Green
    ("#9B59B6", "#C39BD3"),  # Violet
    ("#3498DB", "#7FB3D5"),  # Light Blue
    ("#1ABC9C", "#76D7C4"),  # Turquoise
    ("#E74C3C", "#F1948A"),  # Red
    ("#F39C12", "#F7DC6F"),  # Yellow
    ("#8E44AD", "#BB8FCE"),  # Deep Purple
    ("#16A085", "#73C6B6"),  # Sea Green
    ("#2980B9", "#85C1E9"),  # Ocean Blue
    ("#D35400", "#EB984E"),  # Burnt Orange
    ("#C0392B", "#E6B0AA"),  # Dark Red
    ("#2C3E50", "#85929E"),  # Dark Blue Gray
]


def get_random_colors() -> tuple[str, str]:
    """Get a random color palette (primary, secondary)."""
    return random.choice(COLOR_PALETTES)


def generate_colors_from_seed(seed: str) -> tuple[str, str]:
    """Generate consistent colors based on a seed string (e.g., reciter ID)."""
    random.seed(seed)
    colors = random.choice(COLOR_PALETTES)
    random.seed()  # Reset seed
    return colors
