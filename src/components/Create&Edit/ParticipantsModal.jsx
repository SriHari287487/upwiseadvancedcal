// import React, { useEffect, useMemo, useState } from "react";
// import {
//   Avatar,
//   Box,
//   Button,
//   Checkbox,
//   Dialog,
//   DialogActions,
//   DialogContent,
//   DialogTitle,
//   Divider,
//   IconButton,
//   InputBase,
//   List,
//   ListItem,
//   ListItemAvatar,
//   ListItemSecondaryAction,
//   ListItemText,
//   MenuItem,
//   Paper,
//   Select,
//   Typography,
// } from "@mui/material";
// import CloseIcon from "@mui/icons-material/Close";
// import PersonIcon from "@mui/icons-material/Person";
// import { useCalendarActions, useCalendarState } from "../../Context/CalendarContext";
// import { getModuleList, fetchAllRecords } from "../../Apis/zohoApi";

// const getSingularTypeFromModule = (apiName, moduleList) => {
//   if (!apiName) return "";

//   // Try to use singular_label from Zoho metadata if available
//   const mod = (moduleList || []).find((m) => m.api_name === apiName);
//   if (mod?.singular_label) return mod.singular_label;

//   // Fallback: naive singularizer (remove trailing "s")
//   return apiName.endsWith("s") ? apiName.slice(0, -1) : apiName;
// };

// export default function ParticipantsModal({ open }) {
//   const soft = "#9AA2B3";

//   // context
//   const { moduleList, meetingForm } = useCalendarState();
//   const { setModuleList, setParticipants, closeParticipants } = useCalendarActions();

//   // UI/local state
//   const [module, setModule] = useState("Leads");
//   const [records, setRecords] = useState([]);
//   const [loading, setLoading] = useState(false);
//   const [search, setSearch] = useState("");

//   // persist selections across modules
//   const [selectedByModule, setSelectedByModule] = useState({});
//   const [selectedMap, setSelectedMap] = useState(new Map());

//   // helpers to read record fields
//   const idOf = (r) => r.id || r.ID || r._id || r._ID;
//   const emailOf = (r) =>
//     r.Email || r.email || r.Secondary_Email || r.secondary_email || "";
//   const fullNameOf = (r) => {
//     const fn =
//       r.Full_Name ||
//       r.Full_name ||
//       r["Full Name"] ||
//       r.full_name ||
//       [r.First_Name || r.first_name || "", r.Last_Name || r.last_name || ""]
//         .filter(Boolean)
//         .join(" ") ||
//       r.Name ||
//       r.name ||
//       "";
//     return fn.trim();
//   };

//   /* ---------------- init on open ---------------- */
//   useEffect(() => {
//     if (!open) return;

//     let cancelled = false;

//     const init = async () => {
//       try {
//         if (!Array.isArray(moduleList) || moduleList.length === 0) {
//           const mods = await getModuleList();
//           if (!cancelled) setModuleList(mods || []);
//         }
//       } catch {}

//       if (!cancelled) {
//         setModule((prev) => prev || "Leads");
//         setSearch("");
//       }

//       // initial records (Leads)
//       if (!cancelled) {
//         setLoading(true);
//         try {
//           const res = await fetchAllRecords("Leads", 1, 200);
//           const rows = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
//           if (!cancelled) setRecords(rows);
//         } catch {
//           if (!cancelled) setRecords([]);
//         } finally {
//           if (!cancelled) setLoading(false);
//         }
//       }
//     };

//     init();
//     return () => {
//       cancelled = true;
//     };
//   }, [open, moduleList, setModuleList]);

//   /* -------- sync selections from meetingForm.participants -------- */
//   useEffect(() => {
//   if (!open) return;

//   const existing = Array.isArray(meetingForm?.participants)
//     ? meetingForm.participants
//     : [];

//   const map = new Map();
//   const byMod = {};

//   for (const p of existing) {
//     if (!p || !p.id || !p.type) continue;

//     // p.type is singular ("Lead", "Contact", ...) now
//     const key = `${p.type}:${p.id}`;
//     map.set(key, p);

//     // figure out which module api_name this participant belongs to
//     const mod = (moduleList || []).find(
//       (m) => m.api_name === p.type || m.singular_label === p.type
//     );
//     const moduleKey = mod?.api_name || p.type;

//     if (!byMod[moduleKey]) byMod[moduleKey] = new Set();
//     byMod[moduleKey].add(p.id);
//   }

//   setSelectedMap(map);
//   setSelectedByModule(byMod);
// }, [open, meetingForm?.participants, moduleList]);

//   /* ---------------- when module changes, fetch its records ---------------- */
//   useEffect(() => {
//     if (!open || !module) return;
//     let cancelled = false;

//     const load = async () => {
//       setLoading(true);
//       try {
//         const res = await fetchAllRecords(module, 1, 200);
//         const rows = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
//         if (!cancelled) setRecords(rows);
//       } catch {
//         if (!cancelled) setRecords([]);
//       } finally {
//         if (!cancelled) setLoading(false);
//       }
//     };

//     load();
//     return () => {
//       cancelled = true;
//     };
//   }, [open, module]);

//   /* ---------------- filtered list ---------------- */
//   const filtered = useMemo(() => {
//     const q = search.trim().toLowerCase();
//     if (!q) return records;
//     return records.filter((r) => {
//       const name = fullNameOf(r).toLowerCase();
//       const em = (emailOf(r) || "").toLowerCase();
//       return name.includes(q) || em.includes(q);
//     });
//   }, [records, search]);

//   const currentSet = selectedByModule[module] || new Set();

//   /* ---------------- toggle & unselect ---------------- */
//   const toggle = (rec) => {
//   const id = idOf(rec);
//   if (!id) return;

//   // 🔹 type must be singular api name / label
//   const type = getSingularTypeFromModule(module, moduleList).toLowerCase();
//   const key = `${type}:${id}`;

//   const participant = {
//     participant: id,
//     Full_name: fullNameOf(rec) || "",
//     email: emailOf(rec) || "",
//     type, // 🔹 singular type stored here
//   };

//   // keep selection per module (still use module api_name as key)
//   setSelectedByModule((prev) => {
//     const next = { ...prev };
//     const s = new Set(prev[module] || []);
//     if (s.has(id)) s.delete(id);
//     else s.add(id);
//     next[module] = s;
//     return next;
//   });

//   // global map keyed by singular type + id
//   setSelectedMap((prev) => {
//     const next = new Map(prev);
//     if (next.has(key)) next.delete(key);
//     else next.set(key, participant);
//     return next;
//   });
// };


//   const unselect = (rec) => {
//     const id = idOf(rec);
//     if (!id) return;
//     const key = `${module}:${id}`;

//     setSelectedByModule((prev) => {
//       const next = { ...prev };
//       const s = new Set(prev[module] || []);
//       s.delete(id);
//       next[module] = s;
//       return next;
//     });

//     setSelectedMap((prev) => {
//       const next = new Map(prev);
//       next.delete(key);
//       return next;
//     });
//   };

//   /* ---------------- save & close ---------------- */
//   const handleSave = () => {
//     const chosen = Array.from(selectedMap.values());

//     const existing = Array.isArray(meetingForm?.participants)
//       ? meetingForm.participants
//       : [];
//     const key = (p) => `${p.type}:${p.id}`;
//     const seen = new Set(existing.map(key));
//     const merged = [...existing];

//     for (const p of chosen) {
//       if (!seen.has(key(p))) {
//         merged.push(p);
//         seen.add(key(p));
//       }
//     }

//     setParticipants(merged);
//     closeParticipants(); // ✅ actually close
//   };

//   return (
//     <Dialog
//       open={open}
//       onClose={closeParticipants}   // ✅ directly call closer
//       fullWidth
//       maxWidth="sm"
//       PaperProps={{ sx: { borderRadius: 3 } }}
//     >
//       <DialogTitle sx={{ px: 3, py: 3, borderBottom: "1px solid #F1F1F1" }}>
//         <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
//           <Typography sx={{ fontSize: 20, fontWeight: 600, color: soft, flex: 1 }}>
//             Add Participants
//           </Typography>

//           <Select
//             size="small"
//             value={module}
//             onChange={(e) => setModule(e.target.value)}
//             displayEmpty
//             sx={{
//               minWidth: 160,
//               height: 36,
//               color: soft,
//               fontSize: 14,
//               "& .MuiOutlinedInput-notchedOutline": { borderColor: soft, borderRadius: 2 },
//               "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: soft },
//               "&.Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: soft },
//             }}
//             MenuProps={{
//               disablePortal: true,
//               PaperProps: {
//                 sx: {
//                   maxHeight: 300,
//                   borderRadius: 2,
//                   overflowY: "auto",
//                   scrollbarWidth: "none",
//                   "&::-webkit-scrollbar": { display: "none" },
//                 },
//               },
//             }}
//           >
//             {(moduleList?.length
//               ? moduleList
//               : [{ api_name: "Leads", singular_label: "Leads" }]
//             ).map((m) => (
//               <MenuItem key={m.api_name} value={m.api_name}>
//                 {m.singular_label || m.api_name}
//               </MenuItem>
//             ))}
//           </Select>
//         </Box>
//       </DialogTitle>

//       <DialogContent sx={{ padding: "10px 20px" }}>
//         {/* Search bar */}
//         <Box sx={{ padding: "10px 0px", borderBottom: "1px solid #F1F1F1" }}>
//           <Paper
//             variant="outlined"
//             sx={{
//               display: "flex",
//               alignItems: "center",
//               gap: 1,
//               padding: "0px",
//               border: "none",
//             }}
//           >
//             <svg
//               width="24"
//               height="24"
//               viewBox="0 0 24 24"
//               fill="none"
//               xmlns="http://www.w3.org/2000/svg"
//             >
//               <path
//                 d="M11.5 21.75C5.85 21.75 1.25 17.15 1.25 11.5C1.25 5.85 5.85 1.25 11.5 1.25C17.15 1.25 21.75 5.85 21.75 11.5C21.75 17.15 17.15 21.75 11.5 21.75ZM11.5 2.75C6.67 2.75 2.75 6.68 2.75 11.5C2.75 16.32 6.67 20.25 11.5 20.25C16.33 20.25 20.25 16.32 20.25 11.5C20.25 6.68 16.33 2.75 11.5 2.75Z"
//                 fill="#9AA2B3"
//               />
//               <path
//                 d="M21.9999 22.7499C21.8099 22.7499 21.6199 22.6799 21.4699 22.5299L19.4699 20.5299C19.1799 20.2399 19.1799 19.7599 19.4699 19.4699C19.7599 19.1799 20.2399 19.1799 20.5299 19.4699L22.5299 21.4699C22.8199 21.7599 22.8199 22.2399 22.5299 22.5299C22.3799 22.6799 22.1899 22.7499 21.9999 22.7499Z"
//                 fill="#9AA2B3"
//               />
//             </svg>

//             <InputBase
//               placeholder="Search"
//               value={search}
//               onChange={(e) => setSearch(e.target.value)}
//               sx={{
//                 flex: 1,
//                 fontSize: 14,
//                 color: soft,
//                 "& input::placeholder": { color: soft, opacity: 1 },
//               }}
//             />
//           </Paper>
//         </Box>

//         {/* List */}
//         <List
//           disablePadding
//           sx={{
//             px: 0,
//             maxHeight: 400,
//             overflowY: "auto",
//             scrollbarWidth: "none",
//             "&::-webkit-scrollbar": { display: "none" },
//           }}
//         >
//           {loading && (
//             <Box sx={{ px: 3, py: 4, color: soft, borderBottom: "1px solid #F1F1F1" }}>
//               <Typography align="center">Loading…</Typography>
//             </Box>
//           )}

//           {!loading &&
//             filtered.map((r, i) => {
//               const id = idOf(r) || `row-${i}`;
//               const name = fullNameOf(r) || "—";
//               const checked = currentSet.has(id);
//               return (
//                 <React.Fragment key={id}>
//                   <ListItem sx={{ padding: "10px 0px", borderBottom: "1px solid #F1F1F1" }}>
//                     <Checkbox
//                       checked={checked}
//                       onChange={() => toggle(r)}
//                       sx={{
//                         mr: 1,
//                         color: soft,
//                         "&.Mui-checked": { color: soft },
//                         paddingLeft: "0px",
//                       }}
//                     />
//                     <ListItemAvatar sx={{ minWidth: 40 }}>
//                       <Avatar sx={{ bgcolor: soft, width: 32, height: 32 }}>
//                         <PersonIcon sx={{ fontSize: 18, color: "#F5F7FB" }} />
//                       </Avatar>
//                     </ListItemAvatar>
//                     <ListItemText
//                       primary={name}
//                       secondary={emailOf(r) || null}
//                       primaryTypographyProps={{
//                         noWrap: true,
//                         sx: { color: soft, fontSize: 16, fontWeight: 500 },
//                       }}
//                       secondaryTypographyProps={{
//                         noWrap: true,
//                         sx: { color: soft, fontSize: 12, opacity: 0.9 },
//                       }}
//                     />
//                     <ListItemSecondaryAction>
//                       {checked && (
//                         <IconButton onClick={() => unselect(r)} sx={{ color: soft }}>
//                           <CloseIcon fontSize="small" />
//                         </IconButton>
//                       )}
//                     </ListItemSecondaryAction>
//                   </ListItem>
//                 </React.Fragment>
//               );
//             })}

//           {!loading && filtered.length === 0 && (
//             <>
//               <Divider component="li" sx={{ borderColor: "#E6E8EF" }} />
//               <Box sx={{ px: 3, py: 4, color: soft }}>
//                 <Typography>No records</Typography>
//               </Box>
//             </>
//           )}
//         </List>
//       </DialogContent>

//       <DialogActions sx={{ px: 3, py: 2 }}>
//         <Button onClick={closeParticipants} sx={{ color: soft, textTransform: "none" }}>
//           Cancel
//         </Button>
//         <Button
//           variant="contained"
//           onClick={handleSave}
//           sx={{ textTransform: "none", borderRadius: 2 }}
//         >
//           Add Participants
//         </Button>
//       </DialogActions>
//     </Dialog>
//   );
// }

import React, { useEffect, useMemo, useState } from "react";
import {
  Avatar,
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  InputBase,
  List,
  ListItem,
  ListItemAvatar,
  ListItemSecondaryAction,
  ListItemText,
  MenuItem,
  Paper,
  Select,
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import PersonIcon from "@mui/icons-material/Person";
import {
  useCalendarActions,
  useCalendarState,
} from "../../Context/CalendarContext";
import {
  fetchAllRecords,
  searchModuleRecords,
  getUsers,
  getUserGroups,
} from "../../Apis/zohoApi";

/* ---------------------------------------------------------
   Static module options
   --------------------------------------------------------- */
const MODULE_OPTIONS = [
  { value: "Leads", label: "Leads" },
  { value: "Contacts", label: "Contacts" },
  { value: "Users", label: "Users" },
  { value: "Groups", label: "Groups" },
];

const soft = "#9AA2B3";

/* ---------------------------------------------------------
   Helpers
   --------------------------------------------------------- */
const singularTypeForModule = (module) => {
  switch ((module || "").toLowerCase()) {
    case "leads":
      return "lead";
    case "contacts":
      return "contact";
    case "users":
      return "user";
    case "groups":
      return "group";
    default:
      return (module || "").toLowerCase();
  }
};

const moduleForType = (type) => {
  switch ((type || "").toLowerCase()) {
    case "lead":
      return "Leads";
    case "contact":
      return "Contacts";
    case "user":
      return "Users";
    case "group":
      return "Groups";
    default:
      return "Leads";
  }
};

const idOf = (r) => r.id || r.ID || r._id || r._ID;

const emailOf = (r) =>
  r.Email ||
  r.email ||
  r.user_email ||
  r.Secondary_Email ||
  r.secondary_email ||
  "";

const fullNameOf = (r) => {
  const fn =
    r.Full_Name ||
    r.Full_name ||
    r["Full Name"] ||
    r.full_name ||
    [r.First_Name || "", r.Last_Name || ""]
      .filter(Boolean)
      .join(" ") ||
    r.Name ||
    r.name ||
    "";
  return fn.trim();
};

export default function ParticipantsModal({ open }) {
  const {
    meetingForm,
    hosts = [],
    userGroups = [],
  } = useCalendarState();
  const { setParticipants, closeParticipants } = useCalendarActions();

  const [module, setModule] = useState("Leads");
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  const [selectedByModule, setSelectedByModule] = useState({});
  const [selectedMap, setSelectedMap] = useState(new Map());

  /* ---------------------------------------------------------
     Init on open
     --------------------------------------------------------- */
  useEffect(() => {
    if (!open) return;
    setModule("Leads");
    setSearch("");
  }, [open]);

  /* ---------------------------------------------------------
     Sync selected from meetingForm.participants
     --------------------------------------------------------- */
  useEffect(() => {
    if (!open) return;

    const existing = Array.isArray(meetingForm?.participants)
      ? meetingForm.participants
      : [];

    const map = new Map();
    const byMod = {};

    for (const p of existing) {
      if (!p || (!p.id && !p.participant) || !p.type) continue;

      const pid = p.id || p.participant;
      const type = p.type;
      const key = `${type}:${pid}`;

      map.set(key, p);

      const moduleKey = moduleForType(type);
      if (!byMod[moduleKey]) byMod[moduleKey] = new Set();
      byMod[moduleKey].add(pid);
    }

    setSelectedMap(map);
    setSelectedByModule(byMod);
  }, [open, meetingForm?.participants]);

  const currentSet = selectedByModule[module] || new Set();

  /* ---------------------------------------------------------
     Unified loader for each module + search
     - CRM modules (Leads/Contacts): server search
     - Users/Groups: use context, fetch if empty, then client filter
     --------------------------------------------------------- */
  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    const q = search.trim();
    const qLower = q.toLowerCase();

    const load = async () => {
      setLoading(true);
      try {
        // ---- Users / Groups from context / APIs ----
        if (module === "Users" || module === "Groups") {
          let base = [];

          if (module === "Users") {
            if (hosts && hosts.length) {
              base = hosts;
            } else {
              const remote = await getUsers();
              base = Array.isArray(remote) ? remote : [];
            }
          } else {
            if (userGroups && userGroups.length) {
              base = userGroups;
            } else {
              const remote = await getUserGroups();
              base = Array.isArray(remote) ? remote : [];
            }
          }

          const filtered =
            q.length >= 4
              ? base.filter((r) => {
                  const n = fullNameOf(r).toLowerCase();
                  const em = (emailOf(r) || "").toLowerCase();
                  return n.includes(qLower) || em.includes(qLower);
                })
              : base;

          if (!cancelled) setRecords(filtered || []);
          return;
        }

        // ---- CRM modules: Leads / Contacts ----
        if (q.length >= 4) {
          // search mode
          const rows = await searchModuleRecords(module, q);
          if (!cancelled) setRecords(rows || []);
        } else {
          // show all
          const res = await fetchAllRecords(module, 1, 200);
          const rows = Array.isArray(res?.data)
            ? res.data
            : Array.isArray(res)
            ? res
            : [];
          if (!cancelled) setRecords(rows || []);
        }
      } catch (err) {
        console.error("ParticipantsModal load error:", err);
        if (!cancelled) setRecords([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    // debounce for smoother typing
    const id = setTimeout(load, 400);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [open, module, search, hosts, userGroups]);

  /* ---------------------------------------------------------
     Toggle select / unselect
     --------------------------------------------------------- */
  const toggle = (rec) => {
    const id = idOf(rec);
    if (!id) return;

    const type = singularTypeForModule(module);
    const key = `${type}:${id}`;

    const participant = {
      id,
      participant: id,
      Full_name: fullNameOf(rec) || "",
      email: emailOf(rec) || "",
      type,
    };

    setSelectedByModule((prev) => {
      const next = { ...prev };
      const s = new Set(prev[module] || []);
      if (s.has(id)) s.delete(id);
      else s.add(id);
      next[module] = s;
      return next;
    });

    setSelectedMap((prev) => {
      const next = new Map(prev);
      if (next.has(key)) next.delete(key);
      else next.set(key, participant);
      return next;
    });
  };

  const unselect = (rec) => {
    const id = idOf(rec);
    if (!id) return;

    const type = singularTypeForModule(module);
    const key = `${type}:${id}`;

    setSelectedByModule((prev) => {
      const next = { ...prev };
      const s = new Set(prev[module] || []);
      s.delete(id);
      next[module] = s;
      return next;
    });

    setSelectedMap((prev) => {
      const next = new Map(prev);
      next.delete(key);
      return next;
    });
  };

  /* ---------------------------------------------------------
     Save
     --------------------------------------------------------- */
  const handleSave = () => {
    const chosen = Array.from(selectedMap.values());

    const existing = Array.isArray(meetingForm?.participants)
      ? meetingForm.participants
      : [];

    const key = (p) => `${p.type}:${p.id || p.participant}`;
    const seen = new Set(existing.map(key));
    const merged = [...existing];

    for (const p of chosen) {
      if (!seen.has(key(p))) {
        merged.push(p);
        seen.add(key(p));
      }
    }

    setParticipants(merged);
    closeParticipants();
  };

  /* ---------------------------------------------------------
     UI
     --------------------------------------------------------- */
  return (
    <Dialog
      open={open}
      onClose={closeParticipants}
      fullWidth
      maxWidth="sm"
      PaperProps={{ sx: { borderRadius: 3 } }}
    >
      <DialogTitle sx={{ px: 3, py: 3, borderBottom: "1px solid #F1F1F1" }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
          <Typography
            sx={{ fontSize: 20, fontWeight: 600, color: soft, flex: 1 }}
          >
            Add Participants
          </Typography>

          <Select
            size="small"
            value={module}
            onChange={(e) => setModule(e.target.value)}
            displayEmpty
            sx={{
              minWidth: 160,
              height: 36,
              color: soft,
              fontSize: 14,
              "& .MuiOutlinedInput-notchedOutline": {
                borderColor: soft,
                borderRadius: 2,
              },
            }}
          >
            {MODULE_OPTIONS.map((m) => (
              <MenuItem key={m.value} value={m.value}>
                {m.label}
              </MenuItem>
            ))}
          </Select>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ padding: "10px 20px" }}>
        {/* Search */}
        <Box
          sx={{ padding: "10px 0px", borderBottom: "1px solid #F1F1F1" }}
        >
          <Paper
            variant="outlined"
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1,
              padding: "0px",
              border: "none",
            }}
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M11.5 21.75C5.85 21.75 1.25 17.15 1.25 11.5C1.25 5.85 5.85 1.25 11.5 1.25C17.15 1.25 21.75 5.85 21.75 11.5C21.75 17.15 17.15 21.75 11.5 21.75ZM11.5 2.75C6.67 2.75 2.75 6.68 2.75 11.5C2.75 16.32 6.67 20.25 11.5 20.25C16.33 20.25 20.25 16.32 20.25 11.5C20.25 6.68 16.33 2.75 11.5 2.75Z"
                fill={soft}
              />
              <path
                d="M21.9999 22.7499C21.8099 22.7499 21.6199 22.6799 21.4699 22.5299L19.4699 20.5299C19.1799 20.2399 19.1799 19.7599 19.4699 19.4699C19.7599 19.1799 20.2399 19.1799 20.5299 19.4699L22.5299 21.4699C22.8199 21.7599 22.8199 22.2399 22.5299 22.5299C22.3799 22.6799 22.1899 22.7499 21.9999 22.7499Z"
                fill={soft}
              />
            </svg>

            <InputBase
              placeholder="Search (min 4 chars)…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              sx={{
                flex: 1,
                fontSize: 14,
                color: soft,
                "& input::placeholder": { color: soft, opacity: 1 },
              }}
            />
          </Paper>
        </Box>

        {/* Records */}
        <List
          disablePadding
          sx={{
            px: 0,
            maxHeight: 400,
            overflowY: "auto",
            scrollbarWidth: "none",
            "&::-webkit-scrollbar": { display: "none" },
          }}
        >
          {loading && (
            <Box sx={{ px: 3, py: 4, color: soft }}>
              <Typography align="center">Loading…</Typography>
            </Box>
          )}

          {!loading &&
            records.map((r) => {
              const id = idOf(r);
              const name = fullNameOf(r) || "—";
              const checked = currentSet.has(id);

              return (
                <ListItem
                  key={id}
                  sx={{
                    padding: "10px 0px",
                    borderBottom: "1px solid #F1F1F1",
                  }}
                >
                  <Checkbox
                    checked={checked}
                    onChange={() => toggle(r)}
                    sx={{
                      mr: 1,
                      color: soft,
                      "&.Mui-checked": { color: soft },
                    }}
                  />

                  <ListItemAvatar sx={{ minWidth: 40 }}>
                    <Avatar sx={{ bgcolor: soft, width: 32, height: 32 }}>
                      <PersonIcon
                        sx={{ fontSize: 18, color: "#F5F7FB" }}
                      />
                    </Avatar>
                  </ListItemAvatar>

                  <ListItemText
                    primary={name}
                    secondary={emailOf(r) || null}
                    primaryTypographyProps={{
                      noWrap: true,
                      sx: { color: soft, fontSize: 16, fontWeight: 500 },
                    }}
                    secondaryTypographyProps={{
                      noWrap: true,
                      sx: { color: soft, fontSize: 12 },
                    }}
                  />

                  <ListItemSecondaryAction>
                    {checked && (
                      <IconButton
                        onClick={() => unselect(r)}
                        sx={{ color: soft }}
                      >
                        <CloseIcon fontSize="small" />
                      </IconButton>
                    )}
                  </ListItemSecondaryAction>
                </ListItem>
              );
            })}

          {!loading && records.length === 0 && (
            <Box sx={{ px: 3, py: 4, color: soft }}>
              <Typography>No records found</Typography>
            </Box>
          )}
        </List>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={closeParticipants} sx={{ color: soft }}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleSave}
          sx={{ textTransform: "none", borderRadius: 2 }}
        >
          Add Participants
        </Button>
      </DialogActions>
    </Dialog>
  );
}
