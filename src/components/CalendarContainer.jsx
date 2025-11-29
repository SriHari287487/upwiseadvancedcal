import { useState, useEffect, useMemo, useCallback } from "react";
import { searchRecords, getUserGroups, getUsers, getFields, getRecord, setZohoSDKInitialized } from "../Apis/zohoApi";
import { normalizeZohoUsers } from "../Helper/HelperFunction";
import { useCalendarState, useCalendarActions } from "../Context/CalendarContext";
import { Box } from "@mui/material";
import SideBar from "./SideBar/SideBar";
import Calendar from "./Calendar/calendar.jsx";
import '../styles/styles.css';
import { fetchShowrooms } from '../Apis/zohoApi';
import { sendMeetingConfirmationSMS } from "../services/SMSService";

export default function CalendarContainer() {
  const { selectedDate } = useCalendarState();
  const {
    fetchStart,
    fetchSuccess,
    fetchError,
    setHosts,
    setRoles,
    setUserGroups,
    setShowrooms,
    setSelectedShowrooms,
    openCreate,
  } = useCalendarActions();

  // Initial bootstrap: users, groups, initial records (today)
  const initAndFetch = useCallback(async () => {
    try {
      fetchStart();

      const usersResp = await getUsers();
      const normalized = normalizeZohoUsers(usersResp);
      const normalizedHosts = normalized?.hosts || [];
      const normalizedRoles = normalized?.roles || [];
      const showroomData = await fetchShowrooms();
      setShowrooms(showroomData);
      setHosts(normalizedHosts);
      setRoles(normalizedRoles);

      const groups = await getUserGroups();
      setUserGroups(groups || []);
      getFields();

      const initialRecords = await searchRecords(new Date());
      fetchSuccess(Array.isArray(initialRecords) ? initialRecords : []);
    } catch (err) {
      fetchError(err?.message || "Failed to initialize calendar");
    }
  }, [
    fetchStart,
    fetchSuccess,
    fetchError,
    setHosts,
    setRoles,
    setShowrooms,
    setUserGroups,
  ]);

  // Zoho embedded init + first fetch (only once)
  useEffect(() => {
    let canceled = false;
    let hasOpenedModal = false; // Prevent double opening

    const bootstrap = async () => {
      if (canceled) return;
      await initAndFetch();
    };

    // Function to open the create modal with Opportunity data
    const openAdvanceSchedulingModal = async (entity, recordId) => {
      if (hasOpenedModal || !recordId) return;
      hasOpenedModal = true;

      console.log("Opening Advance Scheduling for:", { entity, recordId });

      try {
        // Fetch the opportunity/deal record
        const opptyResp = await ZOHO.CRM.API.getRecord({
          Entity: entity || "Potentials",
          RecordID: recordId,
        });

        const oppty = opptyResp?.data?.[0];
        console.log("Opportunity/Deal fetched:", oppty);

        if (!oppty) {
          console.warn("No opportunity data found");
          return;
        }

        // Get the current user as default host
        let currentUser = null;
        try {
          currentUser = await ZOHO.CRM.CONFIG.getCurrentUser();
          console.log("Current user:", currentUser);
        } catch (e) {
          console.warn("Could not get current user:", e);
        }

        // Extract contact info from the opportunity
        const contactId = oppty.Contact_Name?.id || oppty.Contact?.id || null;
        const contactName = oppty.Contact_Name?.name || oppty.Contact?.name || "";
        const contactPhone = oppty.Contact_Name?.phone || oppty.Contact?.phone || oppty.Phone || "";
        const contactEmail = oppty.Contact_Name?.email || oppty.Contact?.email || oppty.Email || "";

        // Extract account info  
        const accountName = oppty.Account_Name?.name || oppty.Account?.name || "";

        // Build the meeting title from Oppty/Deal name
        const meetingTitle = oppty.Deal_Name || oppty.Subject || oppty.Name || oppty.Potential_Name || "Appointment";

        // Get owner info
        const ownerId = oppty.Owner?.id || currentUser?.id || currentUser?.users?.[0]?.id;
        const ownerName = oppty.Owner?.name || currentUser?.full_name || currentUser?.users?.[0]?.full_name || "";
        const ownerEmail = oppty.Owner?.email || currentUser?.email || currentUser?.users?.[0]?.email || "";

        // Get showroom if available
        const showroomName = oppty.Showroom?.name || oppty.Showroom || "";

        // Build participants list
        const participants = [];
        if (contactId) {
          participants.push({
            id: contactId,
            participant: contactId,
            Full_name: contactName,
            Email: contactEmail,
            type: "contact",
          });
        }

        // Store the Opportunity data - modal will open when user selects a timeslot
        const pendingData = {
          // Meeting title from Deal/Opportunity name
          subject: `${meetingTitle}`,
          
          // Host/Owner
          hostId: ownerId,
          host: ownerId ? {
            id: ownerId,
            name: ownerName,
            email: ownerEmail,
          } : null,
          
          // Link to the Deal/Opportunity as Related Record
          relatedRecord: {
            id: recordId,
            module: entity || "Potentials",
            name: meetingTitle,
            raw: oppty,
          },
          relatedType: entity || "Deals",
          
          // Add contact as participant
          participants: participants,
          
          // Pre-fill venue based on showroom
          meetingVenue: showroomName ? "In-office" : "",
          
          // Store references for later use
          _opptyId: recordId,
          _opptyModule: entity || "Potentials",
          _contactId: contactId,
          _accountName: accountName,
        };

        console.log("Opening modal with Opportunity data:", pendingData);
        
        // Open the modal immediately with the Opportunity data
        openCreate(pendingData);

      } catch (err) {
        console.error("Advance Scheduling failed:", err);
        hasOpenedModal = false; // Allow retry on error
      }
    };

    if (window?.ZOHO?.embeddedApp) {
      const app = window.ZOHO.embeddedApp;

      // Handler for PageLoad event (for Related List / inline widgets)
      const pageLoadHandler = async (data) => {
        if (canceled) return;

        console.log("=== PageLoad Event ===");
        console.log("Raw data:", JSON.stringify(data, null, 2));

        const entity = data?.Entity || data?.entity;
        const recordId = data?.EntityId || data?.entityId;

        console.log("Extracted:", { entity, recordId });

        await bootstrap();

        const isOpportunityEntity = 
          entity === "Potentials" || 
          entity === "Deals" || 
          entity === "Opportunities";

        if (isOpportunityEntity && recordId && !hasOpenedModal) {
          console.log("Opening Advance Scheduling modal from PageLoad:", { entity, recordId });
          hasOpenedModal = true;
          setTimeout(() => {
            openAdvanceSchedulingModal(entity, recordId);
          }, 300);
        }
      };

      // Handler for Notify event (for Web Tab widgets via Client Script)
      const notifyHandler = async (data) => {
        if (canceled) return;

        console.log("=== Notify Event ===");
        console.log("Notify data:", JSON.stringify(data, null, 2));

        // Client Script can send: { Entity: "Potentials", EntityId: "123...", action: "schedule" }
        const entity = data?.Entity || data?.entity || data?.module;
        const recordId = data?.EntityId || data?.entityId || data?.id || data?.recordId;

        if (entity && recordId && !hasOpenedModal) {
          console.log("Opening Advance Scheduling modal from Notify:", { entity, recordId });
          hasOpenedModal = true;
          await bootstrap();
          setTimeout(() => {
            openAdvanceSchedulingModal(entity, recordId);
          }, 300);
        }
      };

      try {
        // Register event handlers BEFORE init (as per Zoho docs)
        app.on("PageLoad", pageLoadHandler);
        app.on("Notify", notifyHandler);
        
        console.log("Registered PageLoad and Notify event handlers");

        // Initialize the app
        app.init().then(async () => {
          console.log("ZOHO embeddedApp initialized successfully");
          setZohoSDKInitialized(true); // Mark SDK as ready for API calls
          
          // Bootstrap first
          await bootstrap();
          
          // Try multiple methods to get record context
          let entity = null;
          let recordId = null;
          
          // Method 1: Check URL params (try multiple parameter names)
          const urlParams = new URLSearchParams(window.location.search);
          entity = urlParams.get("Entity") || urlParams.get("entity") || urlParams.get("module");
          recordId = urlParams.get("EntityId") || urlParams.get("entityId") || urlParams.get("id") ||
                    urlParams.get("oppId") || urlParams.get("oppid") || urlParams.get("recordId") || 
                    urlParams.get("rid") || urlParams.get("Opportunity Id");
          
          console.log("URL params found:", Object.fromEntries(urlParams));
          
          // If we have oppId/oppid but no entity, assume it's Potentials
          if (!entity && recordId) {
            entity = "Potentials";
          }
          
          console.log("Method 1 - URL params:", { entity, recordId });
          
          // Method 2: Try ZOHO.CRM.CONFIG.getCurrentRecord
          if (!entity || !recordId) {
            try {
              const currentRecord = await ZOHO.CRM.CONFIG.getCurrentRecord();
              console.log("Method 2 - getCurrentRecord:", currentRecord);
              if (currentRecord?.Entity && currentRecord?.EntityId) {
                entity = currentRecord.Entity;
                recordId = currentRecord.EntityId?.[0] || currentRecord.EntityId;
              }
            } catch (e) {
              console.log("getCurrentRecord not available");
            }
          }
          
          // Method 3: Try ZOHO.CRM.UI.Record.getRecord (for popup widgets)
          if (!entity || !recordId) {
            try {
              const recordInfo = await ZOHO.CRM.UI?.Record?.getRecord?.();
              console.log("Method 3 - UI.Record.getRecord:", recordInfo);
              if (recordInfo?.Entity && recordInfo?.EntityId) {
                entity = recordInfo.Entity;
                recordId = recordInfo.EntityId;
              }
            } catch (e) {
              console.log("UI.Record.getRecord not available");
            }
          }
          
          // Method 4: Check document.referrer URL
          if (!entity || !recordId) {
            try {
              const referrer = document.referrer;
              console.log("Method 4 - document.referrer:", referrer);
              
              // Parse Zoho CRM URL patterns
              // Pattern 1: /crm/tab/Potentials/123456789
              // Pattern 2: /crm/org123/tab/Potentials/123456789
              // Pattern 3: /crm/EntityInfo.do?module=Potentials&id=123456789
              let match = referrer?.match(/\/crm\/(?:org\d+\/)?tab\/(\w+)\/(\d+)/);
              if (match) {
                entity = match[1];
                recordId = match[2];
              } else {
                // Try query string pattern
                const refUrl = new URL(referrer);
                entity = refUrl.searchParams.get("module") || entity;
                recordId = refUrl.searchParams.get("id") || recordId;
              }
              if (entity || recordId) {
                console.log("Extracted from referrer:", { entity, recordId });
              }
            } catch (e) {
              console.log("Could not parse referrer:", e.message);
            }
          }
          
          // Method 5: Try ZOHO.CRM.CONFIG methods
          if (!entity || !recordId) {
            console.log("Method 5 - Trying ZOHO.CRM.CONFIG methods...");
            try {
              // Try getOrgInfo
              const orgInfo = await ZOHO.CRM.CONFIG.getOrgInfo();
              console.log("  getOrgInfo:", orgInfo);
            } catch (e) {}
            
            try {
              // Try getCurrentUser
              const currentUser = await ZOHO.CRM.CONFIG.getCurrentUser();
              console.log("  getCurrentUser:", currentUser);
            } catch (e) {}
            
            try {
              // Try getContext - might have page context
              const context = await ZOHO.CRM.CONFIG?.getContext?.();
              console.log("  getContext:", context);
              if (context?.Entity && context?.EntityId) {
                entity = context.Entity;
                recordId = context.EntityId;
              }
            } catch (e) {}
          }
          
          // Method 6: Try ZOHO.CRM.UI methods for Web Tab context
          if (!entity || !recordId) {
            console.log("Method 6 - Trying ZOHO.CRM.UI methods...");
            try {
              const tabContext = await ZOHO.CRM.UI?.Tab?.getContext?.();
              console.log("  Tab.getContext:", tabContext);
              if (tabContext?.Entity && tabContext?.EntityId) {
                entity = tabContext.Entity;
                recordId = tabContext.EntityId;
              }
            } catch (e) {}
            
            try {
              const popupContext = await ZOHO.CRM.UI?.Popup?.getContext?.();
              console.log("  Popup.getContext:", popupContext);
              if (popupContext?.Entity && popupContext?.EntityId) {
                entity = popupContext.Entity;
                recordId = popupContext.EntityId;
              }
            } catch (e) {}
            
            try {
              const dialer = await ZOHO.CRM.UI?.Dialer?.getContext?.();
              console.log("  Dialer.getContext:", dialer);
            } catch (e) {}
          }
          
          // Method 7: Try ZOHO.CRM.META methods
          if (!entity || !recordId) {
            console.log("Method 7 - Trying ZOHO.CRM.META methods...");
            try {
              const pageContext = await ZOHO.CRM.META?.getPageContext?.();
              console.log("  META.getPageContext:", pageContext);
              if (pageContext?.Entity && pageContext?.EntityId) {
                entity = pageContext.Entity;
                recordId = pageContext.EntityId;
              }
            } catch (e) {}
          }
          
          // Method 8: Check sessionStorage (set by Client Script)
          if (!entity || !recordId) {
            console.log("Method 8 - Checking sessionStorage...");
            try {
              const storedEntity = sessionStorage.getItem("zoho_entity");
              const storedRecordId = sessionStorage.getItem("zoho_opportunity_id");
              
              console.log("  sessionStorage:", { storedEntity, storedRecordId });
              
              if (storedEntity && storedRecordId) {
                entity = storedEntity;
                recordId = storedRecordId;
                
                // Clear after reading (one-time use)
                sessionStorage.removeItem("zoho_entity");
                sessionStorage.removeItem("zoho_opportunity_id");
                
                console.log("  Got context from sessionStorage!");
              }
            } catch (e) {
              console.log("  sessionStorage error:", e.message);
            }
          }
          
          // Method 9: Check Zoho Org Variable (set by Deluge Function)
          if (!entity || !recordId) {
            console.log("Method 9 - Checking Zoho Org Variable...");
            try {
              const varResp = await ZOHO.CRM.API.getOrgVariable("pending_schedule_record");
              console.log("  Org variable response:", varResp);
              
              const varValue = varResp?.Success?.Content || varResp?.value || varResp;
              if (varValue && typeof varValue === 'string' && varValue.includes('|')) {
                const parts = varValue.split('|');
                entity = parts[0];
                recordId = parts[1];
                console.log("  Got context from Org Variable:", { entity, recordId });
                
                // Clear the variable after reading
                try {
                  await ZOHO.CRM.API.updateOrgVariable("pending_schedule_record", "");
                } catch (clearErr) {
                  console.log("  Could not clear org variable");
                }
              }
            } catch (e) {
              console.log("  Org variable error:", e.message);
            }
          }
          
          // Method 10: Check User Variables (set by Deluge Function) - BEST OPTION
          if (!entity || !recordId) {
            console.log("Method 10 - Checking User Variable...");
            try {
              const varResp = await ZOHO.CRM.API.getUserVariable({ name: "pending_schedule_record" });
              console.log("  User variable response:", varResp);
              
              const varValue = varResp?.Success?.content || varResp?.value || varResp?.Content;
              if (varValue && typeof varValue === 'string' && varValue.includes('|')) {
                const parts = varValue.split('|');
                entity = parts[0];
                recordId = parts[1];
                console.log("  Got context from User Variable:", { entity, recordId });
                
                // Clear the variable after reading (one-time use)
                try {
                  await ZOHO.CRM.API.setUserVariable({ name: "pending_schedule_record", value: "" });
                  console.log("  Cleared User Variable");
                } catch (clearErr) {
                  console.log("  Could not clear user variable:", clearErr.message);
                }
              }
            } catch (e) {
              console.log("  User variable error:", e.message);
            }
          }
          
          // Method 11: Check User's custom field (set by Deluge Function) - FALLBACK
          if (!entity || !recordId) {
            console.log("Method 11 - Checking User's Pending_Schedule_Record field...");
            try {
              // Get current user
              const currentUser = await ZOHO.CRM.CONFIG.getCurrentUser();
              const userId = currentUser?.users?.[0]?.id || currentUser?.id;
              
              if (userId) {
                // Fetch the user record with the custom field
                const userRecord = await ZOHO.CRM.API.getRecord({
                  Entity: "users",
                  RecordID: userId,
                });
                
                console.log("  User record:", userRecord);
                
                const pendingValue = userRecord?.users?.[0]?.Pending_Schedule_Record || 
                                     userRecord?.data?.[0]?.Pending_Schedule_Record;
                
                console.log("  Pending_Schedule_Record:", pendingValue);
                
                if (pendingValue && typeof pendingValue === 'string' && pendingValue.includes('|')) {
                  const parts = pendingValue.split('|');
                  entity = parts[0];
                  recordId = parts[1];
                  console.log("  Got context from User field:", { entity, recordId });
                  
                  // Clear the field after reading (one-time use)
                  try {
                    await ZOHO.CRM.API.updateRecord({
                      Entity: "users",
                      RecordID: userId,
                      APIData: {
                        id: userId,
                        Pending_Schedule_Record: "",
                      },
                    });
                    console.log("  Cleared Pending_Schedule_Record field");
                  } catch (clearErr) {
                    console.log("  Could not clear user field:", clearErr.message);
                  }
                }
              }
            } catch (e) {
              console.log("  User field error:", e.message);
            }
          }
          
          // Method 12: Check localStorage (set by Client Script) - BROWSER STORAGE
          if (!entity || !recordId) {
            console.log("Method 12 - Checking localStorage...");
            try {
              const storedData = localStorage.getItem("zoho_schedule_record");
              console.log("  localStorage value:", storedData);
              
              if (storedData && storedData.includes('|')) {
                const parts = storedData.split('|');
                entity = parts[0];
                recordId = parts[1];
                console.log("  Got context from localStorage:", { entity, recordId });
                
                // Clear after reading
                localStorage.removeItem("zoho_schedule_record");
              }
            } catch (e) {
              console.log("  localStorage error:", e.message);
            }
          }
          
          console.log("Final context:", { entity, recordId });
          
          // Open modal if we have an opportunity context
          const isOpportunityEntity = entity === "Potentials" || entity === "Deals" || entity === "Opportunities";
          
          if (isOpportunityEntity && recordId && !hasOpenedModal) {
            console.log("Opening Advance Scheduling modal:", { entity, recordId });
            openAdvanceSchedulingModal(entity, recordId);
          }
        }).catch((err) => {
          console.warn("ZOHO init failed:", err);
          bootstrap();
        });

      } catch (e) {
        console.warn("ZOHO init/on failed, bootstrapping directly:", e);
        bootstrap();
      }

      return () => {
        canceled = true;
        if (typeof app.off === "function") {
          try {
            app.off("PageLoad", handler);
          } catch {}
        }
      };
    } else {
      // Local dev / not embedded: check URL params and bootstrap
      const urlParams = new URLSearchParams(window.location.search);
      let entityFromUrl = urlParams.get("Entity") || urlParams.get("entity") || urlParams.get("module");
      let recordIdFromUrl = urlParams.get("EntityId") || urlParams.get("entityId") || urlParams.get("id") ||
                           urlParams.get("oppId") || urlParams.get("oppid") || urlParams.get("recordId") ||
                           urlParams.get("rid");

      // If we have oppId but no entity, assume it's Potentials
      if (!entityFromUrl && recordIdFromUrl) {
        entityFromUrl = "Potentials";
      }

      bootstrap().then(() => {
        if (entityFromUrl && recordIdFromUrl) {
          // For local testing with URL params
          console.log("Local dev: opening modal from URL params", { entityFromUrl, recordIdFromUrl });
          // Note: This won't work in local dev without Zoho SDK, but logs for debugging
        }
      });
    }

    return () => {
      canceled = true;
    };
  }, [initAndFetch, openCreate]);

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
      <Calendar />
      <SideBar />
    </Box>
  );
}
