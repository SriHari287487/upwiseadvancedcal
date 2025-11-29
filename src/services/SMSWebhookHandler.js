/**
 * SMS Webhook Handler
 * This module handles incoming SMS replies from customers
 * 
 * DEPLOYMENT NOTE:
 * This logic should be deployed as a Zoho Function that gets triggered
 * by your SMS provider's webhook (e.g., Twilio, Zoho SMS).
 * 
 * The Zoho Function would look like:
 * 
 * void handleSMSReply(Map requestParams) {
 *   String phone = requestParams.get("From");
 *   String message = requestParams.get("Body");
 *   String meetingId = requestParams.get("meeting_id"); // From custom data
 *   
 *   // Call this module's logic
 *   // ...
 * }
 */

import { handleSMSReply } from "./SMSService";

/**
 * Parse incoming webhook from various SMS providers
 */
export function parseSMSWebhook(provider, payload) {
  switch (provider.toLowerCase()) {
    case "twilio":
      return {
        phone: payload.From,
        message: payload.Body,
        messageId: payload.MessageSid,
        timestamp: new Date().toISOString(),
      };
      
    case "zoho":
      return {
        phone: payload.from || payload.sender,
        message: payload.text || payload.message || payload.body,
        messageId: payload.id || payload.message_id,
        timestamp: payload.timestamp || new Date().toISOString(),
      };
      
    case "clicksend":
      return {
        phone: payload.from,
        message: payload.body,
        messageId: payload.message_id,
        timestamp: payload.timestamp,
      };
      
    default:
      // Generic format
      return {
        phone: payload.from || payload.phone || payload.From,
        message: payload.body || payload.message || payload.text || payload.Body,
        messageId: payload.id || payload.message_id || payload.MessageSid,
        timestamp: payload.timestamp || new Date().toISOString(),
      };
  }
}

/**
 * Find meeting ID from phone number
 * Searches recent meetings that sent SMS to this phone
 */
export async function findMeetingByPhone(phone) {
  try {
    // Clean phone for comparison
    const cleanPhone = phone.replace(/[\s\-\(\)\+]/g, "");
    const last10 = cleanPhone.slice(-10); // Get last 10 digits for matching
    
    // Search for recent meetings (last 7 days) with pending confirmation
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    const criteria = 
      `(Check_In_Status:equals:Scheduled)` +
      `and(Start_DateTime:greater_equal:${weekAgo.toISOString()})`;
    
    const resp = await ZOHO.CRM.API.searchRecords({
      Entity: "Events",
      Type: "criteria",
      Query: criteria,
    });
    
    const meetings = resp?.data || [];
    
    // Find meeting where participant phone matches
    for (const meeting of meetings) {
      // Check Who_Id (Contact/Lead)
      if (meeting.Who_Id?.id) {
        const recordPhone = await getRecordPhone(
          meeting.$se_module || "Contacts",
          meeting.Who_Id.id
        );
        
        if (recordPhone && recordPhone.slice(-10) === last10) {
          return meeting;
        }
      }
      
      // Check participants
      const participants = meeting.Participants || [];
      for (const p of participants) {
        const pPhone = p.phone || p.Phone || p.Mobile;
        if (pPhone && pPhone.replace(/[\s\-\(\)\+]/g, "").slice(-10) === last10) {
          return meeting;
        }
      }
    }
    
    return null;
  } catch (err) {
    console.error("Error finding meeting by phone:", err);
    return null;
  }
}

/**
 * Get phone number from a CRM record
 */
async function getRecordPhone(module, recordId) {
  try {
    const resp = await ZOHO.CRM.API.getRecord({
      Entity: module,
      RecordID: recordId,
    });
    
    const record = resp?.data?.[0];
    if (!record) return null;
    
    return record.Phone || record.Mobile || record.Contact_Mobile || null;
  } catch (err) {
    return null;
  }
}

/**
 * Process incoming SMS reply
 * This is the main entry point for the webhook
 */
export async function processSMSReply(provider, webhookPayload) {
  try {
    // Parse the webhook payload
    const smsData = parseSMSWebhook(provider, webhookPayload);
    
    if (!smsData.phone || !smsData.message) {
      return {
        success: false,
        error: "Missing phone or message in webhook payload",
      };
    }
    
    // Check if meeting ID was passed in custom data
    let meetingId = webhookPayload.meeting_id || 
                    webhookPayload.custom_data?.meeting_id ||
                    webhookPayload.reference;
    
    // If no meeting ID, try to find by phone
    if (!meetingId) {
      const meeting = await findMeetingByPhone(smsData.phone);
      if (meeting) {
        meetingId = meeting.id;
      } else {
        return {
          success: false,
          error: "Could not find meeting for this phone number",
        };
      }
    }
    
    // Handle the reply
    const result = await handleSMSReply(meetingId, smsData.message, smsData.phone);
    
    // Log the webhook processing
    console.log("SMS Webhook processed:", {
      phone: smsData.phone,
      message: smsData.message,
      meetingId,
      result,
    });
    
    return result;
  } catch (err) {
    console.error("Error processing SMS webhook:", err);
    return {
      success: false,
      error: err.message,
    };
  }
}

/**
 * Zoho Function template for handling SMS webhooks
 * Deploy this as a Zoho Function and configure your SMS provider
 * to call the function's invoke URL
 * 
 * Example Zoho Function (Deluge):
 * 
 * void handleIncomingSMS(Map params) {
 *   String phone = ifnull(params.get("From"), params.get("from"));
 *   String body = ifnull(params.get("Body"), params.get("body"));
 *   String meetingId = params.get("meeting_id");
 *   
 *   if (phone == null || body == null) {
 *     return {"status": "error", "message": "Missing required fields"};
 *   }
 *   
 *   // Clean phone number
 *   phone = phone.replaceAll("[^0-9]", "");
 *   
 *   // Get reply (Y or N)
 *   reply = body.trim().toUpperCase();
 *   
 *   // Find meeting if not provided
 *   if (meetingId == null) {
 *     // Search for scheduled meetings with this phone
 *     searchResp = zoho.crm.searchRecords("Events", "(Check_In_Status:equals:Scheduled)");
 *     for each meeting in searchResp {
 *       // Check if participant phone matches
 *       whoId = meeting.get("Who_Id");
 *       if (whoId != null) {
 *         recordResp = zoho.crm.getRecordById("Contacts", whoId.get("id"));
 *         recordPhone = ifnull(recordResp.get("Phone"), recordResp.get("Mobile"));
 *         if (recordPhone != null && recordPhone.replaceAll("[^0-9]", "").endsWith(phone.substring(phone.length() - 10))) {
 *           meetingId = meeting.get("id");
 *           break;
 *         }
 *       }
 *     }
 *   }
 *   
 *   if (meetingId == null) {
 *     return {"status": "error", "message": "Meeting not found"};
 *   }
 *   
 *   // Update meeting status based on reply
 *   if (reply == "Y" || reply == "YES") {
 *     updateMap = Map();
 *     updateMap.put("Check_In_Status", "Confirmed");
 *     zoho.crm.updateRecord("Events", meetingId, updateMap);
 *     
 *     // Send calendar invite
 *     meeting = zoho.crm.getRecordById("Events", meetingId);
 *     // ... send invite logic ...
 *     
 *     return {"status": "success", "action": "confirmed"};
 *   } 
 *   else if (reply == "N" || reply == "NO") {
 *     updateMap = Map();
 *     updateMap.put("Check_In_Status", "Cancelled");
 *     zoho.crm.updateRecord("Events", meetingId, updateMap);
 *     
 *     // Notify showroom manager
 *     meeting = zoho.crm.getRecordById("Events", meetingId);
 *     owner = meeting.get("Owner");
 *     // ... notification logic ...
 *     
 *     return {"status": "success", "action": "cancelled"};
 *   }
 *   else {
 *     // Send help message
 *     return {"status": "success", "action": "help_sent"};
 *   }
 * }
 */

export default {
  parseSMSWebhook,
  findMeetingByPhone,
  processSMSReply,
};

