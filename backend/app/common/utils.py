"""Common utility functions."""


def sanitize_filename(filename: str) -> str:
    """Remove potentially dangerous characters from a filename."""
    import re

    return re.sub(r"[^\w\-.]", "_", filename)
