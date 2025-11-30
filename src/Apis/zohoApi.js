import {pad , getLocalDayBounds, toZohoIsoWithColonOffset, touchesDay} from '../Helper/HelperFunction'

// Track if Zoho SDK is initialized
let zohoSDKInitialized = false;

export function setZohoSDKInitialized(value) {
  zohoSDKInitialized = value;
}

export function isZohoSDKReady() {
  return zohoSDKInitialized && typeof window?.ZOHO?.CRM?.API !== 'undefined';
}

// Wait for SDK to be ready (with timeout)
async function waitForSDK(timeout = 5000) {
  if (isZohoSDKReady()) return true;
  
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (isZohoSDKReady()) return true;
    await new Promise(r => setTimeout(r, 100));
  }
  return false;
}

export async function fetchAllRecords(modArg, page = 1, per_page = 200) {
  try {
    // Normalize input: string module or object with { module } / { Entity }
    const entity =
      typeof modArg === "string"
        ? modArg
        : (modArg && (modArg.module || modArg.Entity)) || "Deals";

    const response = await ZOHO.CRM.API.getAllRecords({
      Entity: entity,
      sort_order: "asc",
      page,
      per_page,
    });

    // Basic diagnostics
    // console.log("fetchAllRecords ->", { entity, page, per_page, response });

    const records = Array.isArray(response?.data) ? response.data : [];
    return records;
  } catch (err) {
    console.error("Error fetching records:", err);
    return [];
  }
}


export async function searchRecords(date = new Date()) {
  // Wait for SDK to be ready before making API calls
  const sdkReady = await waitForSDK(3000);
  if (!sdkReady) {
    console.warn("Zoho SDK not ready, returning empty results");
    return [];
  }

  const { start, end } = getLocalDayBounds(date);
  const startStr = toZohoIsoWithColonOffset(start);
  const endStr   = toZohoIsoWithColonOffset(end);

  const criteriaRaw = `(Start_DateTime:less_equal:${endStr})and(End_DateTime:greater_equal:${startStr})`;
  const criteria = encodeURIComponent(criteriaRaw);

  const module = "Events";
  const conn_name = "zohoadvancecalendar";
  const api_domain = "https://www.zohoapis.com";

  const url = `${api_domain}/crm/v8/${module}/search?criteria=${criteria}`;

  const req_data = {
    method: "GET",
    url,
  };

  try {
    const resp = await ZOHO.CRM.CONNECTION.invoke(conn_name, req_data);
    const rows = Array.isArray(resp?.details?.statusMessage?.data) ? resp.details.statusMessage.data : [];
    return rows;
  } catch (err) {
    console.warn("Zoho search error:", err);
    return [];
  }
}

// search records in any CRM module by name-like fields
export async function searchModuleRecords(module, searchTerm) {
  const raw = String(searchTerm || "").trim();
  if (!raw) return [];

  // sanitize characters that break criteria syntax
  let q = raw.replace(/[()]/g, "");       // remove parentheses
  q = q.replace(/,/g, "\\,");             // escape commas
  q = q.replace(/\\/g, "\\\\");           // escape backslash

  // Build VALID Zoho criteria
  const criteriaRaw =
    `((Full_Name:equals:${q})` +
    `or(Last_Name:equals:${q})` +
    `or(First_Name:equals:${q}))`; // ← FINAL CLOSING PAREN FIXED

  const criteria = encodeURIComponent(criteriaRaw);

  const conn_name = "zohoadvancecalendar";
  const api_domain = "https://www.zohoapis.com";

  const urlCriteria = `${api_domain}/crm/v8/${module}/search?criteria=${criteria}`;
  const urlWord = `${api_domain}/crm/v8/${module}/search?word=${encodeURIComponent(
    raw
  )}`;

  try {
    // Try CRITERIA search first
    const resp = await ZOHO.CRM.CONNECTION.invoke(conn_name, {
      method: "GET",
      url: urlCriteria,
    });

    const rows = Array.isArray(resp?.details?.statusMessage?.data)
      ? resp.details.statusMessage.data
      : [];

    // console.log("criteria search success:", resp);
    return rows;
  } catch (err) {
    console.error("Criteria search failed — falling back to word search:", err);
  }

  // FALLBACK: /search?word=<term>
  try {
    const resp2 = await ZOHO.CRM.CONNECTION.invoke(conn_name, {
      method: "GET",
      url: urlWord,
    });

    const rows2 = Array.isArray(resp2?.details?.statusMessage?.data)
      ? resp2.details.statusMessage.data
      : [];

    // console.log("word search success:", resp2);
    return rows2;
  } catch (err2) {
    console.error("Zoho word search error:", err2);
    return [];
  }
}

export async function createRecord(module, data) {
    try{
        const response = await ZOHO.CRM.API.insertRecord({
            Entity: 'Events',
            APIData: data,
            Trigger: ["workflow"]
        });
        // const res = await zrc.post('/crm/v8/Events', { data: [data] });

        // console.log('create res', res)
    //     const conn_name = "zohoadvancecalendar";
    // const api_domain = "https://www.zohoapis.com";

    // // const recordId = data.id;
    // const { id, ...fields } = data;

    // // v8: wrap in { data: [ { ... } ] }
    // const payload = { data: [data] };

    // console.log("Create Record payload typeof:", typeof payload, payload);

    // const req = {
    //   method: "POST",
    //   url: `${api_domain}/crm/v8/${module}`,
    //   param_type: 2, // send as body
    //   headers: {
    //     "Content-Type": "application/json",
    //   },
    //   body: JSON.stringify(payload), // 👈 send JSON string
    // };

    // const response = await ZOHO.CRM.CONNECTION.invoke(conn_name, req);
    // console.log("Create Record v8 response:", response);
        return response;
    }catch(err){
        console.error('Error creating record:', err);
    }
}

export async function getRecord(module, recordId) {
    try{
        const response = await ZOHO.CRM.API.getRecord({
            Entity: module,
            RecordID: recordId,
        });
        // console.log('get record response', response);
        return response;
    }catch(err){
        console.error('Error fetching record:', err);
    }   
}

export async function updateRecord(module, data) {
    try{

        const response = await ZOHO.CRM.API.updateRecord({
            Entity: 'Events',
            APIData: data,
        });
        return response;
    }catch(err){
        console.error('Error edit record:', err);
    }
}

// export async function updateRecord(module, data) {
//   try {
//     if (!data || !data.id) {
//       throw new Error("updateRecord: 'data.id' is required");
//     }

//     const conn_name = "zohoadvancecalendar";
//     const api_domain = "https://www.zohoapis.com";

//     const recordId = data.id;
//     const { id, ...fields } = data;

//     // v8: wrap in { data: [ { ... } ] }
//     const payload = { data: [fields] };

//     console.log("updateRecord payload typeof:", typeof payload, payload);

//     const req = {
//       method: "PUT",
//       url: `${api_domain}/crm/v8/${module}/${recordId}`,
//       param_type: 2, // send as body
//       headers: {
//         "Content-Type": "application/json",
//       },
//       body: JSON.stringify(payload), // 👈 send JSON string
//     };

//     const response = await ZOHO.CRM.CONNECTION.invoke(conn_name, req);
//     console.log("updateRecord v8 response:", response);

//     return response?.details?.statusMessage || response;
//   } catch (err) {
//     console.error("Error edit record:", err);
//     throw err;
//   }
// }

export async function deleteRecord(module, id){
  try{
    const res = await ZOHO.CRM.API.deleteRecord({Entity:'Events',RecordID: id})
    // console.log('delete response', res);

    return res;
  }
  catch(err){
    // console.log('error in deleteing record', err)
  }
}

export async function getFields(module = 'Events', data) {
    try{
        const response = await ZOHO.CRM.META.getFields({"Entity":module})
        return response;
    }catch(err){
        console.error('Error creating record:', err);
    }
}

// Cache for fields metadata (to avoid repeated API calls)
const fieldsMetaCache = new Map();
const FIELDS_CACHE_TTL = 10 * 60 * 1000; // 10 minutes (fields don't change often)

export async function getFieldsMeta(module = "Events") {
  // Check cache first
  const cacheKey = module;
  const cached = fieldsMetaCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < FIELDS_CACHE_TTL) {
    return cached.fields;
  }

  try {
    const res = await ZOHO.CRM.META.getFields({ Entity: module });
    const fields = Array.isArray(res?.fields) ? res.fields : [];
    
    // Cache the result
    fieldsMetaCache.set(cacheKey, {
      fields,
      timestamp: Date.now(),
    });
    
    return fields;
  } catch (err) {
    console.error("getFieldsMeta failed:", err);
    return [];
  }
}

// Cache for picklist values (to avoid repeated API calls)
const picklistCache = new Map();
const PICKLIST_CACHE_TTL = 10 * 60 * 1000; // 10 minutes

export async function getPicklistValues(apiName, module = "Events") {
  // Check cache first
  const cacheKey = `${module}_${apiName}`;
  const cached = picklistCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < PICKLIST_CACHE_TTL) {
    return cached.values;
  }

  const fields = await getFieldsMeta(module);
  const field = fields.find((f) => f.api_name === apiName);
  if (!field) return [];

  const conn_name = "zohoadvancecalendar";
  const api_domain = "https://www.zohoapis.com";
  const url = `${api_domain}/crm/v8/settings/fields/${field.id}/pick_list_values?module=${module}`;
  const req_data = {
    method: "GET",
    url,
  };

  try {
    const resp = await ZOHO.CRM.CONNECTION.invoke(conn_name, req_data);


    const apiList = resp?.details?.statusMessage?.pick_list_values ?? [];

    if (Array.isArray(apiList) && apiList.length) {
      const processedList = apiList
        .filter((p) => p.type === "used") // only used options
        .filter(
          (p) =>
            p.actual_value !== "-None-" &&
            p.display_value !== "-None-" &&
            p.reference_value !== "-None-"
        )
        .sort((a, b) => (a.sequence_number || 0) - (b.sequence_number || 0))
        .map((p) => ({
          id: p.id,
          label: p.display_value, // e.g. "Showroom Appointment"
          value:
            p.actual_value ?? p.reference_value ?? p.display_value, // e.g. "Showroom"
          color: p.colour_code || null,
          sequence: p.sequence_number,
        }));
      
      // Cache the result
      picklistCache.set(cacheKey, {
        values: processedList,
        timestamp: Date.now(),
      });
      
      return processedList;
    }
  } catch (e) {
    console.error("Error fetching picklist values", e);
  }
  
  // fallback: old metadata
  const fallbackList = Array.isArray(field.pick_list_values)
    ? field.pick_list_values
    : [];
  
  if (fallbackList.length > 0) {
    // Cache fallback result too
    picklistCache.set(cacheKey, {
      values: fallbackList,
      timestamp: Date.now(),
    });
    return fallbackList;
  }
  
  return [];

  return list
    .filter((p) => p.type === "used" || p.type === undefined)
    .filter(
      (p) =>
        p.actual_value !== "-None-" &&
        p.display_value !== "-None-" &&
        p.reference_value !== "-None-"
    )
    .sort((a, b) => (a.sequence_number || 0) - (b.sequence_number || 0))
    .map((p) => ({
      id: p.id,
      label: p.display_value,
      value: p.actual_value ?? p.reference_value ?? p.display_value,
      color: p.colour_code || null,
      sequence: p.sequence_number,
    }));
}


export async function getUsers(module, recordId, data) {423
    try{
        const response = await ZOHO.CRM.API.getAllUsers({Type:"AllUsers"})
        const zohoUsers = Array.isArray(response?.users) ? response.users : [];
        // console.log('zoho users response', zohoUsers);
        return zohoUsers;
    }catch(err){
        console.error('Error fetching users:', err);
    }
}

export async function getUserGroups(params) {
    // const criteriaRaw = `(Start_DateTime:less_equal:${endStr})and(End_DateTime:greater_equal:${startStr})`;
    // const criteria = encodeURIComponent(criteriaRaw);

    const conn_name = "zohoadvancecalendar";
    const api_domain = "https://www.zohoapis.com";

    const url = `${api_domain}/crm/v4/settings/user_groups`;

    const req_data = {
      method: "GET",
      url, // full encoded URL
    };

    try {
      const resp = await ZOHO.CRM.CONNECTION.invoke(conn_name, req_data);
      const groups = Array.isArray(resp?.details?.statusMessage?.user_groups) ? resp.details.statusMessage.user_groups : [];
      // console.log('user groups response', resp);
      return groups || [];
    } catch (err) {
      console.error("User Groups error:", err);
      throw err;
    }
}

export async function fetchParticipants(type, searchText = "") {
  
  const moduleMap = {
    lead: "Leads",
    contact: "Contacts",
    user: "users",
    group: "Groups",
  };

  const module = moduleMap[type];
  if (!module) return [];

  try {
    if (type === "user") {
      const resp = await ZOHO.CRM.API.getAllUsers({ Type: "AllUsers" });
      const users = Array.isArray(resp?.users) ? resp.users : [];
      return users
        .filter(u => {
          const name = u.full_name || `${u.first_name || ""} ${u.last_name || ""}`.trim();
          return !searchText || name.toLowerCase().includes(searchText.toLowerCase()) || (u.email || "").toLowerCase().includes(searchText.toLowerCase());
        })
        .map(u => ({
          id: String(u.id || u.zuid || ""),
          name: u.full_name || `${u.first_name || ""} ${u.last_name || ""}`.trim(),
          Email: u.email || "",
          type: "user",
        }));
    }

    // Leads / Contacts / Groups (illustrative)
    const resp = await ZOHO.CRM.API.getAllRecords({
      Entity: module,
      sort_order: "asc",
      per_page: 200,
      page: 1,
    });

    const records = Array.isArray(resp?.data) ? resp.data : [];
    const filtered = searchText
      ? records.filter(r => {
          const name = r.Full_Name || r.Full_Name || r.Last_Name || r.Company || r.Name || "";
          const email = r.Email || r.email || "";
          return name.toLowerCase().includes(searchText.toLowerCase()) || email.toLowerCase().includes(searchText.toLowerCase());
        })
      : records;

    return filtered.map(r => ({
      id: String(r.id || ""),
      name: r.Full_Name || r.Full_Name || r.Last_Name || r.Company || r.Name || "(No name)",
      Email: r.Email || r.email || "",
      type,
    }));
  } catch (e) {
    console.error("fetchParticipants error:", e);
    return [];
  }
}



// const refreshAccessToken = async (refreshToken) => {
//     try{
//         const response = await axios.post('https://accounts.zoho.com/oauth/v2/token', null, {
//             params: {
//                 refresh_token: refreshToken,
//                 client_id: '',
//                 client_secret: '',
//                 grant_type: 'refresh_token'
//             }
//         });
//         console.log('Token refreshed successfully:', response.data);
//         return response.data;
//     }catch(err){
//         console.error('Error refreshing access token:', err);
// }
// }

// const fetchUserGroups = async (accessToken) => {
//   const response = await axios.get('https://www.zohoapis.com/crm/v8/settings/user_groups?include=sources_count', {
//             headers: {
//                 'Authorization': `Zoho-oauthtoken ${accessToken}`,
//             }
//         });
//         console.log('user groups response', response.data);
//         return response.data;
// }
    
// export const getUserGroups = async () => {
//     let accessToken = ''
//     const refreshToken = ''
//     try{
//         const groupsData = await fetchUserGroups(accessToken);
//         console.log('Fetched user groups:', groupsData);
//         return groupsData;
//     }catch(err){
//         console.error('Error fetching user groups:', err);
//         if(err.response.message === 'invalid oauth token' && err.response.status === 401){
//             // Token might be expired, try refreshing
//             const response = await refreshAccessToken(refreshToken);
//             if(response && response.access_token){
//                 const newAccessToken = response.access_token;
//                 accessToken = newAccessToken; // Update the accessToken for future use
//                 const groupsData = await fetchUserGroups(newAccessToken);
//                 console.log('Fetched user groups after refreshing token:', groupsData);
//                 return groupsData;
//             }
//         }
//     }
// }


export async function getModuleList() {
  try {
    const resp = await ZOHO.CRM.META.getModules();
    const mods = Array.isArray(resp?.modules) ? resp.modules : [];

    // keep only api name + singular label, sorted by label
    const moduleList = mods
      .map(m => ({
        api_name: m.api_name,
        singular_label: m.actual_singular_label,
        label:m.plural_label,
        secondary_label:m.singular_label,

      }))
      .sort((a, b) => a.label.localeCompare(b.label));
      console.log('modulelist', mods)
    return moduleList;
  } catch (err) {
    console.error("Error fetching module list:", err);
    return [];
  }
}

export async function fetchShowrooms() {
  try {
    const response = await ZOHO.CRM.API.getAllRecords({
      Entity: "Showrooms",      // adjust to your module API name
      sort_order: "asc",
      per_page: 200,
    });
    const records = Array.isArray(response?.data) ? response.data : [];
    return records.map((r) => ({
      id: r.id,
      label: r.Name,            // adjust if your showroom name field is different
      value: r.id,
    }));
  } catch (err) {
    console.error("Error fetching showrooms", err);
    return [];
  }
}

export async function getBusinessHours() {
  try {
    const conn_name = "zohoadvancecalendar";
    const api_domain = "https://www.zohoapis.com";
    const url = `${api_domain}/crm/v8/settings/business_hours`;

    const resp = await ZOHO.CRM.CONNECTION.invoke(conn_name, { 
      method: "GET", 
      url 
    });

    const bh =
      resp?.details?.statusMessage?.business_hours ||
      resp?.details?.statusMessage?.data ||
      resp?.details?.statusMessage ||
      resp?.business_hours ||
      null;

    if (!bh) {
      // Return default business hours if API doesn't return data
      return {
        enabled: true,
        timezone: "UTC",
        days: {
          Monday: { start_time: "09:00", end_time: "17:00" },
          Tuesday: { start_time: "09:00", end_time: "17:00" },
          Wednesday: { start_time: "09:00", end_time: "17:00" },
          Thursday: { start_time: "09:00", end_time: "17:00" },
          Friday: { start_time: "09:00", end_time: "17:00" },
          Saturday: { start_time: "00:00", end_time: "00:00" },
          Sunday: { start_time: "00:00", end_time: "00:00" },
        },
      };
    }

    const days = {};
    const rawDays = bh.business_days || bh.businessDays || bh.days || bh;

    if (Array.isArray(rawDays)) {
      for (const d of rawDays) {
        const name = (d.day || d.name || "").toString();
        if (!name) continue;
        const key = name[0] + name.slice(1).toLowerCase();
        days[key] = {
          start_time: d.start_time || d.start || d.open_time || "00:00",
          end_time: d.end_time || d.end || d.close_time || "23:59",
        };
      }
    } else if (rawDays && typeof rawDays === "object") {
      for (const k of Object.keys(rawDays)) {
        const entry = rawDays[k] || {};
        const key = k[0] + k.slice(1).toLowerCase();
        days[key] = {
          start_time: entry.start_time || entry.start || entry.open_time || "00:00",
          end_time: entry.end_time || entry.end || entry.close_time || "23:59",
        };
      }
    }

    return {
      enabled: !!bh.enabled,
      timezone: bh.timezone || bh.time_zone || "UTC",
      days,
    };
  } catch (err) {
    console.warn("Could not fetch business hours from API, using defaults", err);
    // Return safe defaults: 9 AM - 6 PM on weekdays, closed on weekends
    return {
      enabled: true,
      timezone: "UTC",
      days: {
        Monday: { start_time: "09:00", end_time: "17:00" },
        Tuesday: { start_time: "09:00", end_time: "17:00" },
        Wednesday: { start_time: "09:00", end_time: "17:00" },
        Thursday: { start_time: "09:00", end_time: "17:00" },
        Friday: { start_time: "09:00", end_time: "17:00" },
        Saturday: { start_time: "00:00", end_time: "00:00" },
        Sunday: { start_time: "00:00", end_time: "00:00" },
      },
    };
  }
}

// ===== CONTACTS =====
export const getContactAddress = async (contactId) => {
  try {
    const response = await ZOHO.CRM.CONNECTION.invoke("zohoadvancecalendar", { 
      method: "GET", 
      url: `https://www.zohoapis.com/crm/v2/Contacts/${contactId}`
    });
    
    const data = response?.details?.statusMessage?.data?.[0];
    if (!data) return '';
    
    const address = [
      data.Mailing_Street,
      `${data.Mailing_City || ''}${data.Mailing_State ? ', ' + data.Mailing_State : ''}${data.Mailing_Zip ? ' ' + data.Mailing_Zip : ''}`,
      data.Mailing_Country
    ].filter(Boolean).join(', ');
    
    return address || data.Company || '';
  } catch (error) {
    console.error('Contacts address error:', error);
    return '';
  }
};

// ===== LEADS =====
export const getLeadAddress = async (leadId) => {
  try {
    const response = await ZOHO.CRM.CONNECTION.invoke("zohoadvancecalendar", { 
      method: "GET", 
      url: `https://www.zohoapis.com/crm/v2/Leads/${leadId}`
    });
    
    const data = response?.details?.statusMessage?.data?.[0];
    if (!data) return '';
    
    // Leads fallback: Company → Showroom → Phone
    return data.Company || 
           data.Showroom?.name || 
           data.Phone || 
           data.Full_Name || '';
  } catch (error) {
    console.error('Leads address error:', error);
    return '';
  }
};

// ===== ACCOUNTS =====
export const getAccountAddress = async (accountId) => {
  try {
    const response = await ZOHO.CRM.CONNECTION.invoke("zohoadvancecalendar", { 
      method: "GET", 
      url: `https://www.zohoapis.com/crm/v2/Accounts/${accountId}`
    });
    
    const data = response?.details?.statusMessage?.data?.[0];
    if (!data) return '';
    
    const address = [
      data.Billing_Street || data.Street,
      `${data.Billing_City || data.City || ''}${data.Billing_State ? ', ' + data.Billing_State : ''}${data.Billing_Zip ? ' ' + data.Billing_Zip : ''}`,
      data.Billing_Country
    ].filter(Boolean).join(', ');
    
    return address || data.Account_Name || '';
  } catch (error) {
    console.error('Accounts address error:', error);
    return '';
  }
};

// ===== DEALS =====
export const getDealAddress = async (dealId) => {
  try {
    const response = await ZOHO.CRM.CONNECTION.invoke("zohoadvancecalendar", { 
      method: "GET", 
      url: `https://www.zohoapis.com/crm/v2/Deals/${dealId}`
    });
    
    const data = response?.details?.statusMessage?.data?.[0];
    if (!data) return '';
    
    // Deals: Use Account address or Deal fields
    return data.Billing_Address || 
           data.Account_Name?.name || 
           data.Deal_Name || '';
  } catch (error) {
    console.error('Deals address error:', error);
    return '';
  }
};

export async function getShowroomAddress(userId) {
  const user = await ZOHO.CRM.API.getRecord({ Entity: 'Users', RecordID: userId });
  const showroomId = user.data[0].Showroom__c; // lookup field
  if (!showroomId) return "";
  
  const showroom = await ZOHO.CRM.API.getRecord({ 
    Entity: 'Showrooms', 
    RecordID: showroomId 
  });
  return showroom.data[0].Address || "";
}

export async function getShowroomAddressFromUser(userId) {
  if (!userId) return '';
  
  try {
    // ✅ Use ZOHO.CRM.USER or CRM Users endpoint
    const userResp = await ZOHO.CRM.API.getRecord({ 
      Entity: 'Contacts',  // or 'Leads' - users are stored here
      RecordID: userId 
    });
    
    const showroomId = userResp.data?.[0]?.Showroomc?.id || userResp.data?.[0]?.Showroom__c;
    if (!showroomId) return '';
    
    const showroomResp = await ZOHO.CRM.API.getRecord({ 
      Entity: 'Showrooms', 
      RecordID: showroomId 
    });
    
    const showroom = showroomResp.data?.[0];
    return [showroom.Street, showroom.City, showroom.State, showroom.Zipcode, showroom.Country]
      .filter(Boolean).join(', ');
  } catch (err) {
    console.error('Error fetching showroom address:', err);
    return '';
  }
}

export async function sendSMS(phone, message, meetingId) {
  // Twilio/Zoho Campaigns/SMS API
  await fetch('/api/sms/send', {
    method: 'POST',
    body: JSON.stringify({ phone, message: `Confirm meeting? Reply Y/N`, meetingId })
  });
}

export async function handleSMSReply(messageId, reply) {
  const meeting = await getRecord('Events', messageId);
  if (reply === 'Y') {
    await updateRecord('Events', { id: meetingId, CheckInStatus: 'Confirmed' });
    await sendMeetingInvite(meeting.relatedRecord.id); // Email/Zoho Meeting
  } else if (reply === 'N') {
    await updateRecord('Events', { id: meetingId, CheckInStatus: 'Cancelled' });
    await notifyShowroomManager(meeting.hostId, `Meeting ${meetingId} cancelled`);
  }
}

