// // MeetingForm.jsx
// import React from "react";
// import { Box, TextField, MenuItem, IconButton, Tooltip } from "@mui/material";
// import SearchIcon from "@mui/icons-material/Search";
// import GroupAddIcon from "@mui/icons-material/GroupAdd";
// import { useCalendarActions } from "../../Context/CalendarContext";
// import { getModuleList } from "../../Apis/zohoApi";
// export default function MeetingForm({
//   mode = "create",
//   hostsList = [],
//   value,
//   onChange,
// }) {
//   const {
//     openLookup,
//     openParticipants,
//   } = useCalendarActions();

//   // Field helpers
//   const set = (k, v) => onChange?.({ [k]: v });

//   const openRelatedLookup = () => {
//     const { relatedType, selectedOtherModule } = value || {};
//     if (relatedType === "Others" && selectedOtherModule?.api_name) {
//       openLookup({
//         module: selectedOtherModule.api_name,
//         titleLabel: selectedOtherModule.singular_label || selectedOtherModule.api_name,
//         target: "relatedRecord",
//       });
//     } else if (relatedType === "Leads" || relatedType === "Contacts") {
//       openLookup({
//         module: relatedType,
//         titleLabel: relatedType === "Leads" ? "Choose Lead" : "Choose Contact",
//         target: "relatedRecord",
//       });
//     }
//   };

//   const openPeoplePicker = () => openParticipants();

//   return (
//     <Box display="flex" flexDirection="column" gap={2}>
//       {/* --------- SUBJECT --------- */}
//       <TextField
//         label="Subject"
//         fullWidth
//         value={value?.subject ?? ""}
//         onChange={(e) => set("subject", e.target.value)}
//       />

//       {/* --------- HOST --------- */}
//       <TextField
//         select
//         label="Host"
//         value={value?.hostId ?? ""}
//         onChange={(e) => set("hostId", e.target.value)}
//       >
//         {hostsList.map((h) => (
//           <MenuItem key={h.id} value={h.id}>{h.name}</MenuItem>
//         ))}
//       </TextField>

//       {/* --------- DATES/TIMES (keep your own pickers/styles here) ---------
//            Replace inputs with your pickers but wire like:
//              value={value?.startDateTime}
//              onChange={(newVal) => set("startDateTime", newVal)}
//              value={value?.endDateTime}
//              onChange={(newVal) => set("endDateTime", newVal)}
//       */}
//       {/* YOUR EXISTING JSX FOR DATE/TIME PICKERS */}

//       {/* --------- RELATED TYPE + RECORD --------- */}
//       <Box display="flex" gap={1}>
//         <TextField
//           select
//           label="Related To"
//           value={value?.relatedType ?? "Leads"}
//           onChange={(e) => set("relatedType", e.target.value)}
//           sx={{ minWidth: 160 }}
//         >
//           <MenuItem value="Leads">Leads</MenuItem>
//           <MenuItem value="Contacts">Contacts</MenuItem>
//           <MenuItem value="Others">Others</MenuItem>
//         </TextField>

//         {value?.relatedType === "Others" && (
//           <TextField
//             select
//             label="Module"
//             value={value?.selectedOtherModule || ""}
//             onChange={(e) => set("selectedOtherModule", e.target.value)}
//             sx={{ minWidth: 240 }}
//             SelectProps={{
//               renderValue: (opt) =>
//                 opt?.singular_label ? `${opt.singular_label} (${opt.api_name})` : "",
//             }}
//           >
//             {/* If you already load module list in the parent, pass it down via value/props and map here.
//                 Or keep your existing Autocomplete UI; just call set('selectedOtherModule', chosenModule) */}
//             {moduleList.map(m => (
//               <MenuItem key={m.api_name} value={m}>
//                 {m.singular_label} ({m.api_name})
//               </MenuItem>
//             ))}
//           </TextField>
//         )}

//         <TextField
//           label={value?.relatedType === "Contacts" ? "Contact" : value?.relatedType === "Leads" ? "Lead" : "Record"}
//           value={value?.relatedRecord?.name || ""}
//           fullWidth
//           InputProps={{
//             endAdornment: (
//               <Tooltip title="Search & pick">
//                 <IconButton onClick={openRelatedLookup} size="small">
//                   <SearchIcon />
//                 </IconButton>
//               </Tooltip>
//             ),
//             readOnly: true,
//           }}
//         />
//       </Box>

//       {/* --------- PARTICIPANTS --------- */}
//       <TextField
//         label="Participants"
//         value={(value?.participants || []).map(p => p.email || p.name).join(", ")}
//         fullWidth
//         InputProps={{
//           endAdornment: (
//             <Tooltip title="Manage participants">
//               <IconButton onClick={openPeoplePicker} size="small">
//                 <GroupAddIcon />
//               </IconButton>
//             </Tooltip>
//           ),
//           readOnly: true,
//         }}
//       />

//       {/* --------- LOCATION / DESCRIPTION --------- */}
//       <TextField
//         label="Location"
//         fullWidth
//         value={value?.location ?? ""}
//         onChange={(e) => set("location", e.target.value)}
//       />
//       <TextField
//         label="Description"
//         fullWidth
//         multiline
//         minRows={3}
//         value={value?.description ?? ""}
//         onChange={(e) => set("description", e.target.value)}
//       />
//     </Box>
//   );
// }

// MeetingForm.jsx
import React from "react";
import { Box, TextField, MenuItem, IconButton, Tooltip } from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import GroupAddIcon from "@mui/icons-material/GroupAdd";
import { useCalendarActions, useCalendarState } from "../../Context/CalendarContext";

export default function MeetingForm({
  // Optional props for controlled usage (e.g., inside your current CreateMeeting)
  mode = "create",
  hostsList,        // optional override; falls back to context hosts
  value,            // optional controlled form value
  onChange,         // optional controlled form setter: onChange({ key: val })
  moduleList: moduleListProp, // optional override; falls back to context moduleList
}) {
  // ---- Context (used when props not supplied) ----
  const { meetingForm, hosts, moduleList } = useCalendarState();
  const { openLookup, openParticipants, patchMeetingForm } = useCalendarActions();

  // Model source: props first, otherwise context
  const model = value ?? meetingForm;
  const set = (k, v) => {
    if (onChange) onChange({ [k]: v });
    else patchMeetingForm({ [k]: v });
  };

  const effectiveHosts = hostsList ?? hosts;
  const effectiveModuleList = moduleListProp ?? moduleList;

  const openRelatedLookup = () => {
    const { relatedType, selectedOtherModule } = model || {};
    if (relatedType === "Others" && selectedOtherModule?.api_name) {
      openLookup({
        module: selectedOtherModule.api_name,
        titleLabel: selectedOtherModule.singular_label || selectedOtherModule.api_name,
        target: "relatedRecord",
      });
    } else if (relatedType === "Leads" || relatedType === "Contacts") {
      openLookup({
        module: relatedType,
        titleLabel: relatedType === "Leads" ? "Choose Lead" : "Choose Contact",
        target: "relatedRecord",
      });
    }
  };

  const openPeoplePicker = () => openParticipants();

  return (
    <Box display="flex" flexDirection="column" gap={2}>
      {/* --------- SUBJECT --------- */}
      <TextField
        label="Subject"
        fullWidth
        value={model?.subject ?? ""}
        onChange={(e) => set("subject", e.target.value)}
      />

      {/* --------- HOST --------- */}
      <TextField
        select
        label="Host"
        value={model?.hostId ?? ""}
        onChange={(e) => set("hostId", e.target.value)}
      >
        {(effectiveHosts || []).map((h) => (
          <MenuItem key={h.id} value={h.id}>
            {h.name}
          </MenuItem>
        ))}
      </TextField>

      {/* --------- DATES/TIMES (hook up your pickers here) ---------
           If you keep DatePicker/TimePicker outside, just wire these values.
           Example:
           value={model?.startDateTime}
           onChange={(newVal) => set("startDateTime", newVal)}
           value={model?.endDateTime}
           onChange={(newVal) => set("endDateTime", newVal)}
      */}

      {/* --------- RELATED TYPE + RECORD --------- */}
      <Box display="flex" gap={1}>
        <TextField
          select
          label="Related To"
          value={model?.relatedType ?? "Leads"}
          onChange={(e) => set("relatedType", e.target.value)}
          sx={{ minWidth: 160 }}
        >
          <MenuItem value="Leads">Leads</MenuItem>
          <MenuItem value="Contacts">Contacts</MenuItem>
          <MenuItem value="Others">Others</MenuItem>
        </TextField>

        {model?.relatedType === "Others" && (
          <TextField
            select
            label="Module"
            value={model?.selectedOtherModule || ""}
            onChange={(e) => set("selectedOtherModule", e.target.value)}
            sx={{ minWidth: 240 }}
            SelectProps={{
              renderValue: (opt) =>
                opt?.singular_label ? `${opt.singular_label} (${opt.api_name})` : "",
            }}
          >
            {(effectiveModuleList || []).map((m) => (
              <MenuItem key={m.api_name} value={m}>
                {m.singular_label} ({m.api_name})
              </MenuItem>
            ))}
          </TextField>
        )}

        <TextField
          label={
            model?.relatedType === "Contacts"
              ? "Contact"
              : model?.relatedType === "Leads"
              ? "Lead"
              : "Record"
          }
          value={model?.relatedRecord?.name || ""}
          fullWidth
          InputProps={{
            endAdornment: (
              <Tooltip title="Search & pick">
                <IconButton onClick={openRelatedLookup} size="small">
                  <SearchIcon />
                </IconButton>
              </Tooltip>
            ),
            readOnly: true,
          }}
        />
      </Box>

      {/* --------- PARTICIPANTS --------- */}
      <TextField
        label="Participants"
        value={(model?.participants || []).map((p) => p.email || p.name).join(", ")}
        fullWidth
        InputProps={{
          endAdornment: (
            <Tooltip title="Manage participants">
              <IconButton onClick={openPeoplePicker} size="small">
                <GroupAddIcon />
              </IconButton>
            </Tooltip>
          ),
          readOnly: true,
        }}
      />

      {/* --------- LOCATION / DESCRIPTION --------- */}
      <TextField
        label="Location"
        fullWidth
        value={model?.location ?? ""}
        onChange={(e) => set("location", e.target.value)}
      />
      <TextField
        label="Description"
        fullWidth
        multiline
        minRows={3}
        value={model?.description ?? ""}
        onChange={(e) => set("description", e.target.value)}
      />
    </Box>
  );
}
