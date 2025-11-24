// CalendarHeader.jsx
import React, { useState } from "react";
import {
  Box,
  Typography,
  Button,
  IconButton,
  styled,
  ToggleButton,
  ToggleButtonGroup,
} from "@mui/material";
import TuneOutlinedIcon from '@mui/icons-material/TuneOutlined';
import ArrowForwardIosRoundedIcon from "@mui/icons-material/ArrowForwardIosRounded";
import ArrowBackIosRoundedIcon from "@mui/icons-material/ArrowBackIosRounded";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import FiltersSidebar from "../FiltersSideBar/FiltersSidebar";
import "./Header.scss";
import {
  useCalendarState,
  useCalendarActions,
} from "../../Context/CalendarContext";
import { color } from "framer-motion";

const TodayButton = styled(Button)(() => ({
  borderRadius: 999,
  border: "1px solid #E2E8F0",
  color: "#1E293B",
  fontSize: 12,
  backgroundColor: "#ffffff",
  textTransform: "none",
  fontWeight: 600,
  padding: "4px 12px",
  boxShadow: "none",
  fontFamily: "'InstrumentSans', Inter, sans-serif",
  "&:hover": { backgroundColor: "#F8FAFC", borderColor: "#CBD5F5" },
}));

const NavIcon = styled(IconButton)(() => ({
  borderRadius: 999,
  border: "1px solid #E2E8F0",
  color: "#64748B",
  padding: 4,
  backgroundColor: "#ffffff",
  "&:hover": { backgroundColor: "#F8FAFC" },
}));

const ViewToggleGroup = styled(ToggleButtonGroup)(() => ({
  borderRadius: 999,
  background: "#F8FAFC",
  padding: 2,
  ".MuiToggleButton-root": {
    textTransform: "none",
    fontSize: 12,
    fontWeight: 600,
    border: "none",
    borderRadius: 999,
    padding: "4px 12px",
    color: "#64748B",
    "&.Mui-selected": {
      backgroundColor: "#1B76D2",
      color: "#F9FAFB",
    },
    "&:hover": {
      backgroundColor: "#E2E8F0",
      color: "#0F172A",
    },
  },
}));
const CreateButton = styled(Button)(() => ({
  borderRadius: 999,
  padding: "6px 12px",
  textTransform: "none",
  fontWeight: 600,
  fontSize: 13,
  display: "flex",
  alignItems: "center",
  gap: 6,
  background:
    "#1B76D2",
  color: "#FFFFFF",
  boxShadow: "0 10px 25px rgba(37, 99, 235, 0.3)",
  "&:hover": {
    boxShadow: "0 12px 30px rgba(37, 99, 235, 0.4)",
    transform: "translateY(-1px)",
    background:
      "#1B76D2",
  },
}));

function formatHeaderRange(view, date) {
  const d = new Date(date);

  if (view === "Day") {
    return d.toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }

  if (view === "Week") {
    const start = new Date(d);
    start.setDate(d.getDate() - d.getDay()); // Sunday start

    const end = new Date(start);
    end.setDate(start.getDate() + 6);

    const startStr = start.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
    const endStr = end.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });

    return `${startStr} - ${endStr}`;
  }

  if (view === "Month") {
    const start = new Date(d.getFullYear(), d.getMonth(), 1);
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);

    const startStr = start.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
    const endStr = end.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

    return `${startStr} - ${endStr}`;
  }

  return "";
}

export default function CalendarHeader({ activeView = "Day", onChange }) {
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const views = ["Month", "Week", "Day"];

  const { selectedDate } = useCalendarState();
  
  const { setSelectedDate, openCreate, goToToday } = useCalendarActions();

  const goNext = () => {
    const d = new Date(selectedDate);

    if (activeView === "Day") d.setDate(d.getDate() + 1);
    else if (activeView === "Week") d.setDate(d.getDate() + 7);
    else if (activeView === "Month") d.setMonth(d.getMonth() + 1);

    setSelectedDate(d);
  };

    const toggleFilterSidebar = () => setIsFilterOpen((prev) => !prev);

  const goPrev = () => {
    const d = new Date(selectedDate);

    if (activeView === "Day") d.setDate(d.getDate() - 1);
    else if (activeView === "Week") d.setDate(d.getDate() - 7);
    else if (activeView === "Month") d.setMonth(d.getMonth() - 1);

    setSelectedDate(d);
  };

  const handleViewChange = (event, nextView) => {
    if (!nextView) return;
    onChange?.(nextView);
  };

  return (
    <Box className="headerContainer">
      {/* Left side: Today + view toggle */}
      <Box className="sideBar">
        <TodayButton onClick={goToToday}>Today</TodayButton>

        <ViewToggleGroup
          size="small"
          exclusive
          value={activeView}
          onChange={handleViewChange}
        >
          {views.map((view) => (
            <ToggleButton key={view} value={view}>
              {view}
            </ToggleButton>
          ))}
        </ViewToggleGroup>
      </Box>

      {/* Center: prev / label / next */}
      <Box className="middleContainer">
        <NavIcon onClick={goPrev}>
          <ArrowBackIosRoundedIcon sx={{ fontSize: 14 }} />
        </NavIcon>

        <Typography className="date">
          {formatHeaderRange(activeView, selectedDate)}
        </Typography>

        <NavIcon onClick={goNext}>
          <ArrowForwardIosRoundedIcon sx={{ fontSize: 14 }} />
        </NavIcon>
      </Box>

      {/* Right: Create */}
      <Box className="sideBar" sx={{ gap: 1 }}>
        <CreateButton onClick={openCreate}>
          <AddRoundedIcon sx={{ fontSize: 18 }} />
          Create
        </CreateButton>
        <IconButton onClick={toggleFilterSidebar}>
          <TuneOutlinedIcon/>
        </IconButton>
      </Box>

      {isFilterOpen && (
        <FiltersSidebar open={isFilterOpen} onclose={() => setIsFilterOpen(false)} />
      )}
    </Box>
  );
}
