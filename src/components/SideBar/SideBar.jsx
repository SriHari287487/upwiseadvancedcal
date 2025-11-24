import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from "react";
import { Box, IconButton, Modal, useMediaQuery } from "@mui/material";
import { getPicklistValues } from "../../Apis/zohoApi";
import {
  useCalendarActions,
  useCalendarState,
} from "../../Context/CalendarContext";
import {
  startOfDay,
  sameDay,
  getMonthMatrixMondayStart,
  monthLong,
  monthShortUpper,
} from "./SideBarHelper";
import "./SideBar.scss";
import { transformZohoRecordsForDay } from "../common/ZohoTransfrom";

// Tiny chevrons (no extra deps)
const Chevron = ({ dir = "left" }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
    <path
      d={dir === "left" ? "M15 18l-6-6 6-6" : "M9 6l6 6-6 6"}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const SideBar = () => {
  const calendarState = useCalendarState();
  const calendarActions = useCalendarActions();

  const {
    appointmentTypes,
    appointmentTypeColor,
    selectedDate: stateSelectedDate,
    zohoRecords,
    appointmentTypeFilter,
    showroomFilter,
    userFilter,
  } = calendarState;

  const {
    setAppointmentTypes,
    setSelectedDate,
    goToToday,
    goToPreviousDay,
    goToNextDay,
    setAppointmentTypeFilter,
    setShowroomFilter,
    setUserFilter,
  } = calendarActions;

  const [openCal, setOpenCal] = useState(false);
  const [viewMonth, setViewMonth] = useState(
    () => new Date(stateSelectedDate || new Date())
  );
  const tileRef = useRef(null);
  const isSmall = useMediaQuery("(max-width: 640px)");

  // Fetch appointment types on Zoho PageLoad
  useEffect(() => {
    const onLoad = async () => {
      try {
        const types = await getPicklistValues("Appointment_Type", "Events");
        if (Array.isArray(types)) {
          setAppointmentTypes(types);
        }
      } catch (e) {
        console.error("Failed to fetch appointment types:", e);
      }
    };
    if (window?.ZOHO?.embeddedApp) {
      ZOHO.embeddedApp.on("PageLoad", onLoad);
      ZOHO.embeddedApp.init();
    } else {
      onLoad();
    }
  }, [setAppointmentTypes]);

  // Keep calendar header month in sync with global selectedDate
  useEffect(() => {
    if (!stateSelectedDate) return;
    setViewMonth(
      new Date(
        stateSelectedDate.getFullYear(),
        stateSelectedDate.getMonth(),
        1
      )
    );
  }, [stateSelectedDate]);

  const monthMatrix = useMemo(
    () => getMonthMatrixMondayStart(viewMonth),
    [viewMonth]
  );

  const handleOpenCalendar = () => {
    setViewMonth(new Date(stateSelectedDate || new Date()));
    setOpenCal(true);
  };
  const handleCloseCalendar = () => setOpenCal(false);

  const prevMonth = () =>
    setViewMonth((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  const nextMonth = () =>
    setViewMonth((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1));

  const handlePick = (d) => {
    setSelectedDate(startOfDay(d));
    handleCloseCalendar();
  };

  const onCalendarKeyDown = useCallback(
    (e) => {
      if (!openCal) return;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        goToPreviousDay();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        goToNextDay();
      } else if (e.key.toLowerCase?.() === "t") {
        e.preventDefault();
        goToToday();
      }
    },
    [openCal, goToPreviousDay, goToNextDay, goToToday]
  );

  const dayNum = (stateSelectedDate || new Date())
    .getDate()
    .toString()
    .padStart(2, "0");
  const monthAbbr = monthShortUpper(stateSelectedDate || new Date());

  // 👉 events for the selected day
  const dayEvents = useMemo(() => {
    const { events } = transformZohoRecordsForDay(
      zohoRecords,
      stateSelectedDate
    );
    return events || [];
  }, [zohoRecords, stateSelectedDate]);

  // 👉 showrooms derived from day's events
  const showroomOptions = useMemo(() => {
    const m = new Map();
    if (!dayEvents || !dayEvents.length) return [];

    for (const ev of dayEvents) {
      const key =
        (ev.showroom && String(ev.showroom).trim()) ||
        (ev.Showroom && String(ev.Showroom).trim()) ||
        (ev.showroom_name && String(ev.showroom_name).trim()) ||
        (ev.showroomName && String(ev.showroomName).trim()) ||
        (ev.branch && String(ev.branch).trim()) ||
        (ev.Branch && String(ev.Branch).trim());

      if (!key) continue;
      m.set(key, (m.get(key) || 0) + 1);
    }

    return Array.from(m.entries()).map(([value, count]) => ({
      id: value,
      value,
      label: value,
      count,
    }));
  }, [dayEvents]);

  // 👉 users derived from day's events
  const userOptions = useMemo(() => {
    const m = new Map();
    if (!dayEvents || !dayEvents.length) return [];

    for (const ev of dayEvents) {
      const keyRaw =
        ev.ownerName ||
        ev.owner_name ||
        ev.hostName ||
        ev.host_name ||
        ev.user ||
        ev.User ||
        (ev.Owner && ev.Owner.name) ||
        (ev.Created_By && ev.Created_By.name);

      const key = keyRaw && String(keyRaw).trim();
      if (!key) continue;
      m.set(key, (m.get(key) || 0) + 1);
    }

    return Array.from(m.entries()).map(([value, count]) => ({
      id: value,
      value,
      label: value,
      count,
    }));
  }, [dayEvents]);

  // Normalize appointment types (Zoho picklist) into a consistent shape
  const normalizedTypes = useMemo(() => {
    const list = (appointmentTypes || [])
      .map((t) => {
        if (typeof t === "string") {
          return {
            id: t,
            value: t, // record field value
            label: t, // UI label
            color: null,
          };
        }

        const actual =
          t.actual_value ??
          t.value ??
          t.reference_value ??
          t.name ??
          t.id ??
          "";

        const label =
          t.label ??
          t.display_value ??
          t.name ??
          t.value ??
          t.actual_value ??
          actual;

        return {
          id:
            t.id ??
            t.value ??
            t.actual_value ??
            t.reference_value ??
            t.name ??
            label,
          value: actual, // canonical value we use for records & counts
          label,
          color: t.color ?? t.colour_code ?? t.color_code ?? null,
        };
      })
      .filter(
        (t) =>
          t.label &&
          t.label.toLowerCase() !== "unspecified"
      );

    return list;
  }, [appointmentTypes]);

  // 👉 count events per appointmentType (canonicalized using normalizedTypes)
  const countsByType = useMemo(() => {
    const m = new Map();
    if (!dayEvents || !dayEvents.length) return m;

    for (const ev of dayEvents) {
      const raw = (ev.appointmentType || "Unspecified").trim();

      // Try to map event's value to a normalized type (match by value OR label)
      const match =
        normalizedTypes.find(
          (t) => t.value === raw || t.label === raw
        ) || null;

      const key = match ? match.value : raw || "Unspecified";

      m.set(key, (m.get(key) || 0) + 1);
    }

    return m;
  }, [dayEvents, normalizedTypes]);

  const fmtCount = (n) =>
    String(n).padStart(2, "0") + (n === 1 ? " Meeting" : " Meetings");

  const palette =
    appointmentTypeColor && appointmentTypeColor.length
      ? appointmentTypeColor
      : ["#6db744", "#b83535", "#e0b917", "#7f469b", "#3474ba"];

  const ALL_COLOR = "#b83535";
  console.log(normalizedTypes);
  

  return (
    <Box className="sidebarContainer">
      {/* Services list (All + appointment types) */}
      <Box className="services">
        {[
          { id: "__ALL__", label: "All", value: "__ALL__" },
          ...normalizedTypes,
        ].map((type) => {
          const isAll = type.id === "__ALL__";

          const count = isAll
            ? dayEvents.length
            : countsByType.get(type.value) || 0;

          const active = isAll
            ? appointmentTypeFilter == null
            : appointmentTypeFilter === type.value;

          // index for fallback palette
          const baseIndex = isAll
            ? -1
            : normalizedTypes.findIndex((t) => t.id === type.id);

          const color = isAll
            ? ALL_COLOR
            : type.color ||
              palette[
                (baseIndex >= 0 ? baseIndex : 0) % palette.length
              ];

          const handleClick = () => {
            if (isAll) {
              setAppointmentTypeFilter(null); // clear filter
            } else {
              setAppointmentTypeFilter(active ? null : type.value);
            }
          };

          return (
            <button
              key={String(type.id)}
              className={`servicePill ${active ? "is-active" : ""}`}
              onClick={handleClick}
              style={{
                border: `1px solid ${color}`,
                background: active ? `${color}1A` : "transparent",
                cursor: "pointer",
              }}
            >
              <span className="serviceName">{type.label}</span>
              <span className="serviceCount" style={{ background: color }}>
                {fmtCount(count)}
              </span>
            </button>
          );
        })}
      </Box>

      {/* Showroom filter */}
      {showroomOptions.length > 0 && (
        <Box className="services">
          <div className="servicesHeader">Showrooms</div>
          {[
            { id: "__SHOWROOM_ALL__", label: "All Showrooms", value: null },
            ...showroomOptions,
          ].map((opt) => {
            const isAll = opt.id === "__SHOWROOM_ALL__";
            const active = isAll
              ? !showroomFilter
              : showroomFilter === opt.value;
            const count = isAll ? dayEvents.length : opt.count;

            const handleClick = () => {
              if (!setShowroomFilter) return;
              if (isAll) {
                setShowroomFilter(null);
              } else {
                setShowroomFilter(active ? null : opt.value);
              }
            };

            return (
              <button
                key={`showroom-${String(opt.id)}`}
                className={`servicePill ${active ? "is-active" : ""}`}
                onClick={handleClick}
                style={{
                  border: "1px solid #3474ba",
                  background: active ? "#3474ba1A" : "transparent",
                  cursor: setShowroomFilter ? "pointer" : "default",
                }}
              >
                <span className="serviceName">{opt.label}</span>
                <span className="serviceCount">
                  {fmtCount(count)}
                </span>
              </button>
            );
          })}
        </Box>
      )}

      {/* User filter */}
      {userOptions.length > 0 && (
        <Box className="services">
          <div className="servicesHeader">Users</div>
          {[
            { id: "__USER_ALL__", label: "All Users", value: null },
            ...userOptions,
          ].map((opt) => {
            const isAll = opt.id === "__USER_ALL__";
            const active = isAll ? !userFilter : userFilter === opt.value;
            const count = isAll ? dayEvents.length : opt.count;

            const handleClick = () => {
              if (!setUserFilter) return;
              if (isAll) {
                setUserFilter(null);
              } else {
                setUserFilter(active ? null : opt.value);
              }
            };

            return (
              <button
                key={`user-${String(opt.id)}`}
                className={`servicePill ${active ? "is-active" : ""}`}
                onClick={handleClick}
                style={{
                  border: "1px solid #7f469b",
                  background: active ? "#7f469b1A" : "transparent",
                  cursor: setUserFilter ? "pointer" : "default",
                }}
              >
                <span className="serviceName">{opt.label}</span>
                <span className="serviceCount">
                  {fmtCount(count)}
                </span>
              </button>
            );
          })}
        </Box>
      )}

      {/* Mini date tile */}
      <Box className="tileWrapper">
        <button
          ref={tileRef}
          className="dateTile"
          onClick={handleOpenCalendar}
          aria-label="Open calendar"
        >
          <div className="dateNum">{dayNum}</div>
          <div className="dateMonth">{monthAbbr}</div>
        </button>
      </Box>

      {/* Calendar Modal */}
      <Modal open={openCal} onClose={handleCloseCalendar} keepMounted>
        <Box
          className={`calendarModal ${isSmall ? "is-small" : ""}`}
          tabIndex={0}
          onKeyDown={onCalendarKeyDown}
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-label="Date picker"
        >
          <Box className="calendar">
            <Box className="calHeader">
              <IconButton
                className="navBtn"
                onClick={prevMonth}
                size="small"
                aria-label="Previous month"
              >
                <Chevron dir="left" />
              </IconButton>
              <div className="calTitle">{monthLong(viewMonth)}</div>
              <IconButton
                className="navBtn"
                onClick={nextMonth}
                size="small"
                aria-label="Next month"
              >
                <Chevron dir="right" />
              </IconButton>
            </Box>

            <Box className="dowRow">
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
                <div className="dow" key={d}>
                  {d}
                </div>
              ))}
            </Box>

            <Box className="grid">
              {monthMatrix.map((week, wi) => (
                <div className="week" key={`w-${wi}`}>
                  {week.map(({ date, outside }, di) => {
                    const isSelected =
                      stateSelectedDate && sameDay(date, stateSelectedDate);
                    const isToday = sameDay(date, new Date());
                    return (
                      <button
                        key={`d-${wi}-${di}`}
                        className={[
                          "cell",
                          outside ? "outside" : "",
                          isSelected ? "selected" : "",
                          isToday ? "today" : "",
                        ].join(" ")}
                        onClick={() => handlePick(date)}
                      >
                        <span className="num">{date.getDate()}</span>
                      </button>
                    );
                  })}
                </div>
              ))}
            </Box>
          </Box>
        </Box>
      </Modal>
    </Box>
  );
};

export default SideBar;
