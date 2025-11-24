
export const pad = (n) => String(n).padStart(2, "0");

export function normalizeZohoUsers(zohoUsersArray = []) {
  const hosts = [];
  const rolesById = new Map(); // roleId -> { id, name }

  for (const u of zohoUsersArray) {
    const id = String(u?.id || u?.created_by?.id || "").trim();
    if (!id) continue;

    const status = String(u?.status ?? "").toLowerCase().trim();
    if (status && status !== "active") continue; // skip inactive

    const first = (u?.first_name || "").trim();
    const last  = (u?.last_name || "").trim();
    const name  = (u?.full_name || `${first} ${last}` || "").trim() || "Unknown";
    const email = (u?.email || "").trim();

    // role is guaranteed to be { id, name } (may be null/undefined)
    const roleObj  = u?.role || null;
    const roleId   = roleObj?.id ? String(roleObj.id) : "";
    const roleName = roleObj?.name ? String(roleObj.name) : "";

    if (roleId || roleName) {
      const key = roleId || roleName;
      if (!rolesById.has(key)) {
        rolesById.set(key, { id: roleId || roleName, name: roleName || roleId });
      }
    }

    hosts.push({
      id,
      name,
      email,
      roleId,
      roleName,
      imageLink: u?.image_link || u?.imageLink || "",
      raw: u,
    });
  }

  // Optional: sort roles by name
  const roles = Array.from(rolesById.values()).sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
  );

  return { hosts, roles };
}


// Helper: sort team so hosts WITH meetings come first, then the rest (alphabetically by name)
export function prioritizeTeam(allHosts, meetingHostIds) {
   const withMeetings = [];
   const withoutMeetings = [];
   const meetingSet = new Set(meetingHostIds);
   for (const h of allHosts) {
     if (meetingSet.has(h.id)) withMeetings.push(h);
     else withoutMeetings.push(h);
   }
   withMeetings.sort((a,b)=>a.name.localeCompare(b.name, undefined, {sensitivity:"base"}));
   withoutMeetings.sort((a,b)=>a.name.localeCompare(b.name, undefined, {sensitivity:"base"}));
   return [...withMeetings, ...withoutMeetings];
}

/** Local day bounds (00:00:00 → 23:59:59) in local time */
export function getLocalDayBounds(date) {
  const dt = new Date(date);
  const start = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate(), 0, 0, 0, 0);
  const end   = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate(), 23, 59, 59, 0);
  return { start, end };
}

/**
 * Make ISO 8601 with colon offset, e.g. "2025-10-29T00:00:00+05:30"
 * This matches the format in Zoho’s doc:
 *   ...T18%3A52%3A56%2B00%3A00  (note the %2B00%3A00 = +00:00)
 */
export function toZohoIsoWithColonOffset(date) {
  const d = new Date(date);
  const yyyy = d.getFullYear();
  const mm   = pad(d.getMonth() + 1);
  const dd   = pad(d.getDate());
  const hh   = pad(d.getHours());
  const mi   = pad(d.getMinutes());
  const ss   = pad(d.getSeconds());

  const offMin = -d.getTimezoneOffset(); // minutes east of UTC
  const sign   = offMin >= 0 ? "+" : "-";
  const abs    = Math.abs(offMin);
  const oh     = pad(Math.floor(abs / 60));
  const om     = pad(abs % 60);

  // include the colon in the offset -> +05:30
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}:${ss}${sign}${oh}:${om}`;
}

// Optional client-side fallback if needed anywhere else
export function touchesDay(record, start, end) {
  const s = new Date(record.Start_DateTime);
  const e = new Date(record.End_DateTime);
  return !(e < start || s > end);
}

export function parseToMinutes(t) {
  if (t instanceof Date) return t.getHours() * 60 + t.getMinutes();
  if (typeof t === "number") return t;
  const s = String(t).trim().toLowerCase();

  if (s.includes("t") || s.includes("-")) {
    const d = new Date(s);
    return d.getHours() * 60 + d.getMinutes();
  }
  const ampm = s.endsWith("am") || s.endsWith("pm") ? s.slice(-2) : "";
  const core = ampm ? s.slice(0, -2) : s;
  const [hStr, mStr = "0"] = core.split(":");
  let h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10) || 0;
  if (ampm === "am") { if (h === 12) h = 0; }
  if (ampm === "pm") { if (h !== 12) h += 12; }
  return h * 60 + m;
}