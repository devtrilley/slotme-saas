from datetime import datetime, timezone
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
from typing import Optional

# US-only timezone whitelist for MVP
US_TIMEZONES = {
    "America/New_York": "Eastern Time",
    "America/Chicago": "Central Time",
    "America/Denver": "Mountain Time",
    "America/Phoenix": "Mountain Time (No DST)",
    "America/Los_Angeles": "Pacific Time",
    "America/Anchorage": "Alaska Time",
    "America/Adak": "Hawaii-Aleutian Time",
}


def get_timezone_abbreviation(tz_name: str, dt: datetime = None) -> str:
    if dt is None:
        dt = datetime.now()
    try:
        tz = ZoneInfo(tz_name)
        localized_dt = dt.replace(tzinfo=timezone.utc).astimezone(tz)
        return localized_dt.strftime("%Z")
    except:
        return "UTC"


def utc_to_timezone(utc_dt: datetime, target_tz: str) -> datetime:
    if utc_dt.tzinfo is None:
        utc_dt = utc_dt.replace(tzinfo=timezone.utc)
    try:
        target_zone = ZoneInfo(target_tz)
        return utc_dt.astimezone(target_zone)
    except:
        return utc_dt


def timezone_to_utc(local_dt: datetime, source_tz: str) -> datetime:
    try:
        source_zone = ZoneInfo(source_tz)
        if local_dt.tzinfo is None:
            local_dt = local_dt.replace(tzinfo=source_zone)
        return local_dt.astimezone(timezone.utc)
    except:
        return local_dt.replace(tzinfo=timezone.utc)


def format_time_for_display(
    utc_dt: datetime, display_tz: str, include_date: bool = True
) -> str:
    local_dt = utc_to_timezone(utc_dt, display_tz)
    tz_abbr = get_timezone_abbreviation(display_tz, utc_dt)
    if include_date:
        return local_dt.strftime(f"%a, %b %-d — %-I:%M %p ({tz_abbr})")
    else:
        return local_dt.strftime(f"%-I:%M %p ({tz_abbr})")


def format_dual_timezone(
    utc_dt: datetime,
    tz1: str,
    tz2: str,
    tz1_label: str = "Your Time",
    tz2_label: str = None,
) -> str:
    time1 = format_time_for_display(utc_dt, tz1, include_date=False)
    time2 = format_time_for_display(utc_dt, tz2, include_date=False)
    tz2_display = tz2_label or get_timezone_abbreviation(tz2, utc_dt)
    return f"{time1.replace(f'({get_timezone_abbreviation(tz1, utc_dt)})', f'({tz1_label})')} • {time2}"


def validate_timezone(tz_name: str) -> bool:
    return tz_name in US_TIMEZONES


def get_freelancer_timezone(freelancer) -> str:
    return (
        freelancer.timezone
        if validate_timezone(freelancer.timezone)
        else "America/New_York"
    )


def parse_time_slot_for_timezone(
    time_str: str, date_str: str, source_tz: str
) -> datetime:
    time_obj = datetime.strptime(time_str, "%I:%M %p").time()
    date_obj = datetime.strptime(date_str, "%Y-%m-%d").date()
    local_dt = datetime.combine(date_obj, time_obj)
    return timezone_to_utc(local_dt, source_tz)


def utc_label_to_datetime(label_12h: str) -> datetime:
    """
    Converts a 12-hour time label (e.g., "02:00 PM") to a UTC datetime for today.
    This is used for testing or seeding when only time labels are available.
    """
    from datetime import date

    today = date.today()
    local_time = datetime.strptime(label_12h, "%I:%M %p").time()
    combined = datetime.combine(today, local_time)
    return combined.replace(tzinfo=timezone.utc)


from datetime import datetime, timedelta


def standardize_time_label(time_str):
    """
    Standardize time labels to match your MasterTimeSlot format.
    This version keeps zero-padding for "09:00 AM" etc.
    """
    try:
        dt = datetime.strptime(time_str.strip(), "%I:%M %p")
        return dt.strftime("%I:%M %p")  # Zero-padded for compatibility with DB
    except ValueError as e:
        print(f"WARNING: Failed to parse time '{time_str}': {e}")
        return time_str


def generate_master_time_labels():
    """
    Generate all possible time labels in standardized format
    """
    labels = []
    for hour in range(24):
        for minute in [0, 15, 30, 45]:
            dt = datetime(2000, 1, 1, hour, minute)
            label = dt.strftime("%I:%M %p")
            labels.append({"time_24h": dt.strftime("%H:%M"), "label": label})
    return labels


def validate_time_range(start_time, end_time, freelancer_tz):
    """
    Validates that a time range makes sense
    """
    try:
        start_dt = datetime.strptime(start_time, "%I:%M %p")
        end_dt = datetime.strptime(end_time, "%I:%M %p")
        if end_dt <= start_dt:
            end_dt += timedelta(days=1)
        return True, start_dt, end_dt
    except ValueError:
        return False, None, None


def create_localized_datetime(date_obj, time_obj, timezone_name):
    try:
        tz = ZoneInfo(timezone_name)
        naive_dt = datetime.combine(date_obj, time_obj)
        return naive_dt.replace(tzinfo=tz)
    except Exception as e:
        print(f"ERROR: Failed to create localized datetime: {e}")
        return datetime.combine(date_obj, time_obj, tzinfo=timezone.utc)


def parse_time_in_timezone(time_str, date_str, timezone_name):
    try:
        date_obj = datetime.strptime(date_str, "%Y-%m-%d").date()
        time_obj = datetime.strptime(time_str, "%I:%M %p").time()
        naive_dt = datetime.combine(date_obj, time_obj)
        tz = ZoneInfo(timezone_name)
        localized_dt = naive_dt.replace(tzinfo=tz)
        return localized_dt
    except ValueError as e:
        print(f"ERROR: Failed to parse time/date: {e}")
        raise ValueError(f"Invalid time or date format: {time_str}, {date_str}")
