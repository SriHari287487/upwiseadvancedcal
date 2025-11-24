import React, { useMemo, useState } from "react";
import "../../styles/eventCard.css";
import { MdLocationPin } from "react-icons/md";
import {
  Avatar,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
} from "@mui/material";
import { useCalendarState, useCalendarActions } from "../../Context/CalendarContext";
import { searchRecords, deleteRecord } from "../../Apis/zohoApi";

export default function EventCard({ event, top, height, left, width, onClick }) {
  const { appointmentTypes, appointmentTypeColor, selectedDate } = useCalendarState();
  const { fetchStart, fetchSuccess, fetchError } = useCalendarActions();

  const [hovered, setHovered] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const fmtTime = (d) =>
    new Intl.DateTimeFormat(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    }).format(new Date(d));

  const startLabel = fmtTime(event.start);
  const endLabel = fmtTime(event.end);

  const typeLabel = event.appointmentType || "Meeting";


  // ---- color logic (robust against actual_value vs display_value) ----
  const ALL_COLOR = "#E62E7B";

  const bgColor = useMemo(() => {
    const rawType = (event.appointmentType || "").trim();
    if (!rawType) return ALL_COLOR;

    // Normalize each picklist option into { actual, display, color }
    const normalized = (appointmentTypes || []).map((t) => {
      if (typeof t === "string") {
        return {
          actual: t,
          display: t,
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
      const display =
        t.display_value ??
        t.label ??
        t.name ??
        t.value ??
        t.actual_value ??
        actual;

      return {
        actual,
        display,
        color: t.color ?? t.colour_code ?? t.color_code ?? null,
      };
    });

    // Match either actual or display to whatever is stored on the event
    const idx = normalized.findIndex(
      (t) => t.actual === rawType || t.display === rawType
    );

    if (idx === -1) return ALL_COLOR;

    const match = normalized[idx];

    const palette =
      appointmentTypeColor && appointmentTypeColor.length
        ? appointmentTypeColor
        : ["#27C840", "#33BFFF", "#EFB91D", "#a78bfa", "#38bdf8"];

    return match.color || palette[idx % palette.length] || ALL_COLOR;
  }, [event.appointmentType, appointmentTypes, appointmentTypeColor]);

  // ---- related-to info ----
  const relatedName =
    event.relatedRecord?.name ||
    event.relatedToName ||
    event.related_to_name ||
    event.whatName ||
    event.What_Name ||
    event.r?.What_Id?.name ||
    event.r?.Who_Id?.name ||
    null;

  const relatedAvatarUrl =
    event.relatedRecord?.avatar ||
    event.relatedAvatar ||
    event.relatedPhotoUrl ||
    event.r?.What_Id?.photo ||
    event.r?.Who_Id?.photo ||
    null;

  // ---- delete logic ----
  const openConfirm = (e) => {
    e.stopPropagation(); // don't trigger onClick of event card
    setConfirmOpen(true);
  };

  const handleCloseConfirm = (e) => {
    if (e) e.stopPropagation();   
    if (deleting) return; // don't allow closing while deleting if you want
    setConfirmOpen(false);
  };

  const handleConfirmDelete = async (e) => {
     if (e) e.stopPropagation();  
    const recordId = event.id || event.ID;
    if (!recordId) {
      console.warn("No record id on event, cannot delete");
      setConfirmOpen(false);
      return;
    }

    try {
      setDeleting(true);
      fetchStart();

      const resp = await deleteRecord("Events", recordId);
      const status = resp?.data?.[0]?.status || resp?.status;
      const code = resp?.data?.[0]?.code;

      if (status === "success" || code === "SUCCESS") {
        const records = await searchRecords(selectedDate || new Date());
        fetchSuccess(Array.isArray(records) ? records : []);
        setConfirmOpen(false); // close only on success
      } else {
        const msg =
          resp?.data?.[0]?.message ||
          resp?.data?.[0]?.details?.message ||
          "Failed to delete meeting";
        fetchError(msg);
      }
    } catch (err) {
      console.error("Failed to delete meeting:", err);
      fetchError(err?.message || "Failed to delete meeting");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <div
        className="sg-event"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onClick={(e) => {
          e.stopPropagation();
          onClick && onClick(e);
        }}
        style={{
          top,
          height,
          left,
          width,
          cursor: "pointer",
          border: `1px solid ${bgColor}`,
          backgroundColor: `${bgColor}22`,
        }}
      >
        {hovered && (
          <button
            onClick={openConfirm}
            style={{
              position: "absolute",
              top: 4,
              right: 4,
              border: "none",
              padding: 0,
              width: 20,
              height: 20,
              borderRadius: "999px",
              background: "rgba(0,0,0,0.6)",
              color: "#fff",
              fontSize: 12,
              lineHeight: "20px",
              cursor: "pointer",
            }}
          >
            ×
          </button>
        )}

        <div className="ev-title">{event.title}</div>

        <div className="ev-meta">
          <span className="time-chip" style={{ background: bgColor }}>
            {startLabel} – {endLabel}
          </span>
          <span className="dot" style={{ color: bgColor }}>
            <MdLocationPin />
          </span>
          <span style={{ fontSize: 11, fontWeight: 400 }}>{event.location}</span>
        </div>

        {relatedName && (
          <div
            style={{
              marginTop: 8,
              display: "flex",
              justifyContent: "flex-start",
            }}
          >
            <Tooltip title={relatedName}>
              <Avatar
                src={relatedAvatarUrl || undefined}
                sx={{ width: 28, height: 28, fontSize: 13 }}
              >
                {!relatedAvatarUrl ? relatedName.charAt(0).toUpperCase() : null}
              </Avatar>
            </Tooltip>
          </div>
        )}
      </div>

      {/* ---- CONFIRM DELETE DIALOG ---- */}
      <Dialog
        open={confirmOpen}
        onClose={handleCloseConfirm}
        maxWidth="xs"
        fullWidth
        PaperProps={{
    // stop clicks inside the dialog from bubbling to the calendar
    onClick: (e) => {
      e.stopPropagation();
    },
  }}
  BackdropProps={{
    // stop clicks on the backdrop from bubbling as well
    onClick: (e) => {
      e.stopPropagation();
    },
  }}
      >
        <DialogTitle>Delete meeting?</DialogTitle>
        <DialogContent dividers>
          <Typography variant="subtitle1" sx={{ mb: 1 }}>
            {event.title || "Untitled event"}
          </Typography>
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            {startLabel} – {endLabel}
          </Typography>
          {event.location && (
            <Typography variant="body2" sx={{ color: "text.secondary", mt: 0.5 }}>
              Location: {event.location}
            </Typography>
          )}
          <Typography variant="body2" sx={{ mt: 2 }}>
            Are you sure you want to delete this meeting? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button size="small" sx={{ textTransform: "none" }} onClick={(e) => handleCloseConfirm(e)}  disabled={deleting}>
            Cancel
          </Button>
          <Button
            size="small"
         onClick={(e) => handleConfirmDelete(e)}
            color="error"
            variant="contained"
            disabled={deleting}
          >
            {deleting ? "Deleting..." : "Delete"}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}