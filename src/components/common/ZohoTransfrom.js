/** Format: 'YYYY-MM-DD' in local time */
import {buildEventFromRecord} from '../../Context/CalendarContext';
import {decodeRecurringActivity} from '../Create&Edit/CreateMeetingModal'

function formatLocalDateKey(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

/** Checks whether a record intersects the shown day */
function recordTouchesDay(record, localDateKey) {
  const dayStart = new Date(`${localDateKey}T00:00:00`);
  const dayEnd = new Date(`${localDateKey}T23:59:59.999`);
  const start = new Date(record.Start_DateTime);
  const end = new Date(record.End_DateTime);
  return !(end < dayStart || start > dayEnd);
}

/** Extract host (Owner fallback to Created_By) in a readable shape */
function getHostFromRecord(record) {
  const owner = record.Owner || record.Created_By || {};
  return {
    hostId: owner.id || record.id,
    hostName: owner.name || "Unknown",
  };
}

/**
 * transformZohoRecordsForDay
 * - team: one column per unique host from ALL records
 * - sort: hosts WITH meetings that day first (A→Z), then hosts WITHOUT (A→Z)
 * - events: only meetings that touch the selected day
 */
export function transformZohoRecordsForDay(zohoRecords, selectedDate) {
  if (!Array.isArray(zohoRecords)) return { team: [], events: [] };

  const dateKey = formatLocalDateKey(selectedDate);

  // Hosts from ALL records (so empty-host columns still render)
  const allHostsMap = new Map(); // hostId -> { id, name }
  for (const rec of zohoRecords) {
    const { hostId, hostName } = getHostFromRecord(rec);
    if (!allHostsMap.has(hostId)) allHostsMap.set(hostId, { id: hostId, name: hostName });
  }

  // Records that touch the selected day
  const recordsForDay = zohoRecords.filter(
    (r) => r.Start_DateTime && r.End_DateTime && recordTouchesDay(r, dateKey)
  );

  // Mark which hosts have meetings that day
  const hostsWithMeetings = new Set();
  for (const rec of recordsForDay) {
    const { hostId } = getHostFromRecord(rec);
    hostsWithMeetings.add(hostId);
  }

  // Build the team list from ALL hosts, sorted:
  //    - first: hosts that have meetings that day (true > false)
  //    - then: by host name A→Z inside each group
  const team = Array.from(allHostsMap.values()).sort((a, b) => {
    const aHas = hostsWithMeetings.has(a.id);
    const bHas = hostsWithMeetings.has(b.id);
    if (aHas !== bHas) return aHas ? -1 : 1; // aHas first
    return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  });

  

  // Map events (only those on the selected day)
  const events = recordsForDay.map((r) => {
    const { hostId } = getHostFromRecord(r);
    return {
      id: r.id,
      userId: r.Owner.id,
      title: r.Event_Title || "Meeting",
      start: r.Start_DateTime, // ISO string
      end: r.End_DateTime, // ISO string
      meetingVenue: r.Meeting_Venue|| r.Meeting_Venue__s ,
      location: r.Venue || "",
      color: r.$colour_code,
      status: r.Check_In_Status || "PLANNED",
      allday: r.All_day || false,
      appointmentType: r.Appointment_Type || "",
      currency: r.Currency || "USD",
      participants: r.Participants || [],
      what_id: r.What_Id || null,
      who_id: r.Who_Id || null,
      se_module:r.$se_module,
      remind_at: r.Remind_At || null,
      created_by: r.Created_By,
      modified_by: r.Modified_by,
      owner:r.Owner,
      created_time:r.Created_Time,
      modified_time: r.Modified_time,
      recurring_Activity:r.Recurring_Activity,
      r,
    };
  });

  console.log('events', events)

  return { team, events };
}

function toUtcIsoString(value) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString(); // "2025-11-14T09:16:32.046Z"
}

function toLocalIsoString(value) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;

  const pad = (n) => String(n).padStart(2, "0");
  const tz = -d.getTimezoneOffset();
  const sign = tz >= 0 ? "+" : "-";
  const hh = pad(Math.floor(Math.abs(tz) / 60));
  const mm = pad(Math.abs(tz) % 60);

  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}${sign}${hh}:${mm}`
  );
}

// // RRULE builder for Recurring_Activity
// function buildRecurringActivity(repeat, startDate) {
//   const r = (repeat || "").toLowerCase();
//   if (!r || r === "does not repeat") return "";

//   const d = startDate ? (startDate instanceof Date ? startDate : new Date(startDate)) : new Date();
//   if (Number.isNaN(d.getTime())) return "";

//   const pad = (n) => String(n).padStart(2, "0");
//   const y = d.getFullYear();
//   const m = pad(d.getMonth() + 1);
//   const day = pad(d.getDate());

//   let freq;
//   if (r === "daily") freq = "DAILY";
//   else if (r === "weekly") freq = "WEEKLY";
//   else if (r === "monthly") freq = "MONTHLY";
//   else return "";

//   // Matches the pattern you showed: RRULE:...;DTSTART=YYYY-MM-DD;UNTIL=-1
//   return `RRULE:FREQ=${freq};INTERVAL=1;DTSTART=${y}-${m}-${day};UNTIL=-1`;
// }

export function transformFormToZohoInsert(form) {
  const {
    subject,
    description,
    location,
    startDateTime,
    endDateTime,
    meetingVenue,
    status = "PLANNED",
    allDay,
    appointmentType,
    currency = "USD",
    repeat,
    relatedRecord,
    participants = [],
    host,
    remind_at,
  } = form || {};

  const start = startDateTime instanceof Date ? startDateTime : new Date(startDateTime);
  const end = endDateTime instanceof Date ? endDateTime : new Date(endDateTime);

  // map participants -> Zoho format
  const zohoParticipants = participants.map((p) => {
    // email-only invite
    if (p.type === "email") {
      const addr = p.participant || p.email || p.Email;
      return {
        name: p.name ?? null,
        participant: addr,
        type: "email",
        Email: p.Email || p.email || addr,
      };
    }

    // CRM record invite (Lead / Contact / etc.)
    return {
      id: p.id,
      name: p.Full_name || p.name || null,
      email: p.email || p.Email || null,
      type: p.type,
    };
  });

  // console.log('repeat value', repeat)

  return {
    // core fields
    Event_Title: subject || "",
    Description: description || "",
    Venue: location || "",
    Start_DateTime: toUtcIsoString(start),
    End_DateTime: toUtcIsoString(end),

    // related record (What_Id)
    What_Id: relatedRecord
      ? {
          id: relatedRecord.id,
          name: relatedRecord.name,
        }
      : null,

    // participants (array)
    Participants: zohoParticipants,

    // custom / other fields
    Meeting_Venue__s: meetingVenue || "",
    status,
    All_Day: !!allDay,
    Appointment_Type: appointmentType || "",
    Currency: currency || "USD",
    // Recurring_Activity: buildRecurringActivity(repeat, start),
    Recurring_Activity: decodeRecurringActivity(repeat),

    // host/owner – Zoho will treat Owner for assignment
    Owner: host?.id
      ? {
          id: host.id,
          name: host.name,
        }
      : undefined,
    Remind_At: remind_at ?? null,
  };
}

// convert JS Date / string -> Zoho datetime string (UTC)
// export function toZohoDateTime(value) {
//   if (!value) return null;
//   const d = value instanceof Date ? value : new Date(value);

//   const pad = (n) => String(n).padStart(2, "0");

//   const year = d.getFullYear();
//   const month = pad(d.getMonth() + 1);
//   const day = pad(d.getDate());
//   const hours = pad(d.getHours());
//   const minutes = pad(d.getMinutes());
//   const seconds = pad(d.getSeconds());

//   const offsetMinutes = -d.getTimezoneOffset(); // e.g. +330 for IST
//   const sign = offsetMinutes >= 0 ? "+" : "-";
//   const oh = pad(Math.floor(Math.abs(offsetMinutes) / 60));
//   const om = pad(Math.abs(offsetMinutes) % 60);

//   return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}${sign}${oh}:${om}`;
// }

// export function toZohoDate(value) {
//   if (!value) return null;
//   const d = value instanceof Date ? value : new Date(value);
//   const pad = (n) => String(n).padStart(2, "0");
//   return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
// }

// // build Recurring_Activity.RRULE from your "repeat" value
// export function buildRecurringActivity(repeat, startDateTime) {
//   if (!repeat || repeat === "Does not repeat") return null;

//   let freq;
//   switch (repeat) {
//     case "Daily":
//       freq = "DAILY";
//       break;
//     case "Weekly":
//       freq = "WEEKLY";
//       break;
//     case "Monthly":
//       freq = "MONTHLY";
//       break;
//     default:
//       return null;
//   }

//   const d = startDateTime ? new Date(startDateTime) : new Date();
//   const pad = (n) => String(n).padStart(2, "0");
//   const dtstart = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

//   return {
//     RRULE: `FREQ=${freq};INTERVAL=1;DTSTART=${dtstart};UNTIL=-1`,
//   };
// }

// export function buildZohoEventPayload(meetingForm, modalMode, currentUser) {
//   if (!meetingForm) meetingForm = {};

//   const {
//     subject,
//     description,
//     location,
//     startDateTime,
//     endDateTime,
//     meetingVenue,
//     status,
//     allDay,
//     appointmentType,
//     currency,
//     repeat,
//     host,
//     hostId,
//     relatedRecord,
//     relatedType,      // "Leads", "Contacts", etc.
//     participants = [],
//     remind_at,
//   } = meetingForm;

//   // Start / End in proper Zoho datetime format
//   const startDT = toZohoDateTime(startDateTime);
//   const endDT   = toZohoDateTime(endDateTime);

//   // For All Day events, Zoho expects Start_Date & End_Date instead of datetime
//   const startDateOnly = allDay ? toZohoDate(startDateTime) : null;
//   const endDateOnly   = allDay ? toZohoDate(endDateTime)   : null;

//   // Owner from host / hostId
//   const ownerInfo = host || (hostId ? { id: hostId } : null);

//   const owner = ownerInfo
//     ? {
//         id: ownerInfo.id,
//         name: ownerInfo.name,
//         email: ownerInfo.email || ownerInfo.Email || null,
//       }
//     : null;

//   // Created / Modified user – these are actually system fields,
//   // but you requested them in payload; Zoho will overwrite if needed.
//   const user =
//     currentUser && (currentUser.id || currentUser.user_id)
//       ? currentUser
//       : null;

//   const makeUserRef = (u) =>
//     u
//       ? {
//           id: u.id || u.user_id,
//           name: u.full_name || u.display_name || u.name,
//           email: u.email,
//         }
//       : null;

//   const Created_By = modalMode === "create" ? makeUserRef(user) : null;
//   const Modified_By = modalMode === "edit" ? makeUserRef(user) : null;

//   // Participants: normalise name/email fields into what Zoho expects
//   const mappedParticipants = participants.map((p) => ({
//     id: p.id || null,
//     name: p.Full_name || p.Full_Name || p.name || null,
//     email: p.email || p.Email || null,
//     type: p.type,
//     participant: p.participant, // for type === "email"
//   }));

//   // $se_module is the module of What_Id (Leads, Contacts, Deals, etc.)
//   const seModule =
//     relatedRecord && relatedType ? String(relatedType) : null;

//   // Recurring activity (RRULE) from your repeat field
//   const Recurring_Activity = buildRecurringActivity(repeat, startDateTime);

//   const payload = {
//     // Basic event fields
//     Event_Title: subject || "",
//     Description: description || "",
//     Venue: location || "",
//     status: status || "PLANNED",
//     Meeting_Venue__s: meetingVenue || null,
//     All_Day: !!allDay,
//     Appointment_Type: appointmentType || null,
//     Currency: currency || null,

//     // Datetimes / dates
//     Start_DateTime: allDay ? null : startDT,
//     End_DateTime: allDay ? null : endDT,
//     Start_Date: allDay ? startDateOnly : null,
//     End_Date: allDay ? endDateOnly : null,

//     // Related record (What_Id) + module
//     What_Id: relatedRecord || null,   // { id, name }
//     $se_module: seModule,             // "Leads", "Contacts", ...

//     // Participants list
//     Participants: mappedParticipants,

//     // Recurrence
//     Recurring_Activity,

//     // Reminder
//     Remind_At: remind_at ?? null,

//     // Owner / Created / Modified
//     Owner: owner,
//     Created_By,
//     Modified_By,

//     // Let Zoho fill these – do NOT set Created_Time/Modified_Time
//     Created_Time: null,
//     Modified_Time: null,

//     // you can keep your extra debug fields if you like:
//     // host: host,
//     // startIsoLocal: meetingForm.startIsoLocal,
//     // endIsoLocal: meetingForm.endIsoLocal,

//     trigger: ["workflow"],
//   };

//   return payload;
// }
