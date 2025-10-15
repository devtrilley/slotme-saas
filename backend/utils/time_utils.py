from datetime import datetime, timezone


def utc_today():
    return datetime.now(timezone.utc).date()
