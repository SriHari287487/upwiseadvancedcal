/**
 * useNowTop
 * - returns the "top" in px for the current time line
 * - gently auto-scrolls the main container on mount to reveal "now"
 */
import { useEffect, useState } from "react";
import { useCalendarState} from '../Context/CalendarContext'

export function useNowTop(containerRef) {
  const {rowHeight} = useCalendarState();
  const [nowTop, setNowTop] = useState(() => {
    const now = new Date();
    const mins = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;
    return (mins / 60) * rowHeight;
  });

  useEffect(() => {
    const recompute = () => {
      const d = new Date();
      const mins = d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60;
      setNowTop((mins / 60) * rowHeight);
    };

    // initial compute + reveal
    recompute();
    const el = containerRef?.current;
    if (el) {
      const headerH = 44; // match your --header-h in CSS
      const visible = el.clientHeight - headerH;
      const target = Math.max(0, nowTop - visible * 0.4);
      el.scrollTop = target;
    }

    const id = setInterval(recompute, 60 * 1000);
    return () => clearInterval(id);
  }, []);

  return nowTop;
}