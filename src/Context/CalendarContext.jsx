import React, { createContext, useContext, useReducer, useMemo, useCallback } from "react";

/* --------------------------- Initial State --------------------------- */

const initialState = {
  /* Core calendar */
  selectedDate: new Date(),
  zohoRecords: [],
  isLoading: false,
  errorMessage: null,

  /* Filters / people */
  hosts: [],
  roles: [],
  userGroups: [],
  selectedRoleNames: [],
  selectedUserNames: [],
  selectedGroupIds: [],

  /* Cached meta */
  moduleList: [], // [{ api_name, singular_label }]

  /* Create/Edit modal */
  isCreateOpen: false,
  modalMode: "create", // "create" | "edit"

  /* Reusable Meeting Form state (used by both create & edit) */
    meetingForm: {
    // core
   subject: "",
   description: "",
   location: "",
   subject: "",                // maps to Event_Title
   description: "",
   location: "",               // r.Venue
    // time
    startDateTime: null,        // Date or dayjs
    endDateTime: null,          // Date or dayjs
    // host / owner
    hostId: null,               // User id
    // related-to
    relatedType: "Leads",
    relatedRecord: null,
    selectedOtherModule: null,
    // attendees
    participants: [],
    // any seed injected when opening create (e.g., { userId })
    seed: null,
    // id used during edit
    editId: null,

   // ---- extra fields mirrored from record/event ----
   meetingVenue: "",           // r.Meeting_Venue__s
   color: "",                  // r.$colour_code
   Status: "PLANNED",          // r.Check_In_Status
   allDay: false,              // r.All_day
   appointmentType: "",        // r.Appointment_Type
   currency: "USD",            // r.Currency
   what_id: null,              // r.What_Id
   who_id: null,               // r.Who_Id
   se_module: "",              // r.$se_module
   remind_at: null,            // r.Remind_At
   created_by: null,           // r.Created_By
   modified_by: null,          // r.Modified_by
   owner: null,                // r.Owner
   created_time: null,         // r.Created_Time
   modified_time: null,        // r.Modified_time
  },


  /* Participants Modal */
  participantsModal: {
    open: false,
  },

  /* Record Lookup Modal (reusable) */
  recordLookup: {
    open: false,
    module: null,       // api_name
    titleLabel: null,   // optional friendly title
    // When a lookup is confirmed, we write to meetingForm.relatedRecord or caller-provided key.
    target: "relatedRecord", // which meetingForm key to populate on pick
  },

  rowHeight: 60, // px per hour
  appointmentTypes: [],
  appointmentTypeColor:[
    "#6db744", "#34b1b6", "#e0b917", "#7f469b", "#3474ba"
  ],
  appointmentTypeFilter: null,

  /* Pending Opportunity data - used when opening from Advance Scheduling */
  /* User first selects a timeslot, then modal opens with this data + selected time */
  pendingOpportunityData: null,
};

/* ------------------------------ Actions ----------------------------- */

const A = {
  // calendar navigation / data
  SET_SELECTED_DATE: "SET_SELECTED_DATE",
  FETCH_START: "FETCH_START",
  FETCH_SUCCESS: "FETCH_SUCCESS",
  FETCH_ERROR: "FETCH_ERROR",

  // meta / filters
  SET_HOSTS: "SET_HOSTS",
  SET_ROLES: "SET_ROLES",
  SET_USER_GROUPS: "SET_USER_GROUPS",
  SET_SELECTED_ROLE_NAMES: "SET_SELECTED_ROLE_NAMES",
  SET_SELECTED_USER_NAMES: "SET_SELECTED_USER_NAMES",
  SET_SELECTED_GROUP_IDS: "SET_SELECTED_GROUP_IDS",
  SET_MODULE_LIST: "SET_MODULE_LIST",
  SET_SHOWROOMS: "SET_SHOWROOMS",
  SET_SELECTED_SHOWROOMS: "SET_SELECTED_SHOWROOMS",

  // modals
  OPEN_CREATE: "OPEN_CREATE",
  OPEN_EDIT: "OPEN_EDIT",
  CLOSE_MODAL: "CLOSE_MODAL",

  // meeting form
  FORM_RESET: "FORM_RESET",
  FORM_PATCH: "FORM_PATCH", // payload: partial meetingForm
  FORM_SET_PARTICIPANTS: "FORM_SET_PARTICIPANTS",

  // participants modal
  OPEN_PARTICIPANTS: "OPEN_PARTICIPANTS",
  CLOSE_PARTICIPANTS: "CLOSE_PARTICIPANTS",

  // record lookup
  OPEN_LOOKUP: "OPEN_LOOKUP",   // payload: { module, titleLabel?, target? }
  CLOSE_LOOKUP: "CLOSE_LOOKUP",
  APPLY_LOOKUP: "APPLY_LOOKUP", // payload: { record } -> writes into meetingForm[target]

  //appointment types
  SET_APPOINTMENT_TYPES: "SET_APPOINTMENT_TYPES",
  SET_APPT_TYPE_FILTER: "SET_APPT_TYPE_FILTER",

  // Pending opportunity data (for Advance Scheduling flow)
  SET_PENDING_OPPORTUNITY: "SET_PENDING_OPPORTUNITY",
  CLEAR_PENDING_OPPORTUNITY: "CLEAR_PENDING_OPPORTUNITY",
};

/* ------------------------------ Reducer ----------------------------- */

function reducer(state, action) {
  switch (action.type) {
    /* calendar navigation / data */
    case A.SET_SELECTED_DATE:
      return { ...state, selectedDate: action.payload };

    case A.FETCH_START:
      return { ...state, isLoading: true, errorMessage: null };

    case A.FETCH_SUCCESS: {
      const payload = action.payload;

      console.log('success payload', action.payload)

      // If payload is a function, use it as an updater: prev => next
      if (typeof payload === "function") {
        console.log('updating records in function', {zohoRecords: payload(state.zohoRecords || [])})
        return {
          ...state,
          isLoading: false,
          zohoRecords: payload(state.zohoRecords || []),
        };
      }

      // Normal case: payload is an array of rows
      console.log('updating records', {zohoRecords: payload || []})

      return {

        ...state,
        isLoading: false,
        zohoRecords: payload || [],
      };
    }


    case A.FETCH_ERROR:
      return { ...state, isLoading: false, errorMessage: action.payload || "Error" };

    /* meta / filters */
    case A.SET_HOSTS:
      return { ...state, hosts: action.payload || [] };

    case A.SET_ROLES:
      return { ...state, roles: action.payload || [] };

    case A.SET_USER_GROUPS:
      return { ...state, userGroups: action.payload || [] };

    case A.SET_SELECTED_ROLE_NAMES:
      return { ...state, selectedRoleNames: action.payload || [] };

    case A.SET_SELECTED_USER_NAMES:
      return { ...state, selectedUserNames: action.payload || [] };

    case A.SET_SELECTED_GROUP_IDS:
      return { ...state, selectedGroupIds: action.payload || [] };

    case A.SET_MODULE_LIST:
      return { ...state, moduleList: Array.isArray(action.payload) ? action.payload : [] };

    case A.SET_SHOWROOMS:
      return {
        ...state,
        showrooms: Array.isArray(action.payload) ? action.payload : [],
      };

    case A.SET_SELECTED_SHOWROOMS:
      return {
        ...state,
        selectedShowrooms: Array.isArray(action.payload) ? action.payload : [],
      };
      
    /* modal: create / edit */
    case A.OPEN_CREATE: {
      const seed = action.payload || {};

      const nextForm = {
        ...initialState.meetingForm,
        ...seed,
        hostId:
          seed.hostId ??
          seed.userId ??
          initialState.meetingForm.hostId,
      };

      return {
        ...state,
        isCreateOpen: true,
        modalMode: "create",
        meetingForm: nextForm,
      };
    }


    case A.OPEN_EDIT: {
      console.log("OPEN_EDIT action payload:", action.payload);
      // payload: { editId, ...prefill }
      const init = action.payload || {};
      return {
        ...state,
        isCreateOpen: true,
        modalMode: "edit",
        meetingForm: {
          ...initialState.meetingForm,
          ...init,
          editId: init.editId ?? init.id ?? null,
        },
      };
    }

    case A.CLOSE_MODAL:
      return {
        ...state,
        isCreateOpen: false,
      };

    /* meeting form ops */
    case A.FORM_RESET:
      return { ...state, meetingForm: { ...initialState.meetingForm } };

    case A.FORM_PATCH:
      return { ...state, meetingForm: { ...state.meetingForm, ...(action.payload || {}) } };

    case A.FORM_SET_PARTICIPANTS:
      return { ...state, meetingForm: { ...state.meetingForm, participants: action.payload || [] } };

    /* participants modal */
    case A.OPEN_PARTICIPANTS:
      // console.log('opening modal')
      return { ...state, participantsModal: { open: true } };

    case A.CLOSE_PARTICIPANTS:
      return { ...state, participantsModal: { open: false } };

    /* record lookup modal */
    case A.OPEN_LOOKUP: {
      const { module, titleLabel = null, target = "relatedRecord" } = action.payload || {};
      return { ...state, recordLookup: { open: true, module, titleLabel, target } };
    }

    case A.CLOSE_LOOKUP:
      return { ...state, recordLookup: { ...state.recordLookup, open: false } };

    case A.APPLY_LOOKUP: {
      const { record } = action.payload || {};
      const target = state.recordLookup.target || "relatedRecord";
      return {
        ...state,
        recordLookup: { ...state.recordLookup, open: false },
        meetingForm: { ...state.meetingForm, [target]: record || null },
      };
    }

    case A.SET_APPOINTMENT_TYPES:
      return { ...state, appointmentTypes: Array.isArray(action.payload) ? action.payload : [] };

    case A.SET_APPT_TYPE_FILTER:
  return { ...state, appointmentTypeFilter: action.payload ?? null };

    case A.SET_PENDING_OPPORTUNITY:
      return { ...state, pendingOpportunityData: action.payload || null };

    case A.CLEAR_PENDING_OPPORTUNITY:
      return { ...state, pendingOpportunityData: null };

    default:
      return state;
  }
}

// Build an "event" from a raw Zoho record (one place, consistent)
export function buildEventFromRecord(r, getHostFromRecord) {
  // when available:
  const { hostId } = (getHostFromRecord?.(r) || {});
  const ownerId = r?.Owner?.id || hostId || null;

  return {
    id: r.id,
    userId: ownerId,
    title: r.Event_Title || "Meeting",
    start: r.Start_DateTime,       // ISO
    end: r.End_DateTime,           // ISO
    meetingVenue: r.Meeting_Venue__s || "",
    location: r.Venue || "",
    color: r.$colour_code || "",
    status: r.Check_In_Status || "PLANNED",
    allday: !!r.All_day,
    appointmentType: r.Appointment_Type || "",
    currency: r.Currency || "USD",
    participants: r.Participants || [],
    what_id: r.What_Id || null,
    who_id: r.Who_Id || null,
    se_module: r.$se_module || "",
    remind_at: r.Remind_At || null,
    created_by: r.Created_By || null,
    modified_by: r.Modified_by || null,
    owner: r.Owner || null,
    created_time: r.Created_Time || null,
    modified_time: r.Modified_time || null,
    r,
  };
}

// Convert an "event" into meetingForm patch (for OPEN_EDIT)
export function eventToMeetingForm(ev) {
  return {
    editId: ev.id,
    subject: ev.title || "",
    description: "",
    location: ev.location || "",
    startDateTime: ev.start ? new Date(ev.start) : null,
    endDateTime: ev.end ? new Date(ev.end) : null,
    hostId: ev.userId || null,
    repeat: ev?.recurring_Activity?.RRULE || 'Does not repeat', 
    relatedRecord: ev.what_id || null,
    meetingVenue: ev.meetingVenue || "",
    color: ev.color || "",
    status: ev.status || "PLANNED",
    allDay: !!ev.allday,
    appointmentType: ev.appointmentType || "",
    currency: ev.currency || "USD",
    participants: ev.participants || [],
    what_id: ev.what_id || null,
    who_id: ev.who_id || null,
    se_module: ev.se_module || "",
    remind_at: ev.remind_at || null,
    created_by: ev.created_by || null,
    modified_by: ev.modified_by || null,
    owner: ev.owner || null,
    created_time: ev.created_time || null,
    modified_time: ev.modified_time || null,
  };
}
/* --------------------------- Context Setup -------------------------- */

const CalendarStateContext = createContext(null);
const CalendarActionsContext = createContext(null);

export function CalendarProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  /* --------- Action creators (stable, memoized where helpful) -------- */

  // calendar
  const setSelectedDate = useCallback((date) => dispatch({ type: A.SET_SELECTED_DATE, payload: date }), []);
  const fetchStart = useCallback(() => dispatch({ type: A.FETCH_START }), []);
  const fetchSuccess = useCallback((rows) => dispatch({ type: A.FETCH_SUCCESS, payload: rows }), []);
  const fetchError = useCallback((msg) => dispatch({ type: A.FETCH_ERROR, payload: msg }), []);

  // meta
  const setHosts = useCallback((xs) => dispatch({ type: A.SET_HOSTS, payload: xs }), []);
  const setRoles = useCallback((xs) => dispatch({ type: A.SET_ROLES, payload: xs }), []);
  const setUserGroups = useCallback((xs) => dispatch({ type: A.SET_USER_GROUPS, payload: xs }), []);
  const setShowrooms = useCallback((xs) => dispatch({type: A.SET_SHOWROOMS, payload: xs}), []);
  const setSelectedRoleNames = useCallback((xs) => dispatch({ type: A.SET_SELECTED_ROLE_NAMES, payload: xs }), []);
  const setSelectedUserNames = useCallback((xs) => dispatch({ type: A.SET_SELECTED_USER_NAMES, payload: xs }), []);
  const setSelectedShowrooms = useCallback((xs) => dispatch({ type: A.SET_SELECTED_SHOWROOMS, payload: xs }), []);
  const setModuleList = useCallback((list) => dispatch({ type: A.SET_MODULE_LIST, payload: list }), []);
  const setSelectedGroupIds = useCallback((xs) => dispatch({ type: A.SET_SELECTED_GROUP_IDS, payload: xs }), []);
  // modals
  const openCreate = useCallback((seed = null) => dispatch({ type: A.OPEN_CREATE, payload: seed }), []);
  const openEdit = useCallback((prefill) => dispatch({ type: A.OPEN_EDIT, payload: prefill }), []);
  const closeModal = useCallback(() => dispatch({ type: A.CLOSE_MODAL }), []);

  // form
  const resetMeetingForm = useCallback(() => dispatch({ type: A.FORM_RESET }), []);
  const patchMeetingForm = useCallback((partial) => dispatch({ type: A.FORM_PATCH, payload: partial }), []);
  const setParticipants = useCallback((arr) => dispatch({ type: A.FORM_SET_PARTICIPANTS, payload: arr }), []);

  // participants modal
  const openParticipants = useCallback(() => dispatch({ type: A.OPEN_PARTICIPANTS }), []);
  const closeParticipants = useCallback(() => dispatch({ type: A.CLOSE_PARTICIPANTS }), []);

  // record lookup modal
  const openLookup = useCallback(
    ({ module, titleLabel = null, target = "relatedRecord" }) =>
      dispatch({ type: A.OPEN_LOOKUP, payload: { module, titleLabel, target } }),
    []
  );
  const closeLookup = useCallback(() => dispatch({ type: A.CLOSE_LOOKUP }), []);
  const applyLookup = useCallback((record) => dispatch({ type: A.APPLY_LOOKUP, payload: { record } }), []);

  // date-nav helpers kept for convenience (no UI change)
  const goToToday = useCallback(() => setSelectedDate(new Date()), [setSelectedDate]);
  const goToPreviousDay = useCallback(() => {
    const d = new Date(state.selectedDate);
    d.setDate(d.getDate() - 1);
    setSelectedDate(d);
  }, [state.selectedDate, setSelectedDate]);
  const goToNextDay = useCallback(() => {
    const d = new Date(state.selectedDate);
    d.setDate(d.getDate() + 1);
    setSelectedDate(d);
  }, [state.selectedDate, setSelectedDate]);
  
  const appointmentTypes = state.appointmentTypes;
  const setAppointmentTypes = useCallback((types) => {
    dispatch({ type: A.SET_APPOINTMENT_TYPES, payload: types });
  }, []);

  const setAppointmentTypeFilter = useCallback(
  (val) => dispatch({ type: A.SET_APPT_TYPE_FILTER, payload: val }),
  []
);

  // Pending opportunity data (for Advance Scheduling flow)
  const setPendingOpportunity = useCallback(
    (data) => dispatch({ type: A.SET_PENDING_OPPORTUNITY, payload: data }),
    []
  );
  const clearPendingOpportunity = useCallback(
    () => dispatch({ type: A.CLEAR_PENDING_OPPORTUNITY }),
    []
  );

  const actions = useMemo(
    () => ({
      // calendar
      setSelectedDate, goToToday, goToPreviousDay, goToNextDay,
      fetchStart, fetchSuccess, fetchError,
      // meta
      setHosts, setRoles, setUserGroups, setShowrooms, setSelectedRoleNames, setSelectedUserNames, setSelectedShowrooms, setSelectedGroupIds, setModuleList,
      // modals
      openCreate, openEdit, closeModal,
      // form
      resetMeetingForm, patchMeetingForm, setParticipants,
      // participants modal
      openParticipants, closeParticipants,
      // record lookup modal
      openLookup, closeLookup, applyLookup,
      // appointment types
      setAppointmentTypes,
      setAppointmentTypeFilter,
      // pending opportunity (Advance Scheduling)
      setPendingOpportunity,
      clearPendingOpportunity,
    }),
    [
      setSelectedDate, goToToday, goToPreviousDay, goToNextDay,
      fetchStart, fetchSuccess, fetchError,
      setHosts, setRoles, setUserGroups, setShowrooms, setSelectedRoleNames, setSelectedUserNames, setSelectedShowrooms, setSelectedGroupIds,setModuleList,
      openCreate, openEdit, closeModal,
      resetMeetingForm, patchMeetingForm, setParticipants,
      openParticipants, closeParticipants,
      openLookup, closeLookup, applyLookup, setAppointmentTypes, setAppointmentTypeFilter,
      setPendingOpportunity, clearPendingOpportunity,
    ]
  );

  return (
    <CalendarStateContext.Provider value={state}>
      <CalendarActionsContext.Provider value={actions}>
        {children}
      </CalendarActionsContext.Provider>
    </CalendarStateContext.Provider>
  );
}

/* ----------------------------- Hooks ----------------------------- */

export function useCalendarState() {
  const ctx = useContext(CalendarStateContext);
  if (!ctx) throw new Error("useCalendarState must be used within CalendarProvider");
  return ctx;
}

export function useCalendarActions() {
  const ctx = useContext(CalendarActionsContext);
  if (!ctx) throw new Error("useCalendarActions must be used within CalendarProvider");
  return ctx;
}
