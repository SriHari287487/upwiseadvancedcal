// CalendarBody.jsx
import React, { useCallback, useMemo, useRef, useState, useEffect } from "react";
import "./calendarBody.scss";
import { transformZohoRecordsForDay } from "../common/ZohoTransfrom";
import { layoutLanes } from "../common/LaneLayout";
import EventCard from "../MeetingCard/EventCard";
import {
  useCalendarState,
  useCalendarActions,
  eventToMeetingForm,
} from "../../Context/CalendarContext";
/* ---------- Local hook for current time position ---------- */
function useNowTopLocal(rowHeight) {
  const computeTop = () => {
    const now = toLocalTZ(new Date());
    const minutes =
      now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;
    // rowHeight is pixels per hour, so 60 minutes = 1 row
    return (minutes / 60) * rowHeight;
  };

  const [nowTop, setNowTop] = useState(computeTop);

  useEffect(() => {
    const id = setInterval(() => {
      setNowTop(computeTop());
    }, 60000); // update every minute
    return () => clearInterval(id);
  }, [rowHeight]);

  return nowTop;
}
import { parseToMinutes, prioritizeTeam } from "../../Helper/HelperFunction";
import { getBusinessHours } from "../../Apis/zohoApi";
import { 
  getUserBusinessHours, 
  getUserTimeOff, 
  isDateDayOff,
  getBatchCalendarInfo 
} from "../../services/BusinessHoursService";
import { toast } from "react-toastify";
import { FiClock } from "react-icons/fi";
import MeetingSchedulerMUI from "../Create&Edit/CreateMeetingModal";
import { Avatar } from "@mui/material";

// Convert date into the system (client) timezone. Uses the browser's detected timezone.
function toLocalTZ(date) {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  return new Date(
    new Date(date).toLocaleString("en-US", { timeZone: tz })
  );
}

/* ---------- date helpers (no hooks here) ---------- */
function startOfWeek(d) {
  const dt = new Date(d);
  const day = dt.getDay(); // 0 = Sun
  dt.setDate(dt.getDate() - day);
  dt.setHours(0, 0, 0, 0);
  return dt;
}
function addDays(d, n) {
  const dt = new Date(d);
  dt.setDate(dt.getDate() + n);
  return dt;
}
function startOfMonth(d) {
  const dt = new Date(d.getFullYear(), d.getMonth(), 1);
  dt.setHours(0, 0, 0, 0);
  return dt;
}
function endOfMonth(d) {
  const dt = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  dt.setHours(23, 59, 59, 999);
  return dt;
}
function dateToISODay(d) {
  const dt = new Date(d);
  dt.setHours(0, 0, 0, 0);
  return dt.toISOString().slice(0, 10);
}

/* =========================================================
   WRAPPER: decides WHICH view component to render
   (no conditional hooks here, so no hook order issues)
   ========================================================= */
export default function CalendarBody({ view = "Day", setView }) {
  const state = useCalendarState();
  const actions = useCalendarActions();

  if (view === "Month")
    return <MonthView state={state} actions={actions} setView={setView} />;
  if (view === "Week") return <WeekView state={state} actions={actions} />;
  return <DayView state={state} actions={actions} />;
}

/* =========================================================
   MONTH VIEW
   ========================================================= */
function MonthView({ state, actions, setView }) {
  const { selectedDate, zohoRecords, appointmentTypeFilter, appointmentTypes } =
    state;
  const { openEdit } = actions;

  const { events: zohoEvents } = useMemo(
    () => transformZohoRecordsForDay(zohoRecords, selectedDate),
    [zohoRecords, selectedDate]
  );

  const events = zohoEvents || [];

  const appointmentTypeFilterCanon = useMemo(() => {
    if (!appointmentTypeFilter) return null;
    return String(appointmentTypeFilter).trim().toLowerCase();
  }, [appointmentTypeFilter]);

  const eventsByDay = useMemo(() => {
    const map = new Map();
    for (const ev of events) {
      if (!ev.start) continue;
      const s = new Date(ev.start);
      const e = ev.end ? new Date(ev.end) : s;
      const startDay = new Date(s);
      startDay.setHours(0, 0, 0, 0);
      const endDay = new Date(e);
      endDay.setHours(0, 0, 0, 0);
      for (
        let dt = new Date(startDay);
        dt <= endDay;
        dt.setDate(dt.getDate() + 1)
      ) {
        const key = dateToISODay(dt);
        if (!map.has(key)) map.set(key, []);
        map.get(key).push(ev);
      }
    }
    return map;
  }, [events]);

  const baseDate = selectedDate || new Date();
  const start = startOfMonth(baseDate);
  const gridStart = startOfWeek(start);
  const end = endOfMonth(baseDate);
  const gridEnd = addDays(startOfWeek(addDays(end, 6)), 6);

  const handleDayClick = (day) => {
    actions.goToDate?.(day); // if your context has a 'goToDate'
    actions.setSelectedDate?.(day); // OR whichever name is correct

    setView("Day"); // switches calendar to Day view
  };

  const days = [];
  for (let dt = new Date(gridStart); dt <= gridEnd; dt = addDays(dt, 1)) {
    days.push(new Date(dt));
  }

  const rows = [];
  for (let i = 0; i < days.length; i += 7) {
    rows.push(days.slice(i, i + 7));
  }

  return (
    <div className="cal-viewport month-view">
      <div className="month-grid">
        <div className="month-header-row">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
            <div key={d} className="month-header-cell">
              {d}
            </div>
          ))}
        </div>

        {rows.map((week, wi) => (
          <div key={wi} className="month-week-row">
            {week.map((day) => {
              const key = dateToISODay(day);
              const dayEvents = eventsByDay.get(key) || [];

              const filtered = appointmentTypeFilterCanon
                ? dayEvents.filter(
                    (ev) =>
                      String(ev.appointmentType || "")
                        .trim()
                        .toLowerCase() === appointmentTypeFilterCanon
                  )
                : dayEvents;

              const isCurrentMonth = day.getMonth() === baseDate.getMonth();

              return (
                <div
                  key={key}
                  className={`month-day-cell ${
                    isCurrentMonth ? "" : "month-day-outside"
                  }`}
                  style={{ minHeight: "180px" }}
                  onClick={() => handleDayClick(day)}
                >
                  <div className="month-day-number">{day.getDate()}</div>
                  <div className="month-day-events">
                    {filtered.slice(0, 3).map((ev) => (
                      <div
                        key={ev.id}
                        className="month-day-event"
                        onClick={() => openEdit(eventToMeetingForm(ev))}
                      >
                        {ev.title || ev.name || ev.subject || "Untitled"}
                      </div>
                    ))}
                    {filtered.length > 3 && (
                      <div className="month-more">
                        +{filtered.length - 3} more
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <MeetingSchedulerMUI />
    </div>
  );
}

/* =========================================================
   WEEK VIEW
   ========================================================= */
function WeekView({ state, actions }) {
  const { selectedDate, zohoRecords, appointmentTypeFilter } = state;
  const rowHeight = 180;
  const { openCreate, openEdit } = actions;

  const { events: zohoEvents } = useMemo(
    () => transformZohoRecordsForDay(zohoRecords, selectedDate),
    [zohoRecords, selectedDate]
  );
  const events = zohoEvents || [];

  const appointmentTypeFilterCanon = useMemo(() => {
    if (!appointmentTypeFilter) return null;
    return String(appointmentTypeFilter).trim().toLowerCase();
  }, [appointmentTypeFilter]);

  const eventsByDay = useMemo(() => {
    const map = new Map();
    for (const ev of events) {
      if (!ev.start) continue;
      const s = new Date(ev.start);
      const key = dateToISODay(s);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(ev);
    }
    return map;
  }, [events]);

  const start = startOfWeek(selectedDate || new Date());
  const days = Array.from({ length: 7 }).map((_, i) => addDays(start, i));

  const minutesLocal = (d) => {
    const dt = typeof d === "string" ? new Date(d) : d;
    return dt.getHours() * 60 + dt.getMinutes();
  };
  const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
  const DAY_MIN = 24 * 60;

  const outerYRef = useRef(null);
  const innerXRef = useRef(null);
  const gridRef = useRef(null);
  const nowTop = useNowTopLocal(rowHeight);
  const [businessHours, setBusinessHours] = useState(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const bh = await getBusinessHours();
        if (mounted) setBusinessHours(bh);
      } catch (e) {
        // ignore
      }
    })();
    return () => (mounted = false);
  }, []);
  const handleDayClick = useCallback(
    (e, day) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const clickY = e.clientY - rect.top;
      const minutesFromTop = (clickY / rowHeight) * 60;
      const snappedStartMinutes = clamp(
        Math.floor(minutesFromTop / 15) * 15,
        0,
        DAY_MIN - 15
      );

      const baseDate = toLocalTZ(day);
      baseDate.setHours(0, 0, 0, 0);
      const startDateTime = new Date(
        baseDate.getTime() + snappedStartMinutes * 60 * 1000
      );
      const endDateTime = new Date(startDateTime.getTime() + 60 * 60 * 1000);

      openCreate({
        host: null,
        startDateTime,
        endDateTime,
        allDay: false,
      });
    },
    [openCreate, rowHeight]
  );

  return (
    <div
      ref={outerYRef}
      className="cal-viewport week-view"
      style={{ ["--rowHeight"]: `${rowHeight}px` }}
    >
      <div ref={innerXRef} className="cal-canvas">
        <div className="grid-week" ref={gridRef}>
          {/* left gutter header */}
          <div className="gutter-hdr hdr">
            <FiClock size={15} />
          </div>

          {/* day headers */}
          {days.map((d, i) => (
            <div key={i} className="day-hdr hdr" style={{ gridColumn: i + 2 }}>
              <div className="day-hdr-date">
                <span>
                  {d.toLocaleDateString(undefined, {
                    weekday: "short",
                  })}
                </span>
                <span>
                  {d.toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                  })}
                </span>
              </div>
            </div>
          ))}

          {/* time gutter */}
          {/* time gutter - 15 minute steps (96 rows) */}
          <div className="gutter-body">
            {Array.from({ length: 24 * 4 }).map((_, idx) => {
              const hour = Math.floor(idx / 4);
              const minute = (idx % 4) * 15;
              // Format as e.g. "1:00", "1:15", "1:30", "1:45"
              const label = new Date(0, 0, 0, hour, minute).toLocaleTimeString(
                [],
                { hour: "numeric", minute: "2-digit" }
              );
              return (
                <div key={idx} className="gutter-row">
                  <span className="time-label">{label}</span>
                </div>
              );
            })}
            <div className="now-line" style={{ top: nowTop }} />
            <div className="now-dot" style={{ top: nowTop }} />
          </div>

          {/* day columns */}
          {days.map((day, i) => {
            const key = dateToISODay(day);
            const allDayEventsForDay = eventsByDay.get(key) || [];
            const dayEvents = appointmentTypeFilterCanon
              ? allDayEventsForDay.filter(
                  (ev) =>
                    String(ev.appointmentType || "")
                      .trim()
                      .toLowerCase() === appointmentTypeFilterCanon
                )
              : allDayEventsForDay;

            return (
              <div
                key={key}
                className="day-col"
                style={{ gridColumn: i + 2 }}
                onClick={(e) => handleDayClick(e, day)}
              >
                <div className="col-bg" />
                <div className="col-events">
                  <div className="now-line" style={{ top: nowTop }} />
                  {dayEvents.map((ev) => {
                    const start = toLocalTZ(ev.start);
                    const end = toLocalTZ(ev.end || ev.start);
                    const startMin = clamp(minutesLocal(start), 0, DAY_MIN);
                    const endMin = clamp(minutesLocal(end), 0, DAY_MIN);
                    if (endMin <= startMin) return null;

                    const topPx = (startMin / 60) * rowHeight;
                    const heightPx = ((endMin - startMin) / 60) * rowHeight;

                    return (
                      <div
                        key={ev.id}
                        className="week-event"
                        style={{ top: topPx, height: heightPx }}
                        onClick={(e) => {
                          e.stopPropagation();
                          openEdit(eventToMeetingForm(ev));
                        }}
                      >
                        <div className="week-event-title">
                          {ev.title || ev.subject || "Untitled"}
                        </div>
                        <div className="week-event-time">
                          {start.toLocaleTimeString([], {
                            hour: "numeric",
                            minute: "2-digit",
                          })}{" "}
                          -{" "}
                          {end.toLocaleTimeString([], {
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                        </div>
                      </div>
                    );
                  })}
                  {/* blocked overlays for out-of-business hours (week view) */}
                  {businessHours && businessHours.enabled && (
                    (() => {
                      const dayName = days[i].toLocaleDateString(undefined, { weekday: 'long' });
                      const cfg = businessHours.days?.[dayName];
                      if (!cfg) return null;
                      const parseTime = (s) => {
                        const [hh, mm] = (s || '00:00').split(':').map(Number);
                        return hh * 60 + (mm || 0);
                      };
                      const startMin = parseTime(cfg.start_time);
                      const endMin = parseTime(cfg.end_time);
                      const beforeH = (startMin / 60) * rowHeight;
                      const afterH = ((24 * 60 - endMin) / 60) * rowHeight;

                      return (
                        <>
                          {startMin > 0 && (
                            <div
                              className="blocked-area"
                              style={{ position: 'absolute', left: 0, right: 0, top: 0, height: beforeH, background: 'rgba(0,0,0,0.06)', zIndex: 50 }}
                              onClick={(e)=>{ e.stopPropagation(); 
                                // toast.info('Outside business hours'); 
                              }}
                            />
                          )}
                          {endMin < 24*60 && (
                            <div
                              className="blocked-area"
                              style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: afterH, background: 'rgba(0,0,0,0.06)', zIndex: 50 }}
                              onClick={(e)=>{ e.stopPropagation(); 
                                // toast.info('Outside business hours'); 
                              }}
                            />
                          )}
                        </>
                      );
                    })()
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <MeetingSchedulerMUI />
    </div>
  );
}

/* =========================================================
   DAY VIEW (your original, adapted into its own component)
   ========================================================= */
function DayView({ state, actions }) {
  const {
    selectedDate,
    zohoRecords,
    selectedRoleNames,
    selectedGroupIds,
    hosts,
    selectedUserNames,
    appointmentTypeFilter,
    appointmentTypes,
  } = state;
  const rowHeight = 180;
  const { openCreate, openEdit } = actions;

  // Fallbacks
  const fallbackTeam = useMemo(
    () => [
      { id: 1, name: "Host 1" },
      { id: 2, name: "Host 2" },
      { id: 3, name: "Host 3" },
      { id: 4, name: "Host 4" },
      { id: 5, name: "Host 5" },
      { id: 6, name: "Host 6" },
    ],
    []
  );
  const fallbackEvents = useMemo(() => [], []);

  const { team: meetingHostsOnly, events: zohoEvents } = useMemo(
    () => transformZohoRecordsForDay(zohoRecords, selectedDate),
    [zohoRecords, selectedDate]
  );

  // role filter
  const byRole = useMemo(() => {
    const activeRoles = new Set((selectedRoleNames || []).map((r) => r.trim()));
    return activeRoles.size === 0
      ? hosts
      : hosts.filter((h) => activeRoles.has(h.roleName));
  }, [hosts, selectedRoleNames]);

  // group filter
  const byRoleAndGroup = useMemo(() => {
    const activeGroups = new Set((selectedGroupIds || []).map(String));
    if (activeGroups.size === 0) return byRole;
    return byRole.filter((h) => {
      const ids = Array.isArray(h.groupIds)
        ? h.groupIds.map(String)
        : Array.isArray(h.groups)
        ? h.groups.map((g) => String(g.id))
        : [];
      return ids.some((id) => activeGroups.has(id));
    });
  }, [byRole, selectedGroupIds]);

  const filteredHosts = byRoleAndGroup;

  const meetingHostIdsForDay = useMemo(
    () => new Set(meetingHostsOnly.map((h) => h.id)),
    [meetingHostsOnly]
  );

  const finalTeam = useMemo(
    () => prioritizeTeam(filteredHosts, meetingHostIdsForDay),
    [filteredHosts, meetingHostIdsForDay]
  );

  // appointment type alias map
  const typeAliasMap = useMemo(() => {
    const map = new Map();

    (appointmentTypes || []).forEach((t) => {
      if (typeof t === "string") {
        const v = t.trim().toLowerCase();
        if (!v) return;
        map.set(v, v);
        return;
      }

      const actualRaw =
        t.actual_value ?? t.value ?? t.reference_value ?? t.name ?? t.id ?? "";
      const displayRaw =
        t.display_value ??
        t.label ??
        t.name ??
        t.value ??
        t.actual_value ??
        actualRaw;

      const actual = String(actualRaw || "")
        .trim()
        .toLowerCase();
      const display = String(displayRaw || "")
        .trim()
        .toLowerCase();

      if (!actual && !display) return;

      const canonical = actual || display;

      if (actual) map.set(actual, canonical);
      if (display) map.set(display, canonical);
    });

    return map;
  }, [appointmentTypes]);

  const filteredByType = useMemo(() => {
    if (!appointmentTypeFilter) return zohoEvents;

    const filterCanon = String(appointmentTypeFilter).trim().toLowerCase();

    return zohoEvents.filter((ev) => {
      const raw = String(ev.appointmentType || "")
        .trim()
        .toLowerCase();
      if (!raw) return false;

      const canon = typeAliasMap.get(raw) || raw;
      return canon === filterCanon;
    });
  }, [zohoEvents, appointmentTypeFilter, typeAliasMap]);

  const nameToId = useMemo(() => {
    const map = new Map();
    for (const h of hosts) map.set(String(h.name || "").toLowerCase(), h.id);
    return map;
  }, [hosts]);

  const selectedUserIds = useMemo(() => {
    if (!selectedUserNames?.length) return [];
    return selectedUserNames
      .map((n) => nameToId.get(String(n).toLowerCase()))
      .filter(Boolean);
  }, [selectedUserNames, nameToId]);

  const teamAfterIndividuals = useMemo(() => {
    if (!selectedUserIds.length) return finalTeam;
    const selectedSet = new Set(selectedUserIds);
    const onlySelected = finalTeam.filter((t) => selectedSet.has(t.id));
    return onlySelected;
  }, [finalTeam, selectedUserIds]);

  const team = teamAfterIndividuals.length
    ? teamAfterIndividuals
    : fallbackTeam;
  const events = filteredByType.length ? filteredByType : fallbackEvents;

  const outerYRef = useRef(null);
  const innerXRef = useRef(null);
  const gridRef = useRef(null);
  const nowTop = useNowTopLocal(rowHeight);
  const [businessHours, setBusinessHours] = useState(null);
  const [userBusinessHoursMap, setUserBusinessHoursMap] = useState(new Map());
  const [userTimeOffMap, setUserTimeOffMap] = useState(new Map());

  // Fetch org-level business hours (fallback)
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const bh = await getBusinessHours();
        if (mounted) setBusinessHours(bh);
      } catch (e) {
        // ignore
      }
    })();
    return () => (mounted = false);
  }, []);

  // Fetch user-specific business hours and time-off for all team members
  useEffect(() => {
    if (!team || team.length === 0) return;
    let mounted = true;

    const fetchUserHours = async () => {
      const hoursMap = new Map();
      const timeOffMap = new Map();
      const currentDate = selectedDate || new Date();

      await Promise.all(
        team.map(async (member) => {
          try {
            // Get user-specific business hours
            const userHours = await getUserBusinessHours(member.id);
            hoursMap.set(member.id, userHours);

            // Get user time-off for the current day
            const timeOff = await getUserTimeOff(member.id, currentDate, currentDate);
            timeOffMap.set(member.id, timeOff);
          } catch (err) {
            console.warn(`Could not fetch hours for user ${member.id}:`, err);
          }
        })
      );

      if (mounted) {
        setUserBusinessHoursMap(hoursMap);
        setUserTimeOffMap(timeOffMap);
      }
    };

    fetchUserHours();
    return () => { mounted = false; };
  }, [team, selectedDate]);

  const minutesLocal = (d) => {
    const dt = typeof d === "string" ? new Date(d) : d;
    return dt.getHours() * 60 + dt.getMinutes();
  };
  const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
  const DAY_MIN = 24 * 60;

  const handleColumnClick = useCallback(
    (e, host) => {
      e.stopPropagation();
      if (!host) return;

      const rect = e.currentTarget.getBoundingClientRect();
      const clickY = e.clientY - rect.top;

      const minutesFromTop = (clickY / rowHeight) * 60;
      const snappedStartMinutes = clamp(
        Math.floor(minutesFromTop / 15) * 15,
        0,
        DAY_MIN - 15
      );

      const snappedEndMinutes = snappedStartMinutes + 60;

      const baseDate = selectedDate ? toLocalTZ(selectedDate) : toLocalTZ(new Date());
      baseDate.setHours(0, 0, 0, 0);

      const startDateTime = new Date(
        baseDate.getTime() + snappedStartMinutes * 60 * 1000
      );
      const endDateTime = new Date(
        baseDate.getTime() + snappedEndMinutes * 60 * 1000
      );

      const hostPayload = {
        id: host.id,
        name: host.name,
        email: host.email || host.Email || host.user_email || null,
      };

      openCreate({
        host: hostPayload,
        hostId: hostPayload.id,
        startDateTime,
        endDateTime,
        allDay: false,
      });
    },
    [openCreate, rowHeight, selectedDate]
  );

  const gridTemplateColumns = useMemo(
    () => `var(--gutter) repeat(${team.length},  minmax(var(--col-min), 1fr))`,
    [team.length]
  );

  return (
    <div
      ref={outerYRef}
      className="cal-viewport"
      style={{ ["--rowHeight"]: `${rowHeight}px` }}
    >
      <div ref={innerXRef} className="cal-canvas">
        <div
          ref={gridRef}
          className="grid-cal"
          style={{
            gridTemplateColumns,
            ["--row"]: `var(--rowHeight)`,
            ["--cols"]: team.length,
            width:
              "max(100%, calc(var(--gutter) + var(--cols) * var(--col-min)))",
          }}
        >
          {/* header */}
          <div className="gutter-hdr hdr">
            <FiClock size={15} />
          </div>
          {team.map((m, i) => (
            <div
              key={m.id}
              className="staff-hdr hdr"
              style={{ gridColumn: i + 2 }}
            >
              <>
                <Avatar
                  src={m.imageLink || undefined}
                  sx={{ width: 28, height: 28, mr: "20px" }}
                />
                {m.name}
              </>
            </div>
          ))}

          {/* time gutter */}
          {/* time gutter - 15 minute steps (96 rows) */}
          <div className="gutter-body">
            {Array.from({ length: 24 * 4 }).map((_, idx) => {
              const hour = Math.floor(idx / 4);
              const minute = (idx % 4) * 15;
              // Format as e.g. "1:00", "1:15", "1:30", "1:45"
              const label = new Date(0, 0, 0, hour, minute).toLocaleTimeString(
                [],
                { hour: "numeric", minute: "2-digit" }
              );
              return (
                <div key={idx} className="gutter-row">
                  <span className="time-label">{label}</span>
                </div>
              );
            })}
            <div className="now-line" style={{ top: nowTop }} />
            <div className="now-dot" style={{ top: nowTop }} />
          </div>

          {/* columns */}
          {team.map((m, i) => {
            const evs = events.filter((e) => e.userId === m.id);
            const laneInfo = new Map(
              layoutLanes(evs, parseToMinutes).map((x) => [x.id, x])
            );

            const dayName = (selectedDate ? toLocalTZ(selectedDate) : toLocalTZ(new Date())).toLocaleDateString(undefined, { weekday: 'long' });
            
            // Get user-specific business hours or fall back to org hours
            const userHours = userBusinessHoursMap.get(m.id);
            const userDayHours = userHours?.[dayName];
            const cfg = userDayHours || businessHours?.days?.[dayName];
            
            // Check if user has day-off/vacation
            const userTimeOff = userTimeOffMap.get(m.id) || [];
            const dayOffInfo = isDateDayOff(userTimeOff, selectedDate || new Date());
            const isDayOff = dayOffInfo.isDayOff;

            return (
              <div
                key={m.id}
                className="col-body"
                style={{ gridColumn: i + 2 }}
                onClick={(e) => {
                  if (isDayOff) {
                    e.stopPropagation();
                    const typeLabel = typeof dayOffInfo.type === 'string' ? dayOffInfo.type : 'day off';
                    toast.info(`${m.name} is on ${typeLabel}`);
                    return;
                  }
                  handleColumnClick(e, m);
                }}
              >
                <div className="col-bg" />
                <div className="col-events">
                  <div className="now-line" style={{ top: nowTop }} />
                  {i === team.length - 1 && (
                    <div className="now-dot-right" style={{ top: nowTop }} />
                  )}
                    
                    {/* Full day-off overlay (vacation, PTO, etc.) */}
                    {isDayOff && (
                      <div
                        className="blocked-area day-off-overlay"
                        style={{ 
                          position: 'absolute', 
                          left: 0, 
                          right: 0, 
                          top: 0, 
                          bottom: 0,
                          background: 'repeating-linear-gradient(45deg, rgba(239, 68, 68, 0.08), rgba(239, 68, 68, 0.08) 10px, rgba(239, 68, 68, 0.04) 10px, rgba(239, 68, 68, 0.04) 20px)',
                          zIndex: 50,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          pointerEvents: 'auto',
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          const reasonLabel = typeof dayOffInfo.reason === 'string' && dayOffInfo.reason 
                            ? dayOffInfo.reason 
                            : (typeof dayOffInfo.type === 'string' ? dayOffInfo.type : 'Day Off');
                          toast.info(`${m.name}: ${reasonLabel}`);
                        }}
                      >
                        <div style={{
                          background: 'rgba(239, 68, 68, 0.9)',
                          color: 'white',
                          padding: '8px 16px',
                          borderRadius: '8px',
                          fontSize: '12px',
                          fontWeight: 600,
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px',
                        }}>
                          {typeof dayOffInfo.type === 'string' ? dayOffInfo.type : 'Day Off'}
                        </div>
                      </div>
                    )}
                    
                    {/* blocked overlays for out-of-business hours (day view per-column) */}
                    {!isDayOff && cfg && (cfg.isWorkDay !== false) && (
                      (() => {
                        const parseTime = (s) => {
                          const [hh, mm] = (s || '00:00').split(':').map(Number);
                          return hh * 60 + (mm || 0);
                        };
                        const startMin = parseTime(cfg.start || cfg.start_time);
                        const endMin = parseTime(cfg.end || cfg.end_time);
                        const beforeH = (startMin / 60) * rowHeight;
                        const afterH = ((24 * 60 - endMin) / 60) * rowHeight;

                        return (
                          <>
                            {startMin > 0 && (
                              <div
                                className="blocked-area"
                                style={{ position: 'absolute', left: 0, right: 0, top: 0, height: beforeH, background: 'rgba(0,0,0,0.06)', zIndex: 50 }}
                                onClick={(e)=>{ e.stopPropagation(); }}
                              />
                            )}
                            {endMin < 24*60 && (
                              <div
                                className="blocked-area"
                                style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: afterH, background: 'rgba(0,0,0,0.06)', zIndex: 50 }}
                                onClick={(e)=>{ e.stopPropagation(); }}
                              />
                            )}
                          </>
                        );
                      })()
                    )}
                    
                    {/* Non-working day overlay (weekend, etc.) */}
                    {!isDayOff && cfg && cfg.isWorkDay === false && (
                      <div
                        className="blocked-area non-working-day"
                        style={{ 
                          position: 'absolute', 
                          left: 0, 
                          right: 0, 
                          top: 0, 
                          bottom: 0,
                          background: 'rgba(0,0,0,0.04)',
                          zIndex: 50,
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          toast.info(`${m.name}: Non-working day`);
                        }}
                      />
                    )}
                  {evs.map((ev) => {
  const startDateObj = toLocalTZ(ev.start);
  const endDateObj = toLocalTZ(ev.end || ev.start);


                    const durationMs = endDateObj - startDateObj;
                    const isAllDay =
                      ev.allDay || durationMs >= 23 * 60 * 60 * 1000;

                    let topPx;
                    let heightPx;

                    if (isAllDay) {
                      topPx = 0;
                      heightPx = rowHeight * 24;
                    } else {
                      const startMinRaw = minutesLocal(startDateObj);
                      const endMinRaw = minutesLocal(endDateObj);
                      const startMin = clamp(startMinRaw, 0, DAY_MIN);
                      const endMin = clamp(endMinRaw, 0, DAY_MIN);

                      if (endMin <= startMin) return null;

                      const durMin = endMin - startMin;

                      topPx = (startMin / 60) * rowHeight;
                      heightPx = (durMin / 60) * rowHeight;
                    }

                    const li = laneInfo.get(ev.id) || {
                      lane: 0,
                      lanes: 1,
                    };
                    const laneWidthPct = 100 / li.lanes;
                    const leftPct = laneWidthPct * li.lane;

                    const GAP = 6;
                    const widthCalc = `calc(${laneWidthPct}% - ${GAP}px)`;
                    const leftCalc = `calc(${leftPct}% + ${GAP / 2}px)`;

                    return (
                      <EventCard
                        key={ev.id}
                        event={ev}
                        top={topPx}
                        height={heightPx}
                        left={leftCalc}
                        width={widthCalc}
                        onClick={() => openEdit(eventToMeetingForm(ev))}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <MeetingSchedulerMUI />
    </div>
  );
}
