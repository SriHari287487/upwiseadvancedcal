import * as React from "react";
import {
  Box,
  Button,
  Popover,
  Typography,
  Checkbox,
  FormControlLabel,
  Divider,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  Avatar,
  InputBase,
  ListItemAvatar,
} from "@mui/material";
import PlaceOutlinedIcon from '@mui/icons-material/PlaceOutlined';
import { SlClock } from "react-icons/sl";
import dayjs from "dayjs";
import "./CreateMeeting.scss";
import {
  useCalendarActions,
  useCalendarState,
} from "../../Context/CalendarContext";
import OpportunityLookupModal from "./RelatedToLookUp";
import ParticipantsModal from "./ParticipantsModal";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { DateCalendar } from "@mui/x-date-pickers/DateCalendar";
import { StaticTimePicker } from "@mui/x-date-pickers";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { MultiSectionDigitalClock } from "@mui/x-date-pickers/MultiSectionDigitalClock";
import {
  getPicklistValues,
  createRecord,
  searchRecords,
  updateRecord,
  getRecord,
  getContactAddress,
  getShowroomAddressFromUser,
  getDealAddress,
  getAccountAddress,
  getLeadAddress,
} from "../../Apis/zohoApi";
import { sendMeetingConfirmationSMS, getCustomerPhone } from "../../services/SMSService";

/* ---------------- Reusables ---------------- */

function ClickableBox({ value, placeholder, onClick, icon, sx }) {
  const hasValue = !!value;
  return (
    <Box
      onClick={onClick}
      sx={{
        cursor: "pointer",
        backgroundColor: "#FFF",
        height: 40,              // ⬅️ was 56
        display: "flex",
        alignItems: "center",
        justifyContent: "flex-start",
        gap: 0.75,               // a bit tighter
        fontSize: 14,            // ⬅️ was 16
        px: 1.5,                 // ⬅️ was "10px"
        border: "none",
        color: "#000000",
        borderRadius: 1.5,       // ensure pill-ish small dropdowns
        ...sx,
      }}
    >
      {icon}
      <span
        style={{
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          width: "100%",
        }}
      >
        {hasValue ? value : placeholder}
      </span>
    </Box>
  );
}


function PickerPopover({ open, anchorEl, onClose, children, paperSx }) {
  return (
    <Popover
      open={open}
      anchorEl={anchorEl}
      onClose={onClose}
      anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
      transformOrigin={{ vertical: "top", horizontal: "left" }}
      PaperProps={{ sx: { borderRadius: 3, p: 0, ...paperSx } }}
    >
      {children}
    </Popover>
  );
}

function OptionList({ options, onSelect }) {
  return (
    <List dense sx={{ minWidth: 260, maxHeight: 300, overflowY: "auto" }}>
      {options.map((opt, i) => {
        const label =
          typeof opt === "string"
            ? opt
            : opt.label || opt.display_value || opt.actual_value || opt.value;

        return (
          <ListItem
            button
            key={i}
            onClick={() => onSelect(opt)}
            sx={{ py: 1.25 }}
          >
            <ListItemText primary={label} />
          </ListItem>
        );
      })}
    </List>
  );
}

function CustomPopover({ open, anchorEl, onClose, options, onSelect }) {
  return (
    <PickerPopover open={open} anchorEl={anchorEl} onClose={onClose}>
      <OptionList
        options={options}
        onSelect={(v) => {
          onSelect(v);
          onClose();
        }}
      />
    </PickerPopover>
  );
}

function DatePopover({ open, anchorEl, onClose, value, onChange }) {
  return (
    <PickerPopover
      open={open}
      anchorEl={anchorEl}
      onClose={onClose}
      paperSx={{ overflow: "hidden" }}
    >
      <LocalizationProvider dateAdapter={AdapterDayjs}>
        <DateCalendar
          value={value ? dayjs(value) : null}
          onChange={(v) => {
            if (v) onChange(v.toDate());
            onClose();
          }}
        />
      </LocalizationProvider>
    </PickerPopover>
  );
}

function TimePopover({
  open,
  anchorEl,
  onClose,
  value,
  onChange,
  disablePast,
}) {
  const [tempValue, setTempValue] = React.useState(dayjs());

  // When the popover opens, init from selected time or current time
  React.useEffect(() => {
    if (!open) return;

    if (value) {
      setTempValue(dayjs(value));
    } else {
      setTempValue(dayjs()); // current local time
    }
  }, [open, value]);

  // Disable times before "now" when the selected date is today
  const shouldDisableTime = React.useCallback(
    (timeValue, viewType) => {
      if (!disablePast) return false;
      if (!tempValue) return false;

      const now = dayjs();

      // Only restrict if selected date is today
      if (!tempValue.isSame(now, "date")) return false;

      let candidate = tempValue;
      if (viewType === "hours") {
        candidate = candidate.hour(timeValue);
      } else if (viewType === "minutes") {
        candidate = candidate.minute(timeValue);
      }

      return candidate.isBefore(now);
    },
    [disablePast, tempValue]
  );

  const handleCancel = () => {
    // Close without applying changes
    onClose();
  };

  const handleOk = () => {
    // Always apply whatever is currently selected
    if (tempValue && tempValue.isValid()) {
      onChange(tempValue.toDate());
    }
    onClose();
  };

  return (
    <PickerPopover open={open} anchorEl={anchorEl} onClose={handleCancel}>
      <LocalizationProvider dateAdapter={AdapterDayjs}>
        <Box
          sx={{
            p: 2,
            display: "flex",
            flexDirection: "column",
            gap: 2,
            minWidth: 260,
          }}
        >
          <MultiSectionDigitalClock
            ampm
            views={["hours", "minutes"]}
            value={tempValue}
            onChange={(newVal) => {
              if (newVal && newVal.isValid()) {
                setTempValue(newVal);
              }
            }}
            minutesStep={1}
            shouldDisableTime={shouldDisableTime}
          />

          {/* Actions */}
          <Box
            sx={{
              display: "flex",
              justifyContent: "flex-end",
              gap: 1,
              mt: 1,
            }}
          >
            <Button onClick={handleCancel}>CANCEL</Button>
            <Button variant="contained" onClick={handleOk}>
              OK
            </Button>
          </Box>
        </Box>
      </LocalizationProvider>
    </PickerPopover>
  );
}

function HostPopover({ open, anchorEl, onClose, hosts = [], onSelect }) {
  return (
    <PickerPopover open={open} anchorEl={anchorEl} onClose={onClose}>
      <List dense sx={{ minWidth: 260, maxHeight: 300, overflowY: "auto" }}>
        {hosts.map((h) => {
          const name = h.full_name || h.name || h.Full_Name || "—";
          const pic = h.imageLink || undefined;
          return (
            <ListItem
              key={h.id || name}
              button
              onClick={() => {
                onSelect(h);
                onClose();
              }}
              sx={{ py: 1.25 }}
            >
              <ListItemAvatar sx={{ minWidth: 40 }}>
                <Avatar src={pic} sx={{ width: 28, height: 28 }} />
              </ListItemAvatar>
              <ListItemText primary={name} />
            </ListItem>
          );
        })}
      </List>
    </PickerPopover>
  );
}

/* ---------------- Helpers ---------------- */

export function toZohoDateTime(value) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  const pad = (n) => String(n).padStart(2, "0");

  const year = d.getFullYear();
  const month = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());
  const seconds = pad(d.getSeconds());

  const offsetMinutes = -d.getTimezoneOffset(); // e.g. +330 for IST
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const oh = pad(Math.floor(Math.abs(offsetMinutes) / 60));
  const om = pad(Math.abs(offsetMinutes) % 60);

  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}${sign}${oh}:${om}`;
}

export function toZohoAllDayRange(date) {
  if (!date) return { start: null, end: null };

  const d = date instanceof Date ? date : new Date(date);
  const pad = (n) => String(n).padStart(2, "0");

  const y = d.getFullYear();
  const m = pad(d.getMonth() + 1);
  const day = pad(d.getDate());

  return {
    start: `${y}-${m}-${day}T00:00:00+00:00`,
    end: `${y}-${m}-${day}T23:59:59+00:00`,
  };
}

export function buildRecurringActivity(repeat, startDateTime) {
  if (!repeat || repeat === "Does not repeat") return null;

  let freq;
  switch (repeat) {
    case "Daily":
      freq = "DAILY";
      break;
    case "Weekly":
      freq = "WEEKLY";
      break;
    case "Monthly":
      freq = "MONTHLY";
      break;
    default:
      return null;
  }

  const d = startDateTime ? new Date(startDateTime) : new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const dtstart = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(
    d.getDate()
  )}`;

  return {
    RRULE: `FREQ=${freq};INTERVAL=1;DTSTART=${dtstart}`,
  };
}

export function decodeRecurringActivity(recurring) {
  // 1) If it's already one of the UI labels, just return it
  if (
    typeof recurring === "string" &&
    ["Does not repeat", "Daily", "Weekly", "Monthly"].includes(recurring)
  ) {
    return recurring;
  }

  if (!recurring) return "Does not repeat";

  // 2) Zoho might send string or { RRULE: "..." }
  const rrule =
    typeof recurring === "string"
      ? recurring
      : recurring.RRULE || recurring.rrule;

  if (!rrule || typeof rrule !== "string") return "Does not repeat";

  const match = rrule.match(/FREQ=(DAILY|WEEKLY|MONTHLY)/i);
  if (!match) return "Does not repeat";

  const freq = match[1].toUpperCase();

  switch (freq) {
    case "DAILY":
      return "Daily";
    case "WEEKLY":
      return "Weekly";
    case "MONTHLY":
      return "Monthly";
    default:
      return "Does not repeat";
  }
}

function normalizePicklistOptions(list = []) {
  return list
    .map((opt) => {
      if (!opt) return null;

      if (typeof opt === "string") {
        return { label: opt, value: opt };
      }

      return {
        label:
          opt.label ??
          opt.display_value ??
          opt.actual_value ??
          opt.reference_value ??
          opt.value ??
          opt.name ??
          "",
        value:
          opt.value ??
          opt.actual_value ??
          opt.reference_value ??
          opt.display_value ??
          opt.name ??
          opt.label ??
          "",
        color: opt.color ?? opt.colour_code ?? null,
      };
    })
    .filter((o) => o && o.label && o.value);
}

// Helper: round up to next 15-minute slot
function roundUpToQuarterHour(d) {
  const base = dayjs(d);
  const minutes = base.minute();
  const remainder = minutes % 15;

  // If already on a 15-min boundary, just zero seconds
  if (remainder === 0) {
    return base.second(0);
  }

  const addMinutes = 15 - remainder;
  return base.add(addMinutes, "minute").second(0);
}

/* ===================== Main ===================== */

export default function MeetingSchedulerMUI() {
  const {
    isCreateOpen,
    modalMode,
    meetingForm,
    participantsModal,
    hosts = [],
    appointmentTypes,
    selectedDate,
  } = useCalendarState();

  const {
    closeModal,
    patchMeetingForm,
    setParticipants,
    openParticipants,
    fetchStart,
    fetchError,
    fetchSuccess,
  } = useCalendarActions();

  // anchors
  const [venueAnchor, setVenueAnchor] = React.useState(null);
  const [apptAnchor, setApptAnchor] = React.useState(null);
  const [repeatAnchor, setRepeatAnchor] = React.useState(null);
  const [startDateAnchor, setStartDateAnchor] = React.useState(null);
  const [openOppModal, setOpenOppModal] = React.useState(false);
  const [endDateAnchor, setEndDateAnchor] = React.useState(null);
  const [startTimeAnchor, setStartTimeAnchor] = React.useState(null);
  const [endTimeAnchor, setEndTimeAnchor] = React.useState(null);
  const [hostAnchor, setHostAnchor] = React.useState(null);

  const [addOpen, setAddOpen] = React.useState(false);
  const [newEmail, setNewEmail] = React.useState("");

  const [meetingVenueOptions, setMeetingVenueOptions] = React.useState([]);
  const [apptTypeOptions, setApptTypeOptions] = React.useState([]);
  const [submitting, setSubmitting] = React.useState(false);
  const [errors, setErrors] = React.useState({
    title: false,
    host: false,
    time: false,
    repeat: false,
  });

  const repeatOptions = ["Does not repeat", "Daily", "Weekly", "Monthly"];

  const fmtDate = (d) =>
    d
      ? new Intl.DateTimeFormat("en-US", {
          month: "2-digit",
          day: "2-digit",
          year: "numeric",
        }).format(new Date(d))
      : "";

  const fmtTime = (d) =>
    d
      ? new Intl.DateTimeFormat("en-US", {
          hour: "2-digit",
          minute: "2-digit",
        }).format(new Date(d))
      : "";

  // derive related record (handles edit mode where Zoho gives What_Id)
  const rawRelatedRecord =
    meetingForm.relatedRecord ||
    meetingForm.What_Id ||
    meetingForm.what_id ||
    null;

  const {
    host,
    subject,
    location,
    meetingVenue,
    appointmentType,
    repeat = "Does not repeat",
    allDay,
    startDateTime,
    endDateTime,
    participants = [],
    relatedRecord,
  } = {
    host: meetingForm.host || meetingForm.owner,
    subject: meetingForm.subject,
    location: meetingForm.location,
    meetingVenue: meetingForm.meetingVenue,
    appointmentType: meetingForm.appointmentType,
    repeat: decodeRecurringActivity(meetingForm.repeat),
    allDay: meetingForm.allDay,
    startDateTime: meetingForm.startDateTime,
    endDateTime: meetingForm.endDateTime,
    participants: meetingForm.participants,
    relatedRecord: rawRelatedRecord,
  };

  const isOnlineVenue =
    typeof meetingVenue === "string" &&
    meetingVenue.trim().toLowerCase() === "online";

  /* ---------- Fetch picklists on open ---------- */
  React.useEffect(() => {
    if (!isCreateOpen) return;
    let cancelled = false;

    (async () => {
      // ---------- Meeting Venue ----------
      try {
        const venueRaw = await getPicklistValues("Meeting_Venue__s", "Events");
        const venueValues = normalizePicklistOptions(venueRaw);

        if (!cancelled && venueValues.length) {
          setMeetingVenueOptions(venueValues);

          patchMeetingForm((prev) => {
            const current =
              typeof prev === "object" && prev !== null ? prev : meetingForm;

            // extract a string value from meetingVenue
            let currentValue = current.meetingVenue;
            if (typeof currentValue !== "string" && currentValue != null) {
              currentValue =
                currentValue.value ||
                currentValue.actual_value ||
                currentValue.display_value ||
                currentValue.label ||
                "";
            }

            const exists =
              !!currentValue &&
              venueValues.some((v) => v.value === currentValue);

            const nextValue = exists
              ? currentValue
              : venueValues[0]?.value || "";

            return { ...current, meetingVenue: nextValue };
          });
        }
      } catch {
        if (!cancelled) {
          const fallback = normalizePicklistOptions([
            "In-office",
            "Client location",
            "Online",
          ]);
          setMeetingVenueOptions(fallback);
          patchMeetingForm({ meetingVenue: fallback[0]?.value || "" });
        }
      }

      // ---------- Appointment Type ----------
      try {
        let apptOptions = [];

        if (appointmentTypes && appointmentTypes.length) {
          // use from global state
          apptOptions = normalizePicklistOptions(appointmentTypes);
        } else {
          // fetch from Zoho as fallback
          const apptRaw = await getPicklistValues("Appointment_Type", "Events");
          apptOptions = normalizePicklistOptions(apptRaw);
        }

        if (!cancelled && apptOptions.length) {
          setApptTypeOptions(apptOptions);

          patchMeetingForm((prev) => {
            const current =
              typeof prev === "object" && prev !== null ? prev : meetingForm;

            const currVal = current.appointmentType || "";

            const exists = apptOptions.some((opt) => opt.value === currVal);
            const nextVal = exists ? currVal : apptOptions[0].value;

            return { ...current, appointmentType: nextVal };
          });
        }
      } catch {
        if (!cancelled) {
          const fallback = normalizePicklistOptions([
            "Intro Call",
            "Demo",
            "Follow-up",
            "Review",
          ]);
          setApptTypeOptions(fallback);
          patchMeetingForm({ appointmentType: fallback[0]?.value || "" });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isCreateOpen, patchMeetingForm, meetingForm, appointmentTypes]);

  /* Reset errors on close */
  React.useEffect(() => {
    if (!isCreateOpen) {
      setErrors({
        title: false,
        host: false,
        time: false,
        repeat: false,
      });
    }
  }, [isCreateOpen]);

  /* Auto default start/end – use selectedDate if future */
  React.useEffect(() => {
    if (!isCreateOpen) return;
    if (modalMode !== "create") return;

    // don't override if already set
    if (meetingForm.startDateTime && meetingForm.endDateTime) return;

    const now = dayjs();
    const hasSelected = !!selectedDate;
    const selected = hasSelected ? dayjs(selectedDate) : null;

    let base = now;

    // if selected date is in the future (by "day")
    if (selected && selected.isAfter(now, "day")) {
      base = selected.hour(now.hour()).minute(now.minute());
    }

    // Round up the base time to the next 15-min slot
    const roundedStart = roundUpToQuarterHour(base);
    const start = roundedStart;
    const end = roundedStart.add(15, "minute");

    patchMeetingForm({
      startDateTime: start.toDate(),
      endDateTime: end.toDate(),
      allDay: false,
    });
  }, [
    isCreateOpen,
    modalMode,
    meetingForm.startDateTime,
    meetingForm.endDateTime,
    patchMeetingForm,
    selectedDate,
  ]);

React.useEffect(() => {
  if (!isCreateOpen || modalMode !== 'create') return;

  if (typeof meetingVenue === 'string' && 
      meetingVenue.trim().toLowerCase() === 'client location') {
    
    const shouldClear = !relatedRecord?.id || 
                        !relatedRecord?.raw || 
                        !relatedRecord?.module;
    
    if (shouldClear && location) {
      console.log('🧹 Clearing location (no selection/module)');
      patchMeetingForm({ location: '' });
      return;
    }
    
    if (relatedRecord?.raw && relatedRecord?.module) {
      const row = relatedRecord.raw;
      let address = '';

      switch (relatedRecord.module) {
        case 'Leads':
          address = row.Street || row.City || '';
          break;
        case 'Accounts':
          const accountCity = row.Billing_City || '';
          const accountState = row.Billing_State || '';
          const accountStreet = row.Billing_Street || '';
          const cityState = accountCity && accountState ? `${accountCity}, ${accountState}` : accountCity || accountState || '';
          address = [accountStreet, cityState].filter(Boolean).join(', ');
          break;
        case 'Contacts':
          const contactCity = row.Mailing_City || '';
          const contactState = row.Mailing_State || '';
          const contactStreet = row.Mailing_Street || '';
          const contactCityState = contactCity && contactState ? `${contactCity}, ${contactState}` : contactCity || contactState || '';
          address = [contactStreet, contactCityState].filter(Boolean).join(', ');
          break;
        case 'Deals':
          address = row.Street || row.Street_Address || row.City1 || '';
          break;
        default:
          address = '';
      }

      console.log(`✅ ${relatedRecord.module}:`, address || 'EMPTY');

      if (address) {
        if (location !== address) {
          console.log('🎯 Auto-filling:', address);
          patchMeetingForm({ location: address });
        }
      } else if (location) {
        // CLEAR location if address is empty but location has old value
        console.log('🧹 Clearing location (empty address)');
        patchMeetingForm({ location: '' });
      }
    }
  }
  // IN-OFFICE logic...
  else if (typeof meetingVenue === 'string' && 
           meetingVenue.toLowerCase().includes('in-office') && host?.id) {
    // ... showroom logic
  }
  // CLEAR for other venues
  else if (location) {
    console.log('🧹 Clearing location (venue change)');
    patchMeetingForm({ location: '' });
  }
}, [meetingVenue, relatedRecord?.id, relatedRecord?.module, relatedRecord?.raw, host?.id, location, patchMeetingForm, isCreateOpen, modalMode]);

  const appointmentTypeLabel = React.useMemo(() => {
    if (!appointmentType) return "";
    const found = apptTypeOptions.find((opt) =>
      typeof opt === "string"
        ? opt === appointmentType
        : opt.value === appointmentType
    );
    if (!found) return appointmentType;
    return typeof found === "string" ? found : found.label || found.value;
  }, [appointmentType, apptTypeOptions]);

  /* Invite by email */
  const handleAddInviteByEmail = React.useCallback(() => {
    const email = String(newEmail || "").trim();
    if (!email) return;
    const next = [
      ...(participants || []),
      { name: null, participant: email, type: "email", Email: email },
    ];
    patchMeetingForm({ participants: next });
    setNewEmail("");
    setAddOpen(false);
  }, [newEmail, participants, patchMeetingForm]);

  /* Submit */
  const handleSubmit = async () => {
    console.log("meeting form", meetingForm);
    const {
      subject,
      description,
      location,
      startDateTime,
      endDateTime,
      host = meetingForm.host || meetingForm.owner,
      relatedRecord,
      relatedType,
      participants = [],
      meetingVenue,
      Status,
      allDay,
      appointmentType,
      currency,
      remind_at,
      repeat,
      editId,
      id: formId,
    } = meetingForm;

    // ----- VALIDATION -----
    const titleMissing = !subject || !subject.trim();
    const hostMissing = !host;

    const safeMeetingVenue =
      typeof meetingVenue === "string"
        ? meetingVenue
        : meetingVenue?.actual_value ||
          meetingVenue?.value ||
          meetingVenue?.display_value ||
          meetingVenue?.label ||
          null;

    let timeInvalid = false;
    if (!allDay) {
      if (!startDateTime || !endDateTime) {
        timeInvalid = true;
      } else {
        const start = dayjs(startDateTime);
        const end = dayjs(endDateTime);
        timeInvalid = !start.isBefore(end); // only here
      }
    }

    const venueIsOnline =
      typeof meetingVenue === "string" &&
      meetingVenue.trim().toLowerCase() === "online";

    // If Online, silently fix repeat
    if (venueIsOnline && repeat !== "Does not repeat") {
      patchMeetingForm({ repeat: "Does not repeat" });
    }

    const newErrors = {
      title: titleMissing,
      host: hostMissing,
      time: timeInvalid,
      repeat: false, // never block on repeat
    };

    if (Object.values(newErrors).some(Boolean)) {
      setErrors(newErrors);
      return; // stop submit
    }

    // clear errors
    setErrors({
      title: false,
      host: false,
      time: false,
      repeat: false,
    });

    // ----- API LOGIC -----
    setSubmitting(true);

    try {
      const buildParticipants = (arr = []) =>
        arr.map((p) => {
          if (p.type === "email") {
            const emailVal = p.participant || p.email || p.Email;
            return {
              name: p.name ?? null,
              participant: emailVal,
              type: "email",
              Email: p.Email || p.email || emailVal,
            };
          }
          return {
            participant: p.participant,
            name: p.Full_name || p.name,
            Email: p.email || p.Email || null,
            type: p.type,
          };
        });

      const { start, end } = toZohoAllDayRange(selectedDate);
      const startDT = toZohoDateTime(startDateTime);
      const endDT = toZohoDateTime(endDateTime);
      const startDateOnly = allDay ? start : null;
      const endDateOnly = allDay ? end : null;

      const Participants = buildParticipants(participants);

      // Determine status: "Scheduled" for new meetings, preserve existing for edits
      const meetingStatus = modalMode === "create" ? "Scheduled" : (Status || "PLANNED");

      const apiData = {
        Event_Title: subject || "",
        Description: description || "",
        Venue: location || "",
        Start_DateTime: allDay ? startDateOnly : startDT,
        End_DateTime: allDay ? endDateOnly : endDT,
        What_Id:
          relatedRecord && relatedRecord.id
            ? { id: relatedRecord.id, name: relatedRecord.name }
            : null,
        Participants,
        Meeting_Venue__s: safeMeetingVenue || null,
        Check_In_Status: meetingStatus, // Use Check_In_Status for meeting status
        Status: meetingStatus,
        All_Day: !!allDay,
        Appointment_Type: appointmentType || "",
        Recurring_Activity: buildRecurringActivity(
          repeat,
          allDay ? startDateOnly : startDT
        ),
        Remind_At: remind_at || null,
        $se_module: relatedType,
        Owner: host,
      };

      let resp;
      let newRecordId = null;
      console.log("api data", apiData);
      // EDIT MODE
      if (modalMode === "edit") {
        const recordId = editId || formId || relatedRecord?.id;
        if (!recordId) throw new Error("No record id for update");

        resp = await updateRecord("Events", { id: recordId, ...apiData });
        newRecordId = recordId;

        const status = resp?.data?.[0]?.status;
        const code = resp?.data?.[0]?.code;

        if (status === "success" || code === "SUCCESS") {
          try {
            fetchStart();

            // 1) Get all events for the selected day
            const dayRecords = await searchRecords(selectedDate || new Date());
            const baseList = Array.isArray(dayRecords) ? dayRecords : [];

            // 2) Fetch the freshly-updated record from Zoho
            const getResp = await getRecord("Events", newRecordId);
            const updatedRecord =
              getResp?.data?.[0] ||
              getResp?.details?.statusMessage?.data?.[0] ||
              null;

            // 3) Build final list with updated record at the top
            let finalList = baseList;
            if (updatedRecord) {
              finalList = [
                updatedRecord,
                ...baseList.filter((r) => (r.id || r.ID) !== newRecordId),
              ];
            }

            fetchSuccess(finalList);
            closeModal();
          } catch (err) {
            console.error("Failed to refresh calendar after update:", err);
            fetchError(err?.message || "Could not refresh meetings");
          }
        } else {
          const msg =
            resp?.data?.[0]?.message ||
            resp?.data?.[0]?.details?.message ||
            "Failed to update meeting";
          fetchError(msg);
        }

        return;
      }

      // CREATE MODE
      resp = await createRecord("Events", apiData);

      newRecordId =
        resp?.data?.[0]?.details?.id || resp?.data?.[0]?.details?.ID || null;

      const status = resp?.data?.[0]?.status;
      const code = resp?.data?.[0]?.code;

      if (status === "success" || code === "SUCCESS") {
        if (!newRecordId) {
          throw new Error("Create success but no record id returned");
        }

        try {
          fetchStart();
          const dayRecords = await searchRecords(selectedDate || new Date());
          const baseList = Array.isArray(dayRecords) ? dayRecords : [];

          const getResp = await getRecord("Events", newRecordId);
          const createdRecord =
            getResp?.data?.[0] ||
            getResp?.details?.statusMessage?.data?.[0] ||
            null;

          let finalList = baseList;
          if (createdRecord) {
            finalList = [
              createdRecord,
              ...baseList.filter((r) => (r.id || r.ID) !== newRecordId),
            ];
          }

          fetchSuccess(finalList);

          // Send SMS confirmation to customer (async - don't block UI)
          if (createdRecord && relatedRecord) {
            sendMeetingConfirmationSMS(
              { ...createdRecord, id: newRecordId },
              relatedRecord
            ).then((smsResult) => {
              if (smsResult.success) {
                console.log("SMS confirmation sent successfully");
              } else {
                console.warn("SMS confirmation failed:", smsResult.error);
              }
            }).catch((smsErr) => {
              console.warn("SMS sending error:", smsErr);
            });
          }

          closeModal();
        } catch (err) {
          console.error("Failed to refresh calendar after create:", err);
          fetchError(err?.message || "Could not refresh meetings");
        }
      } else {
        const msg =
          resp?.data?.[0]?.message ||
          resp?.data?.[0]?.details?.message ||
          "Failed to create meeting";
        fetchError(msg);
      }
    } catch (err) {
      console.error("Error while submitting meeting:", err);
      fetchError(err?.message || "Failed to save meeting");
    } finally {
      setSubmitting(false);
    }
  };

  /* Related To select */
  // const handleRelatedSelect = React.useCallback(
  //   (row) => {
  //     if (!row) {
  //       setOpenOppModal(false);
  //       return;
  //     }

  //     const id = row.id || row.ID || row._id;

  //     const name =
  //       row.Full_Name ||
  //       row.full_name ||
  //       row.Name ||
  //       row.name ||
  //       row.Account_Name?.name ||
  //       row.Account_Name ||
  //       row.Company ||
  //       row.Deal_Name ||
  //       row.Subject ||
  //       "";

  //     patchMeetingForm({
  //       relatedRecord: { id, name },
  //     });

  //     setOpenOppModal(false);
  //   },
  //   [patchMeetingForm]
  // );
  const handleRelatedSelect = React.useCallback(
  (selected) => {  // renamed from 'row' for clarity
    if (!selected) {
      setOpenOppModal(false);
      return;
    }

    console.log('📋 Selected:', selected); // DEBUG

    const { id, name, module, raw } = selected;  // ← EXTRACT MODULE!

    patchMeetingForm({
      relatedRecord: { id, name, module, raw }  // ← STORE MODULE!
    });

    setOpenOppModal(false);
  },
  [patchMeetingForm]
);

  const meetingVenueLabel =
    meetingVenueOptions.find((opt) => opt.value === meetingVenue)?.label ||
    meetingVenue ||
    "";
  /* -------------------- Render -------------------- */

  return (
    <Dialog
      open={isCreateOpen}
      onClose={closeModal}
      fullWidth
      maxWidth="sm"
      PaperProps={{
        sx: {
          borderRadius: "18px",
          overflow: "hidden",
          boxShadow: "0 20px 50px rgba(15, 23, 42, 0.30)",
          maxWidth: 720, // a bit narrower
        },
      }}
    >
      <DialogContent
        sx={{
          p: 0,
          bgcolor: "#F8FAFC",
          scrollbarWidth: "none",
        }}
      >
        {/* ===== Header: Title + basic error ===== */}
        <Box
          className="meeting-header"
          sx={{
            px: 3,
            py: 2.5,
            borderBottom: "1px solid #E2E8F0",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 2,
            bgcolor: "#FFFFFF",
          }}
        >
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 2,
              flex: 1,
              minWidth: 0,
            }}
          >
            <Box
              sx={{
                width: 32,
                height: 32,
                borderRadius: "999px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                bgcolor: "#EEF2FF",
                color: "#4F46E5",
                fontSize: 18,
                flexShrink: 0,
              }}
            >
              <SlClock />
            </Box>

            <input
              type="text"
              placeholder="Add a meeting title"
              value={subject || ""}
              onChange={(e) => {
                patchMeetingForm({ subject: e.target.value });
                if (errors.title) {
                  setErrors((prev) => ({ ...prev, title: false }));
                }
              }}
              style={{
                width: "100%",
                fontSize: 18,
                fontWeight: 600,
                color: "#0F172A",
                border: "none",
                outline: "none",
                background: "transparent",
              }}
              className="titleField"
            />
          </Box>

          {errors.title && (
            <Typography
              sx={{ fontSize: 12, color: "#F04438", whiteSpace: "nowrap" }}
            >
              Meeting title is required
            </Typography>
          )}
        </Box>

        {/* ===== Body: sections ===== */}
        <Box
          sx={{
            p: 2,
            display: "flex",
            flexDirection: "column",
            gap: 1.5,
          }}
        >
          {/* === Section: Venue / Location / Appointment type === */}
          <Box className="meeting-section">
            <Typography className="section-label">Meeting details</Typography>

            <Box
              sx={{
                display: "flex",
                flexWrap: "wrap",
                alignItems: "stretch",
                gap: 1,
                mt: 1,
              }}
            >
              {/* Venue */}
              <Box sx={{ flex: 1, minWidth: { xs: "100%", sm: 260 } }}>
                <Typography className="field-label">Venue</Typography>
                <ClickableBox
                  value={meetingVenueLabel}
                  placeholder="Meeting venue"
                  icon={
                    <PlaceOutlinedIcon sx={{ color: "#1b76d2" }} />
                  }
                  onClick={(e) => setVenueAnchor(e.currentTarget)}
                  sx={{
                    borderRadius: 1.5,
                    border: "1px solid #E2E8F0",
                    mt: 0.5,
                  }}
                />
                <CustomPopover
                  open={Boolean(venueAnchor)}
                  anchorEl={venueAnchor}
                  onClose={() => setVenueAnchor(null)}
                  options={meetingVenueOptions}
                  onSelect={(opt) => {
                    const value = typeof opt === "string" ? opt : opt.value;
                    const lower = (value || "").toString().trim().toLowerCase();
                    const next = { meetingVenue: value };
                    if (lower === "online") {
                      next.repeat = "Does not repeat";
                    }
                    patchMeetingForm(next);
                    if (errors.repeat) {
                      setErrors((prev) => ({ ...prev, repeat: false }));
                    }
                  }}
                />
              </Box>

              {/* Location */}
              <Box
                sx={{
                  flex: 1,
                  minWidth: { xs: "100%", sm: 260 },
                }}
              >
                <Typography className="field-label">Location</Typography>
                <Box
                  sx={{
                    mt: 0.5,
                    display: "flex",
                    alignItems: "center",
                    gap: 1,
                    borderRadius: 1.5,
                    border: "1px solid #E2E8F0",
                    px: 1.5,
                    height: 40,
                    bgcolor: "#FFFFFF",
                  }}
                >
                  <PlaceOutlinedIcon sx={{ color: "#1b76d2" }} />
                  <InputBase
                    placeholder="Add location or meeting link"
                    value={location || ""}
                    onChange={(e) =>
                      patchMeetingForm({ location: e.target.value })
                    }
                    sx={{
                      flex: 1,
                      fontSize: 15,
                      fontWeight: 500,
                      color: "#0F172A",
                    }}
                  />
                </Box>
              </Box>

              {/* Appointment Type */}
              <Box sx={{ flex: 1, minWidth: { xs: "100%", sm: 260 } }}>
                <Typography className="field-label">
                  Appointment type
                </Typography>
                <ClickableBox
                  value={appointmentTypeLabel}
                  placeholder="Appointment type"
                  onClick={(e) => setApptAnchor(e.currentTarget)}
                  sx={{
                    borderRadius: 1.5,
                    border: "1px solid #E2E8F0",
                    mt: 0.5,
                  }}
                />
                <CustomPopover
                  open={Boolean(apptAnchor)}
                  anchorEl={apptAnchor}
                  onClose={() => setApptAnchor(null)}
                  options={apptTypeOptions}
                  onSelect={(opt) =>
                    patchMeetingForm({
                      appointmentType:
                        typeof opt === "string" ? opt : opt.value,
                    })
                  }
                />
              </Box>
            </Box>
          </Box>

          {/* === Section: Schedule === */}
          <Box className="meeting-section">
            <Typography className="section-label">Schedule</Typography>

            <Box
              sx={{
                display: "flex",
                flexWrap: "wrap",
                gap: 2,
                mt: 1,
              }}
            >
              {/* Start */}
              <Box sx={{ flex: 1, minWidth: { xs: "100%", sm: 260 } }}>
                <Typography className="field-label">Start</Typography>
                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: "1.2fr 1fr",
                    gap: 1,
                    mt: 0.5,
                  }}
                >
                  <ClickableBox
                    icon={
                      <svg
                        width="22"
                        height="22"
                        viewBox="0 0 24 24"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          d="M8 2V5M16 2V5M3.5 9.08997H20.5"
                          stroke="#0F172A"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                        />
                        <path
                          d="M21 8.5V17C21 20 19.5 22 16 22H8C4.5 22 3 20 3 17V8.5C3 5.5 4.5 3.5 8 3.5H16C19.5 3.5 21 5.5 21 8.5Z"
                          stroke="#0F172A"
                          strokeWidth="1.5"
                        />
                      </svg>
                    }
                    value={fmtDate(startDateTime)}
                    placeholder="Start date"
                    onClick={(e) =>
                      !allDay && setStartDateAnchor(e.currentTarget)
                    }
                    sx={{
                      borderRadius: 1.5,
                      border: "1px solid #E2E8F0",
                      opacity: allDay ? 0.5 : 1,
                      pointerEvents: allDay ? "none" : "auto",
                      color: errors.time ? "#F04438" : "#0F172A",
                    }}
                  />
                  <ClickableBox
                    icon={<SlClock size={20} color="#0F172A" />}
                    value={fmtTime(startDateTime)}
                    placeholder="Start time"
                    onClick={(e) =>
                      !allDay && setStartTimeAnchor(e.currentTarget)
                    }
                    sx={{
                      borderRadius: 1.5,
                      border: "1px solid #E2E8F0",
                      opacity: allDay ? 0.5 : 1,
                      pointerEvents: allDay ? "none" : "auto",
                      color: errors.time ? "#F04438" : "#0F172A",
                    }}
                  />
                </Box>

                <DatePopover
                  open={Boolean(startDateAnchor)}
                  anchorEl={startDateAnchor}
                  onClose={() => setStartDateAnchor(null)}
                  value={startDateTime}
                  onChange={(d) => {
                    patchMeetingForm({ startDateTime: d });
                    if (errors.time) {
                      setErrors((prev) => ({ ...prev, time: false }));
                    }
                  }}
                />

                <TimePopover
                  open={Boolean(startTimeAnchor)}
                  anchorEl={startTimeAnchor}
                  onClose={() => setStartTimeAnchor(null)}
                  value={startDateTime}
                  onChange={(d) => {
                    patchMeetingForm({ startDateTime: d });
                    if (errors.time) {
                      setErrors((prev) => ({ ...prev, time: false }));
                    }
                  }}
                  disablePast
                />
              </Box>

              {/* End */}
              <Box sx={{ flex: 1, minWidth: { xs: "100%", sm: 260 } }}>
                <Typography className="field-label">End</Typography>
                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: "1.2fr 1fr",
                    gap: 1,
                    mt: 0.5,
                  }}
                >
                  <ClickableBox
                    icon={
                      <svg
                        width="22"
                        height="22"
                        viewBox="0 0 24 24"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          d="M8 2V5M16 2V5M3.5 9.08997H20.5"
                          stroke="#0F172A"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                        />
                        <path
                          d="M21 8.5V17C21 20 19.5 22 16 22H8C4.5 22 3 20 3 17V8.5C3 5.5 4.5 3.5 8 3.5H16C19.5 3.5 21 5.5 21 8.5Z"
                          stroke="#0F172A"
                          strokeWidth="1.5"
                        />
                      </svg>
                    }
                    value={fmtDate(endDateTime)}
                    placeholder="End date"
                    onClick={(e) =>
                      !allDay && setEndDateAnchor(e.currentTarget)
                    }
                    sx={{
                      borderRadius: 1.5,
                      border: "1px solid #E2E8F0",
                      opacity: allDay ? 0.5 : 1,
                      pointerEvents: allDay ? "none" : "auto",
                      color: errors.time ? "#F04438" : "#0F172A",
                    }}
                  />
                  <ClickableBox
                    icon={<SlClock size={20} color="#0F172A" />}
                    value={fmtTime(endDateTime)}
                    placeholder="End time"
                    onClick={(e) =>
                      !allDay && setEndTimeAnchor(e.currentTarget)
                    }
                    sx={{
                      borderRadius: 1.5,
                      border: "1px solid #E2E8F0",
                      opacity: allDay ? 0.5 : 1,
                      pointerEvents: allDay ? "none" : "auto",
                      color: errors.time ? "#F04438" : "#0F172A",
                    }}
                  />
                </Box>

                <DatePopover
                  open={Boolean(endDateAnchor)}
                  anchorEl={endDateAnchor}
                  onClose={() => setEndDateAnchor(null)}
                  value={endDateTime}
                  onChange={(d) => {
                    patchMeetingForm({ endDateTime: d });
                    if (errors.time) {
                      setErrors((prev) => ({ ...prev, time: false }));
                    }
                  }}
                />
                <TimePopover
                  open={Boolean(endTimeAnchor)}
                  anchorEl={endTimeAnchor}
                  onClose={() => setEndTimeAnchor(null)}
                  value={endDateTime}
                  onChange={(d) => {
                    patchMeetingForm({ endDateTime: d });
                    if (errors.time) {
                      setErrors((prev) => ({ ...prev, time: false }));
                    }
                  }}
                  disablePast
                />
              </Box>

              {/* All day + Repeat */}
              <Box
                sx={{
                  flexBasis: "100%",
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "center",
                  gap: 2,
                  mt: 0.5,
                }}
              >
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={!!allDay}
                      onChange={(e) =>
                        patchMeetingForm({ allDay: e.target.checked })
                      }
                      sx={{
                        color: "#4B5563",
                        "&.Mui-checked": { color: "#0F172A" },
                      }}
                    />
                  }
                  label={
                    <Typography fontSize={14} fontWeight={500} color="#0F172A">
                      All day
                    </Typography>
                  }
                />

                <Box sx={{ flex: 1, minWidth: 220 }}>
                  <Typography className="field-label">Repeat</Typography>
                  <ClickableBox
                    value={repeat}
                    placeholder="Does not repeat"
                    onClick={(e) => {
                      if (!isOnlineVenue) {
                        setRepeatAnchor(e.currentTarget);
                      }
                    }}
                    sx={{
                      borderRadius: 1.5,
                      border: "1px solid #E2E8F0",
                      mt: 0.5,
                      opacity: isOnlineVenue ? 0.5 : 1,
                      pointerEvents: isOnlineVenue ? "none" : "auto",
                    }}
                  />
                  <CustomPopover
                    open={Boolean(repeatAnchor)}
                    anchorEl={repeatAnchor}
                    onClose={() => setRepeatAnchor(null)}
                    options={repeatOptions}
                    onSelect={(v) => {
                      patchMeetingForm({ repeat: v });
                      if (errors.repeat) {
                        setErrors((prev) => ({ ...prev, repeat: false }));
                      }
                    }}
                  />
                </Box>
              </Box>

              {errors.time && (
                <Typography sx={{ fontSize: 12, color: "#F04438", mt: 0.5 }}>
                  End time must be after start time
                </Typography>
              )}
            </Box>
          </Box>

          {/* === Section: Related & Host === */}
          <Box className="meeting-section">
            <Typography className="section-label">Context</Typography>

            <Box
              sx={{
                display: "flex",
                flexWrap: "wrap",
                gap: 2,
                mt: 1,
              }}
            >
              {/* Related To */}
              <Box sx={{ flex: 1, minWidth: { xs: "100%", sm: 260 } }}>
                <Typography className="field-label">Related to</Typography>
                <ClickableBox
                  value={relatedRecord?.name || relatedRecord?.Name}
                  placeholder="Link to a deal, contact, or account"
                  onClick={() => setOpenOppModal(true)}
                  sx={{
                    borderRadius: 1.5,
                    border: "1px solid #E2E8F0",
                    mt: 0.5,
                  }}
                />
                <OpportunityLookupModal
                  open={openOppModal}
                  onClose={() => setOpenOppModal(false)}
                  onSelect={handleRelatedSelect}
                />
              </Box>

              {/* Host */}
              <Box sx={{ flex: 1, minWidth: { xs: "100%", sm: 260 } }}>
                <Typography className="field-label">Host</Typography>
                <ClickableBox
                  value={
                    typeof host === "string"
                      ? host
                      : host?.name || host?.full_name
                  }
                  placeholder="Assign host"
                  onClick={(e) => setHostAnchor(e.currentTarget)}
                  sx={{
                    borderRadius: 1.5,
                    border: `1px solid ${errors.host ? "#F97373" : "#E2E8F0"}`,
                    mt: 0.5,
                  }}
                />
                {errors.host && (
                  <Typography sx={{ fontSize: 12, color: "#F04438", mt: 0.5 }}>
                    Host is required
                  </Typography>
                )}

                <HostPopover
                  open={Boolean(hostAnchor)}
                  anchorEl={hostAnchor}
                  onClose={() => setHostAnchor(null)}
                  hosts={hosts}
                  onSelect={(h) => {
                    patchMeetingForm({
                      host: {
                        id: h.id,
                        name: h.full_name || h.name,
                        email: h.email || h.Email || h.user_email,
                      },
                    });
                    if (errors.host) {
                      setErrors((prev) => ({ ...prev, host: false }));
                    }
                  }}
                />
              </Box>
            </Box>
          </Box>

          {/* === Section: Participants === */}
          <Box className="meeting-section">
            <Box
              className="participantsHeader"
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                mb: 1,
                gap: 2,
              }}
            >
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 1,
                }}
              >
                <Avatar
                  sx={{
                    width: 28,
                    height: 28,
                    bgcolor: "#EEF2FF",
                    color: "#4F46E5",
                    fontSize: 14,
                  }}
                >
                  +
                </Avatar>
                <Typography
                  fontSize={14}
                  fontWeight={600}
                  color="#0F172A"
                  onClick={openParticipants}
                  sx={{ cursor: "pointer" }}
                >
                  Add participants
                </Typography>
                <ParticipantsModal open={participantsModal.open} />
              </Box>

              <Button
                size="small"
                variant="outlined"
                onClick={() => setAddOpen(true)}
                sx={{
                  borderRadius: 999,
                  textTransform: "none",
                  fontSize: 12,
                }}
              >
                Invite by email
              </Button>
            </Box>

            <Box
              className="participantsListView"
              sx={{
                maxHeight: 150,
                overflowY: "auto",
                display: "flex",
                flexDirection: "column",
                gap: 1,
              }}
            >
              {(participants || []).map((p, idx) => (
                <Box
                  className="participantCard"
                  key={idx}
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    px: 1.5,
                    py: 0.75,
                    borderRadius: 999,
                    bgcolor: "#F9FAFB",
                  }}
                >
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      gap: 1,
                      minWidth: 0,
                    }}
                  >
                    <Avatar
                      sx={{ width: 28, height: 28, bgcolor: "#E5E7EB" }}
                    />
                    <Typography
                      fontSize={14}
                      noWrap
                      sx={{ fontWeight: 500, color: "#111827" }}
                    >
                      {p.Full_name ||
                        p.name ||
                        p.Email ||
                        p.email ||
                        p.participant}
                    </Typography>
                  </Box>

                  <IconButton
                    onClick={() => {
                      const updated = participants.filter(
                        (_, i2) => i2 !== idx
                      );
                      patchMeetingForm({ participants: updated });
                    }}
                    sx={{ padding: 0.5, fontSize: 16 }}
                  >
                    ✕
                  </IconButton>
                </Box>
              ))}
            </Box>
          </Box>
        </Box>

        {/* Add Participant (Invite by email) */}
        <Dialog
          open={addOpen}
          onClose={() => setAddOpen(false)}
          fullWidth
          maxWidth="sm"
        >
          <DialogTitle>Add participant</DialogTitle>
          <DialogContent dividers>
            <InputBase
              autoFocus
              placeholder="name@example.com"
              fullWidth
              sx={{
                border: "1px solid #E5E7EB",
                borderRadius: 2,
                px: 2,
                py: 1.25,
                fontSize: 14,
              }}
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button variant="contained" onClick={handleAddInviteByEmail}>
              Add
            </Button>
          </DialogActions>
        </Dialog>
      </DialogContent>

      <DialogActions
        sx={{
          px: 3,
          py: 2,
          borderTop: "1px solid #E2E8F0",
          bgcolor: "#FFFFFF",
          display: "flex",
          justifyContent: "space-between",
        }}
      >
        <Typography fontSize={12} color="#64748B">
          {modalMode === "edit"
            ? "Update this meeting in your calendar"
            : "Create a new meeting in your calendar"}
        </Typography>

        <Box sx={{ display: "flex", gap: 1.5 }}>
          <Button
            onClick={closeModal}
            disabled={submitting}
            sx={{
              textTransform: "none",
              borderRadius: 999,
              px: 2.5,
            }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSubmit}
            disabled={submitting}
            sx={{
              textTransform: "none",
              borderRadius: 999,
              px: 3,
            }}
          >
            {submitting
              ? modalMode === "edit"
                ? "Updating..."
                : "Creating..."
              : modalMode === "edit"
              ? "Update meeting"
              : "Create meeting"}
          </Button>
        </Box>
      </DialogActions>

      <ToastContainer position="top-right" autoClose={3000} />
    </Dialog>
  );
}
