import { useState, useEffect, useMemo, useCallback } from "react";
import { searchRecords, getUserGroups, getUsers, getFields } from "../Apis/zohoApi";
import { normalizeZohoUsers } from "../Helper/HelperFunction";
import { useCalendarState, useCalendarActions } from "../Context/CalendarContext";
import { Box } from "@mui/material";
import SideBar from "./SideBar/SideBar";
import Calendar from "./Calendar/calendar.jsx";
import '../styles/styles.css';

export default function CalendarContainer() {
  const { selectedDate } = useCalendarState();
  const { fetchStart, fetchSuccess, fetchError, setHosts, setRoles, setUserGroups } = useCalendarActions();
 
  // Initial bootstrap: users, groups, initial records (today)
  const initAndFetch = useCallback(async () => {
    try {
      fetchStart();

      const usersResp = await getUsers();
      const normalized = normalizeZohoUsers(usersResp);
      const normalizedHosts = normalized?.hosts || [];
      const normalizedRoles = normalized?.roles || [];
      setHosts(normalizedHosts);
      setRoles(normalizedRoles);
      
      const groups = await getUserGroups();
      // console.log('fetched groups', groups);
      setUserGroups(groups || []);
getFields()
      // Initial records: today
      const initialRecords = await searchRecords(new Date());
      fetchSuccess(Array.isArray(initialRecords) ? initialRecords : []);
    } catch (err) {
      fetchError(err?.message || "Failed to initialize calendar");
    }
  }, [fetchStart, fetchSuccess, fetchError, setHosts, setRoles, setUserGroups]); 

  // Zoho embedded init + first fetch (only once)
  useEffect(() => {
  let canceled = false;

  const bootstrap = async () => {
    if (canceled) return;
    await initAndFetch();
  };

  // In Zoho container
  if (window?.ZOHO?.embeddedApp) {
    const app = window.ZOHO.embeddedApp;

    // guard: some builds expose `off`, some don't
    const handler = async (data) => {
      if (canceled) return;
      // You can inspect `data` if needed: entity, id, etc.
      await bootstrap();
    };

    try {
      // register BEFORE init()
      app.on("PageLoad", handler);

      // init and add a fallback if PageLoad never fires
      app.init().then(() => {
        // If PageLoad doesn't come within 1s, bootstrap anyway
        const t = setTimeout(() => {
          if (!canceled) bootstrap();
        }, 1000);
        // clear if we DO get PageLoad
        app.on("PageLoad", () => clearTimeout(t));
      });
    } catch (e) {
      // If anything goes wrong, just bootstrap
      console.warn("ZOHO init/on failed, bootstrapping directly:", e);
      bootstrap();
    }

    return () => {
      canceled = true;
      // clean up listener if available
      if (typeof app.off === "function") {
        try { app.off("PageLoad", handler); } catch {}
      }
    };
  }

  // Local dev / not embedded: just run it once
  bootstrap();

  return () => { canceled = true; };
}, [initAndFetch]);


  // Re-fetch records whenever selectedDate changes
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        fetchStart();
        const data = await searchRecords(selectedDate);
        if (!cancelled) fetchSuccess(Array.isArray(data) ? data : []);
      } catch (err) {
        if (!cancelled) fetchError(err?.message || "Could not load meetings");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedDate, fetchStart, fetchSuccess, fetchError]);

  return (
    <Box className="mainContainer">
      <Calendar/>
      <SideBar/>
    </Box>
  );
}
