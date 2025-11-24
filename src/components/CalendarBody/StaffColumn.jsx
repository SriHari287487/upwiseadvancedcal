// src/components/Calendar/StaffColumn.jsx
import React from "react";
import EventCard from "../MeetingCard/EventCard";

const StaffColumn = ({ member, events }) => {
  return (
    <div className="staff-column">
      <div className="staff-name">{member.name}</div>
      <div className="staff-schedule">
        {events.map((event) => (
          <EventCard key={event.id} event={event} />
        ))}
        <CurrentTimeLine />
      </div>
    </div>
  );
};

// ⏱️ Current time red line
const CurrentTimeLine = () => {
  const [top, setTop] = React.useState(0);

  React.useEffect(() => {
    const update = () => {
      const now = new Date();
      const mins = now.getHours() * 60 + now.getMinutes();
      const percent = (mins / (24 * 60)) * 100;
      setTop(percent);
    };

    update();
    const timer = setInterval(update, 60000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div
      className="current-time-line"
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        height: "2px",
        background: "red",
        top: `${top}%`,
        zIndex: 10,
      }}
    />
  );
};

export default StaffColumn;
