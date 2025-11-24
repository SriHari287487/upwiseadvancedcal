// MiniCalender.jsx
import React, { useMemo } from "react";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { DateCalendar } from "@mui/x-date-pickers/DateCalendar";
import dayjs from "dayjs";
import { Box } from "@mui/material";

const styles = {
  miniCalendar: {
    width: "auto",
    position: "sticky",
    top: 0,
    zIndex: 2,
  },
};

/**
 * MiniCalendar
 * Props:
 *  - value: Date (JS Date from parent, e.g. selectedDate)
 *  - onSelectDate: (jsDate: Date) => void
 */
export default function MiniCalendar({ value, onSelectDate }) {
  // Keep dayjs in sync with the parent Date value
  const dayjsValue = useMemo(() => dayjs(value), [value]);

  const handleDateChange = (newDayjs) => {
    // Pass the freshly picked JS Date to the parent
    onSelectDate?.(newDayjs?.toDate());
  };

  return (
    <Box sx={styles.miniCalendar}>
      <LocalizationProvider dateAdapter={AdapterDayjs}>
        <DateCalendar
          value={dayjsValue}
          onChange={handleDateChange}
          views={["year", "month", "day"]}
          sx={{ width: 260 }}
        />
      </LocalizationProvider>
    </Box>
  );
}
