import { DateTime } from "luxon";

// US-only timezone whitelist matching backend
export const US_TIMEZONES = {
  "America/New_York": "Eastern Time",
  "America/Chicago": "Central Time",
  "America/Denver": "Mountain Time",
  "America/Phoenix": "Mountain Time (No DST)",
  "America/Los_Angeles": "Pacific Time",
  "America/Anchorage": "Alaska Time",
  "America/Adak": "Hawaii-Aleutian Time",
};

/**
 * Get timezone abbreviation using Luxon (e.g. "EDT", "PST")
 */
export function getTimezoneAbbreviation(timezone, date = new Date()) {
  try {
    const dt = DateTime.fromJSDate(date).setZone(timezone);
    return dt.toFormat("ZZZZ"); // Short timezone name like "EDT", "PST"
  } catch (error) {
    console.warn("Failed to get timezone abbreviation:", error);
    return "UTC";
  }
}

// Wrapper for local slot format (e.g. from CRM or internal bookings)
export function formatSlotTimePartsFromLocal(slot, freelancerTimezone) {
  return formatSlotTimeParts(slot, freelancerTimezone);
}

// Wrapper to explicitly format slot times from UTC (for clarity)
export function formatSlotTimePartsFromUTC(slot, freelancerTimezone) {
  return formatSlotTimeParts(slot, freelancerTimezone);
}

/**
 * Format slot date (e.g. "Tue, Sep 12") in freelancer timezone
 */
export function formatSlotDate(slot, freelancerTimezone) {
  try {
    // 🔥 Use slot's frozen timezone if available
    const targetTimezone = slot.timezone || freelancerTimezone;

    // Reuse the same parsing logic as formatSlotTimeParts
    const utcDateTime = parseSlotToUTCDateTime(slot);

    if (!utcDateTime) {
      console.error("Failed to parse slot for date formatting:", slot);
      return slot.day; // Fallback to raw date if parsing fails
    }

    // Convert UTC to target timezone
    const freelancerTime = utcDateTime.setZone(targetTimezone);

    // Format as "Wed, Oct 14"
    return freelancerTime.toFormat("EEE, MMM d");
  } catch (error) {
    console.error("Failed to format slot date:", error, slot);
    return slot.day;
  }
}

/**
 * Convenience function: format complete slot time display
 * Returns: "2:30 PM EDT"
 */
export function formatSlotTime(slot, freelancerTimezone) {
  const { formattedTime, abbreviation } = formatSlotTimeParts(
    slot,
    freelancerTimezone
  );
  return `${formattedTime} ${abbreviation}`;
}

// Utility functions for other parts of app
export function getFreelancerDateString(jsDate, freelancerTimezone) {
  try {
    const dt = DateTime.fromJSDate(jsDate).setZone(freelancerTimezone);
    return dt.toFormat("yyyy-MM-dd");
  } catch (error) {
    console.warn("Failed to get freelancer date string:", error);
    return DateTime.fromJSDate(jsDate).toFormat("yyyy-MM-dd");
  }
}

export function parseFreelancerDate(dateString, freelancerTimezone) {
  try {
    const dt = DateTime.fromISO(dateString).setZone(freelancerTimezone);
    return dt.toJSDate();
  } catch (error) {
    console.warn("Failed to parse freelancer date:", error);
    return new Date(dateString);
  }
}

export function getTimezoneOptions() {
  return Object.entries(US_TIMEZONES).map(([value, label]) => ({
    value,
    label: `${label} (${getTimezoneAbbreviation(value)})`,
  }));
}

export function getBrowserTimezone() {
  try {
    const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return US_TIMEZONES[detected] ? detected : "America/New_York";
  } catch {
    return "America/New_York";
  }
}

export function saveUserTimezone(timezone) {
  if (US_TIMEZONES[timezone]) {
    localStorage.setItem("user_timezone", timezone);
  }
}

export function getUserTimezone() {
  const stored = localStorage.getItem("user_timezone");
  if (stored && US_TIMEZONES[stored]) {
    return stored;
  }
  const detected = getBrowserTimezone();
  saveUserTimezone(detected);
  return detected;
}

export function getTimezoneFullName(zoneId) {
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: zoneId,
      timeZoneName: "long",
    });
    const parts = formatter.formatToParts(new Date());
    const namePart = parts.find((p) => p.type === "timeZoneName");
    return namePart?.value || zoneId;
  } catch (err) {
    console.error("Invalid zone ID:", zoneId);
    return zoneId;
  }
}

// ---------------------------------

// Fixed version of isSlotInPast and helper functions

function parseSlotToUTCDateTime(slot) {
  // 🔥 PRIORITY: Use time_24h first (backend's canonical 24-hour format)
  const utcTime24h = slot.time_24h;
  const utcTime12h = slot.time_12h || slot.time;

  if (!utcTime24h && !utcTime12h) {
    console.warn("Slot missing time data:", slot);
    return null;
  }

  let slotDateTime;

  // 🔥 FIX: Always try 24-hour format first (most reliable)
  if (utcTime24h) {
    slotDateTime = DateTime.fromFormat(
      `${slot.day} ${utcTime24h}`,
      "yyyy-MM-dd HH:mm",
      { zone: "UTC" }
    );

    if (slotDateTime.isValid) {
      return slotDateTime;
    }
  }

  // 🔥 FALLBACK: Try 12-hour format if 24-hour failed
  if (utcTime12h) {
    // Try with zero-padded hour first (e.g., "05:00 AM")
    slotDateTime = DateTime.fromFormat(
      `${slot.day} ${utcTime12h}`,
      "yyyy-MM-dd hh:mm a",
      { zone: "UTC" }
    );

    if (slotDateTime.isValid) {
      return slotDateTime;
    }

    // Try without zero-padding (e.g., "5:00 AM")
    slotDateTime = DateTime.fromFormat(
      `${slot.day} ${utcTime12h}`,
      "yyyy-MM-dd h:mm a",
      { zone: "UTC" }
    );

    if (slotDateTime.isValid) {
      return slotDateTime;
    }
  }

  console.error("Failed to parse slot time:", {
    time_24h: utcTime24h,
    time_12h: utcTime12h,
    day: slot.day,
    invalidReason: slotDateTime?.invalidReason,
  });
  return null;
}

/**
 * Check if a slot is in the past (based on freelancer timezone)
 * FIXED VERSION - more robust parsing
 */
export function isSlotInPast(slot, freelancerTimezone) {
  try {
    const targetTimezone = slot.timezone || freelancerTimezone;
    const slotDateTimeUTC = parseSlotToUTCDateTime(slot);

    if (!slotDateTimeUTC) {
      console.warn("Failed to parse slot time, assuming not past:", slot);
      return false;
    }

    // Convert UTC to slot's timezone
    const slotInTargetTZ = slotDateTimeUTC.setZone(targetTimezone);
    // Get current time in SAME timezone for comparison
    const nowInTargetTZ = DateTime.now().setZone(targetTimezone);

    return slotInTargetTZ < nowInTargetTZ;
  } catch (error) {
    console.warn("Failed to check if slot is past:", error, slot);
    return false;
  }
}

export function formatSlotTimeParts(slot, freelancerTimezone) {
  try {
    // 🔥 Use slot's frozen timezone if available, otherwise fall back
    const targetTimezone = slot.timezone || freelancerTimezone;

    // Use the same UTC parsing logic
    const utcDateTime = parseSlotToUTCDateTime(slot);

    if (!utcDateTime) {
      throw new Error(`Invalid time format in slot: ${JSON.stringify(slot)}`);
    }

    // Convert UTC to target timezone
    const localTime = utcDateTime.setZone(targetTimezone);

    return {
      formattedTime: localTime.toFormat("h:mm a"),
      abbreviation: localTime.offsetNameShort || localTime.toFormat("ZZZZ"),
    };
  } catch (error) {
    console.error("Failed to format slot time:", error, slot);
    return {
      formattedTime: "Invalid Time",
      abbreviation: "UTC",
    };
  }
}

/**
 * Check if a UTC slot falls on the given local date in the specified timezone
 */
export function isSlotOnDate(slot, selectedDate, timezone) {
  try {
    // 🔥 Use slot's frozen timezone if available
    const targetTimezone = slot.timezone || timezone;

    // Parse the UTC slot datetime
    const utcTime24h = slot.time_24h || slot.time;
    if (!utcTime24h || !slot.day) return false;

    // Create UTC DateTime from slot data
    const slotDateTimeUTC = DateTime.fromFormat(
      `${slot.day} ${utcTime24h}`,
      "yyyy-MM-dd HH:mm",
      { zone: "UTC" }
    );

    if (!slotDateTimeUTC.isValid) return false;

    // Convert to target timezone
    const slotInLocalTZ = slotDateTimeUTC.setZone(targetTimezone);

    // 🔥 FIX: Treat selectedDate as a calendar date, not an instant
    // Create a new DateTime at midnight in the freelancer's timezone
    const selectedInLocalTZ = DateTime.fromObject(
      {
        year: selectedDate.getFullYear(),
        month: selectedDate.getMonth() + 1,
        day: selectedDate.getDate(),
      },
      { zone: timezone }
    );

    // Compare just the dates (ignore time)
    return slotInLocalTZ.hasSame(selectedInLocalTZ, "day");
  } catch (error) {
    console.warn("Failed to check if slot is on date:", error, slot);
    return false;
  }
}
