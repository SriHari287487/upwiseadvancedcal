import {pad , getLocalDayBounds, toZohoIsoWithColonOffset, touchesDay} from '../Helper/HelperFunction'
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
  const { start, end } = getLocalDayBounds(date);
  const startStr = toZohoIsoWithColonOffset(start); // e.g. 2025-10-29T00:00:00+05:30
  const endStr   = toZohoIsoWithColonOffset(end);   // e.g. 2025-10-29T23:59:59+05:30

  // Overlap condition (recommended):
  //   (Start <= dayEnd) AND (End >= dayStart)
  const criteriaRaw = `(Start_DateTime:less_equal:${endStr})and(End_DateTime:greater_equal:${startStr})`;

  // Absolutely must URL-encode entire criteria, per Zoho example
  const criteria = encodeURIComponent(criteriaRaw);

  const module = "Events";
  const conn_name = "zohoadvancecalendar";
  const api_domain = "https://www.zohoapis.com"; // switch to .eu / .in if that’s your DC

  const url = `${api_domain}/crm/v8/${module}/search?criteria=${criteria}`;

  const req_data = {
    method: "GET",
    url, // full encoded URL
  };

  try {
    const resp = await ZOHO.CRM.CONNECTION.invoke(conn_name, req_data);
    const rows = Array.isArray(resp?.details?.statusMessage?.data) ? resp.details.statusMessage.data : [];
    // console.log('search reponse', rows)
//     const res = await zrc.get("/crm/v8/Events/search", {
// 	params: {
// 		criteria: criteriaRaw
// 	}
// });
// console.log('ZRC res', res)

return rows
  } catch (err) {
    console.error("Zoho search error:", err);
    console.debug("criteria (raw):", criteriaRaw);
    console.debug("criteria (encoded):", criteria);
    throw err;
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

export async function getFieldsMeta(module = "Events") {
  try {

    const res = await ZOHO.CRM.META.getFields({ Entity: module });
    return Array.isArray(res?.fields) ? res.fields : [];

  } catch (err) {
    console.error("getFieldsMeta failed:", err);
    return [];
  }
}

export async function getPicklistValues(apiName, module = "Events") {
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
      return apiList
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
    }
  } catch (e) {
    console.error("Error fetching picklist values", e);
  }

  // fallback: old metadata
  const list = Array.isArray(field.pick_list_values)
    ? field.pick_list_values
    : [];

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


