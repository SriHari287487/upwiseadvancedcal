// // src/components/Calendar/TimeColumn.jsx
// import React, { useEffect, useState } from "react";

// const TimeColumn = () => {
//   const [times, setTimes] = useState([]);

//   useEffect(() => {
//     const locale = navigator.language || "en-US";
//     const opts = { hour: "2-digit", minute: "2-digit", hour12: !is24Hour(locale) };
//     const hours = Array.from({ length: 24 }, (_, i) =>
//       new Date(0, 0, 0, i).toLocaleTimeString(locale, opts)
//     );
//     setTimes(hours);
//   }, []);

//   const is24Hour = (locale) => {
//     const test = new Intl.DateTimeFormat(locale, { hour: "numeric" }).format(0);
//     return !test.toLowerCase().includes("am") && !test.toLowerCase().includes("pm");
//   };

//   return (
//     <div className="time-column">
//       {times.map((hour, i) => (
//         <div key={i} className="time-slot">
//           <span>{hour}</span>
//         </div>
//       ))}
//     </div>
//   );
// };

// export default TimeColumn;
import React, { useMemo } from "react";

const TimeColumn = () => {
  const is24Hour = (locale) => {
    const test = new Intl.DateTimeFormat(locale, { hour: "numeric" }).format(0);
    return !test.toLowerCase().includes("am") && !test.toLowerCase().includes("pm");
  };

  const times = useMemo(() => {
    const locale = navigator.language || "en-US";
    const opts = { hour: "2-digit", minute: "2-digit", hour12: !is24Hour(locale) };
    return Array.from({ length: 24 }, (_, i) =>
      new Date(0, 0, 0, i).toLocaleTimeString(locale, opts)
    );
  }, []);

  return (
    <div className="time-column">
      {times.map((hour, i) => (
        <div key={i} className="time-slot">
          <span>{hour}</span>
        </div>
      ))}
    </div>
  );
};

export default TimeColumn;
