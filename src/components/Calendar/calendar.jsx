// Calendar.jsx
import React from "react";
import { Box } from "@mui/material";
import CalendarHeader from "../Header/CalendarHeader";
import CalendarBody from "../CalendarBody/CalendarBody";
import "./calendar.scss";

const Calendar = () => {
  const [view, setView] = React.useState("Day"); // 👈 central view state

  return (
    <Box className="calendar-container">
      <CalendarHeader
        activeView={view}
        onChange={setView} // when user clicks Year/Week/Month/Day
      />
     <CalendarBody view={view} setView={setView} />
    </Box>
  );
};

export default Calendar;
