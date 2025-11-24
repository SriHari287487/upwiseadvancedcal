import React from "react";
import CalendarContainer from "./components/CalendarContainer";
import "./styles/styles.css";
import {CalendarProvider} from './Context/CalendarContext'
// import "@fontsource/instrument-sans";
// import "@fontsource/instrument-sans/400.css";
// import "@fontsource/instrument-sans/500.css";
// import "@fontsource/instrument-sans/700.css";


const App = () => {
  return (
    <div className="app-container">
      <CalendarProvider>
        <CalendarContainer />
      </CalendarProvider>
    </div>
  );
};

export default App;
