/**
 * Business Hours Service
 * Handles user-specific business hours, vacation, and day-off tracking
 */

const SMS_CONN_NAME = "zohoadvancecalendar";
const API_DOMAIN = "https://www.zohoapis.com";

// Cache for user business hours (to avoid repeated API calls)
const userHoursCache = new Map();
const userTimeOffCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Check if Zoho SDK is available and initialized
 */
function isZohoSDKReady() {
  try {
    return !!(window?.ZOHO?.CRM?.CONNECTION);
  } catch {
    return false;
  }
}

/**
 * Day names for consistency
 */
const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

/**
 * Default business hours (fallback)
 */
const DEFAULT_BUSINESS_HOURS = {
  Monday: { start: "09:00", end: "18:00", isWorkDay: true },
  Tuesday: { start: "09:00", end: "18:00", isWorkDay: true },
  Wednesday: { start: "09:00", end: "18:00", isWorkDay: true },
  Thursday: { start: "09:00", end: "18:00", isWorkDay: true },
  Friday: { start: "09:00", end: "18:00", isWorkDay: true },
  Saturday: { start: "00:00", end: "00:00", isWorkDay: false },
  Sunday: { start: "00:00", end: "00:00", isWorkDay: false },
};

/**
 * Get organization-level business hours from Zoho
 */
export async function getOrgBusinessHours() {
  try {
    if (!isZohoSDKReady()) {
      return DEFAULT_BUSINESS_HOURS;
    }
    
    const resp = await ZOHO.CRM.CONNECTION.invoke(SMS_CONN_NAME, {
      method: "GET",
      url: `${API_DOMAIN}/crm/v8/settings/business_hours`,
    });

    const bh = resp?.details?.statusMessage?.business_hours || null;
    if (!bh) return DEFAULT_BUSINESS_HOURS;

    return parseBusinessHoursResponse(bh);
  } catch (err) {
    console.warn("Could not fetch org business hours:", err);
    return DEFAULT_BUSINESS_HOURS;
  }
}

/**
 * Get user-specific business hours
 * Falls back to org hours if user doesn't have custom hours
 */
export async function getUserBusinessHours(userId) {
  if (!userId) return DEFAULT_BUSINESS_HOURS;

  // Check cache first
  const cached = userHoursCache.get(userId);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.hours;
  }

  // Check SDK availability
  if (!isZohoSDKReady()) {
    return DEFAULT_BUSINESS_HOURS;
  }

  try {
    // Try to get user-specific business hours from user profile
    const userResp = await ZOHO.CRM.API.getUser({ ID: userId });
    const user = userResp?.users?.[0];

    if (!user) {
      return getOrgBusinessHours();
    }

    // Check if user has custom business hours fields
    // These would be custom fields on the User record
    const customHours = user.Business_Hours || user.Working_Hours || null;
    
    let hours;
    if (customHours) {
      hours = parseUserCustomHours(customHours);
    } else {
      // Check shift/role-based hours
      const roleHours = await getRoleBasedHours(user.role?.id);
      hours = roleHours || (await getOrgBusinessHours());
    }

    // Cache the result
    userHoursCache.set(userId, {
      hours,
      timestamp: Date.now(),
    });

    return hours;
  } catch (err) {
    console.warn("Could not fetch user business hours:", err);
    return getOrgBusinessHours();
  }
}

/**
 * Get role-based business hours (for users with specific roles)
 */
async function getRoleBasedHours(roleId) {
  if (!roleId) return null;

  try {
    // This assumes you have a custom module or settings for role-based hours
    const resp = await ZOHO.CRM.API.searchRecords({
      Entity: "Role_Business_Hours", // Custom module name
      Type: "criteria",
      Query: `(Role:equals:${roleId})`,
    });

    const roleHours = resp?.data?.[0];
    if (roleHours) {
      return parseRoleHours(roleHours);
    }
  } catch (err) {
    // Role-based hours module might not exist - that's ok
    console.debug("Role-based hours not configured:", err);
  }

  return null;
}

/**
 * Get user's vacation/day-off records for a date range
 */
export async function getUserTimeOff(userId, startDate, endDate) {
  if (!userId) return [];
  
  // Check SDK availability first
  if (!isZohoSDKReady()) {
    return [];
  }

  // Check cache first (cache key includes userId and date range)
  const start = formatDateForQuery(startDate);
  const end = formatDateForQuery(endDate);
  const cacheKey = `${userId}_${start}_${end}`;
  const cached = userTimeOffCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.timeOff;
  }

  try {

    // Try to get from Zoho Leave/Time-off module or custom module
    const criteria = `(Owner:equals:${userId})and(Start_Date:less_equal:${end})and(End_Date:greater_equal:${start})`;

    // Try different possible module names for time-off
    const moduleNames = ["Time_Off", "Leave_Requests", "Vacations", "User_Leaves"];
    
    for (const moduleName of moduleNames) {
      try {
        const resp = await ZOHO.CRM.CONNECTION.invoke(SMS_CONN_NAME, {
          method: "GET",
          url: `${API_DOMAIN}/crm/v8/${moduleName}/search?criteria=${encodeURIComponent(criteria)}`,
        });

        const records = resp?.details?.statusMessage?.data || [];
        if (records.length > 0) {
          const timeOff = records.map((r) => ({
            id: r.id,
            userId: r.Owner?.id || userId,
            startDate: r.Start_Date || r.From_Date,
            endDate: r.End_Date || r.To_Date,
            type: r.Leave_Type || r.Type || "vacation",
            status: r.Status || "approved",
            allDay: r.All_Day !== false,
            reason: r.Reason || r.Description || "",
          }));
          
          // Cache the result
          userTimeOffCache.set(cacheKey, {
            timeOff,
            timestamp: Date.now(),
          });
          
          return timeOff;
        }
      } catch (moduleErr) {
        // Module doesn't exist - try next one
        continue;
      }
    }

    // Fallback: Check Events module for "Day Off" or "Vacation" type events
    const eventsCriteria = 
      `(Owner:equals:${userId})` +
      `and(Start_DateTime:less_equal:${end}T23:59:59+00:00)` +
      `and(End_DateTime:greater_equal:${start}T00:00:00+00:00)` +
      `and((Appointment_Type:equals:Day Off)or(Appointment_Type:equals:Vacation)or(Appointment_Type:equals:PTO))`;

    const eventsResp = await ZOHO.CRM.CONNECTION.invoke(SMS_CONN_NAME, {
      method: "GET",
      url: `${API_DOMAIN}/crm/v8/Events/search?criteria=${encodeURIComponent(eventsCriteria)}`,
    });

    const events = eventsResp?.details?.statusMessage?.data || [];
    const timeOff = events.map((e) => ({
      id: e.id,
      userId: e.Owner?.id || userId,
      startDate: e.Start_DateTime?.split("T")[0],
      endDate: e.End_DateTime?.split("T")[0],
      type: e.Appointment_Type?.toLowerCase() || "day_off",
      status: "approved",
      allDay: e.All_day || true,
      reason: e.Event_Title || "",
    }));
    
    // Cache the result
    userTimeOffCache.set(cacheKey, {
      timeOff,
      timestamp: Date.now(),
    });
    
    return timeOff;
  } catch (err) {
    console.warn("Could not fetch user time-off:", err);
    return [];
  }
}

/**
 * Check if a specific date/time is within business hours for a user
 */
export function isWithinBusinessHours(businessHours, dateTime) {
  const date = new Date(dateTime);
  const dayName = DAY_NAMES[date.getDay()];
  const dayHours = businessHours[dayName];

  if (!dayHours || !dayHours.isWorkDay) {
    return false;
  }

  const timeMinutes = date.getHours() * 60 + date.getMinutes();
  const startMinutes = parseTimeToMinutes(dayHours.start);
  const endMinutes = parseTimeToMinutes(dayHours.end);

  return timeMinutes >= startMinutes && timeMinutes < endMinutes;
}

/**
 * Check if a date is a day off for a user
 */
export function isDateDayOff(timeOffRecords, date) {
  const checkDate = new Date(date);
  checkDate.setHours(0, 0, 0, 0);

  for (const record of timeOffRecords) {
    if (record.status !== "approved") continue;

    const startDate = new Date(record.startDate);
    startDate.setHours(0, 0, 0, 0);
    
    const endDate = new Date(record.endDate);
    endDate.setHours(23, 59, 59, 999);

    if (checkDate >= startDate && checkDate <= endDate) {
      // Ensure type and reason are strings (Zoho might return objects like {name, id})
      const typeVal = record.type;
      const typeStr = typeof typeVal === 'object' && typeVal !== null 
        ? (typeVal.name || typeVal.display_value || typeVal.value || 'Day Off')
        : (typeVal || 'Day Off');
      
      const reasonVal = record.reason;
      const reasonStr = typeof reasonVal === 'object' && reasonVal !== null
        ? (reasonVal.name || reasonVal.display_value || reasonVal.value || '')
        : (reasonVal || '');

      return {
        isDayOff: true,
        type: String(typeStr),
        reason: String(reasonStr),
      };
    }
  }

  return { isDayOff: false, type: '', reason: '' };
}

/**
 * Get blocked time slots for a user on a specific day
 * Returns array of { start, end, reason } objects
 */
export async function getBlockedSlots(userId, date) {
  const blocked = [];
  const dateObj = new Date(date);
  const dayName = DAY_NAMES[dateObj.getDay()];

  // Get user's business hours
  const businessHours = await getUserBusinessHours(userId);
  const dayHours = businessHours[dayName];

  // If not a work day, entire day is blocked
  if (!dayHours || !dayHours.isWorkDay) {
    blocked.push({
      start: "00:00",
      end: "24:00",
      reason: "Non-working day",
      type: "non_working",
    });
    return blocked;
  }

  // Block time before business hours start
  if (dayHours.start !== "00:00") {
    blocked.push({
      start: "00:00",
      end: dayHours.start,
      reason: "Before business hours",
      type: "outside_hours",
    });
  }

  // Block time after business hours end
  if (dayHours.end !== "24:00" && dayHours.end !== "23:59") {
    blocked.push({
      start: dayHours.end,
      end: "24:00",
      reason: "After business hours",
      type: "outside_hours",
    });
  }

  // Check for vacation/day-off
  const timeOff = await getUserTimeOff(userId, date, date);
  const dayOffInfo = isDateDayOff(timeOff, date);
  
  if (dayOffInfo.isDayOff) {
    // Clear other blocks and mark entire day as off
    blocked.length = 0;
    blocked.push({
      start: "00:00",
      end: "24:00",
      reason: dayOffInfo.reason || `${dayOffInfo.type}`,
      type: dayOffInfo.type,
    });
  }

  return blocked;
}

/**
 * Get business hours info for calendar display
 * Returns structured data for rendering blocked areas
 */
export async function getCalendarBusinessHoursInfo(userId, date) {
  const dateObj = new Date(date);
  const dayName = DAY_NAMES[dateObj.getDay()];
  
  const businessHours = await getUserBusinessHours(userId);
  const dayHours = businessHours[dayName];
  const timeOff = await getUserTimeOff(userId, date, date);
  const dayOffInfo = isDateDayOff(timeOff, date);

  return {
    dayName,
    isWorkDay: dayHours?.isWorkDay && !dayOffInfo.isDayOff,
    startTime: dayHours?.start || "00:00",
    endTime: dayHours?.end || "00:00",
    isDayOff: dayOffInfo.isDayOff,
    dayOffType: dayOffInfo.type,
    dayOffReason: dayOffInfo.reason,
    blockedSlots: await getBlockedSlots(userId, date),
  };
}

/**
 * Batch get business hours info for multiple users
 */
export async function getBatchCalendarInfo(userIds, date) {
  const results = new Map();

  await Promise.all(
    userIds.map(async (userId) => {
      const info = await getCalendarBusinessHoursInfo(userId, date);
      results.set(userId, info);
    })
  );

  return results;
}

// ============ Helper Functions ============

function parseBusinessHoursResponse(bh) {
  const result = { ...DEFAULT_BUSINESS_HOURS };
  const rawDays = bh.business_days || bh.businessDays || bh.days || bh;

  if (Array.isArray(rawDays)) {
    for (const d of rawDays) {
      const name = normalizeDAyName(d.day || d.name || "");
      if (!name) continue;

      result[name] = {
        start: d.start_time || d.start || d.open_time || "09:00",
        end: d.end_time || d.end || d.close_time || "18:00",
        isWorkDay: d.is_business_day !== false,
      };
    }
  } else if (rawDays && typeof rawDays === "object") {
    for (const k of Object.keys(rawDays)) {
      const name = normalizeDAyName(k);
      if (!name) continue;

      const entry = rawDays[k];
      result[name] = {
        start: entry.start_time || entry.start || "09:00",
        end: entry.end_time || entry.end || "18:00",
        isWorkDay: entry.is_business_day !== false,
      };
    }
  }

  return result;
}

function parseUserCustomHours(customHours) {
  // Custom hours might be stored as JSON string or object
  let parsed = customHours;
  if (typeof customHours === "string") {
    try {
      parsed = JSON.parse(customHours);
    } catch {
      return DEFAULT_BUSINESS_HOURS;
    }
  }

  return parseBusinessHoursResponse(parsed);
}

function parseRoleHours(roleHours) {
  return {
    Monday: {
      start: roleHours.Monday_Start || "09:00",
      end: roleHours.Monday_End || "18:00",
      isWorkDay: roleHours.Monday_Working !== false,
    },
    Tuesday: {
      start: roleHours.Tuesday_Start || "09:00",
      end: roleHours.Tuesday_End || "18:00",
      isWorkDay: roleHours.Tuesday_Working !== false,
    },
    Wednesday: {
      start: roleHours.Wednesday_Start || "09:00",
      end: roleHours.Wednesday_End || "18:00",
      isWorkDay: roleHours.Wednesday_Working !== false,
    },
    Thursday: {
      start: roleHours.Thursday_Start || "09:00",
      end: roleHours.Thursday_End || "18:00",
      isWorkDay: roleHours.Thursday_Working !== false,
    },
    Friday: {
      start: roleHours.Friday_Start || "09:00",
      end: roleHours.Friday_End || "18:00",
      isWorkDay: roleHours.Friday_Working !== false,
    },
    Saturday: {
      start: roleHours.Saturday_Start || "00:00",
      end: roleHours.Saturday_End || "00:00",
      isWorkDay: roleHours.Saturday_Working === true,
    },
    Sunday: {
      start: roleHours.Sunday_Start || "00:00",
      end: roleHours.Sunday_End || "00:00",
      isWorkDay: roleHours.Sunday_Working === true,
    },
  };
}

function normalizeDAyName(name) {
  if (!name) return "";
  const lower = name.toLowerCase();
  return DAY_NAMES.find((d) => d.toLowerCase() === lower) || "";
}

function parseTimeToMinutes(timeStr) {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

function formatDateForQuery(date) {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// Clear cache (useful when user updates their hours)
export function clearUserHoursCache(userId) {
  if (userId) {
    userHoursCache.delete(userId);
  } else {
    userHoursCache.clear();
  }
}

export default {
  getOrgBusinessHours,
  getUserBusinessHours,
  getUserTimeOff,
  isWithinBusinessHours,
  isDateDayOff,
  getBlockedSlots,
  getCalendarBusinessHoursInfo,
  getBatchCalendarInfo,
  clearUserHoursCache,
  DEFAULT_BUSINESS_HOURS,
};

