/**
 * SMS Service for sending automated texts to customers
 * Integrates with Zoho SMS widget / Twilio / other SMS providers
 */

const SMS_CONN_NAME = "zohoadvancecalendar"; // Your Zoho connection name
const API_DOMAIN = "https://www.zohoapis.com";

/**
 * Get customer phone number from the related record (Contact/Lead)
 */
export async function getCustomerPhone(relatedRecord) {
  if (!relatedRecord?.id || !relatedRecord?.module) {
    console.warn("No related record to get phone from");
    return null;
  }

  try {
    const resp = await ZOHO.CRM.API.getRecord({
      Entity: relatedRecord.module,
      RecordID: relatedRecord.id,
    });

    const data = resp?.data?.[0];
    if (!data) return null;

    // Try different phone fields based on module
    const phone =
      data.Phone ||
      data.Mobile ||
      data.Contact_Mobile ||
      data.Primary_Phone ||
      data.Secondary_Phone ||
      data.Work_Phone ||
      null;

    return phone;
  } catch (err) {
    console.error("Error fetching customer phone:", err);
    return null;
  }
}

// Cache for user and showroom data (to avoid repeated API calls)
const userCache = new Map();
const showroomCache = new Map();
const USER_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Get showroom manager info for notifications
 */
export async function getShowroomManager(showroomId) {
  if (!showroomId) return null;

  // Check cache first
  const cached = showroomCache.get(showroomId);
  if (cached && Date.now() - cached.timestamp < USER_CACHE_TTL) {
    return cached.manager;
  }

  try {
    const resp = await ZOHO.CRM.API.getRecord({
      Entity: "Showrooms",
      RecordID: showroomId,
    });

    const showroom = resp?.data?.[0];
    if (!showroom) return null;

    // Get manager from showroom record
    const manager = showroom.Manager || showroom.Showroom_Manager || null;
    
    // Cache the result
    if (manager) {
      showroomCache.set(showroomId, {
        manager,
        timestamp: Date.now(),
      });
    }
    
    return manager;
  } catch (err) {
    console.error("Error fetching showroom manager:", err);
    return null;
  }
}

/**
 * Send SMS via Zoho SMS Widget or configured SMS provider
 * @param {string} phone - Customer phone number
 * @param {string} message - SMS message content
 * @param {string} meetingId - Event/Meeting record ID for tracking
 * @returns {Promise<{success: boolean, messageId?: string, error?: string}>}
 */
export async function sendSMS(phone, message, meetingId) {
  if (!phone || !message) {
    return { success: false, error: "Phone and message are required" };
  }

  // Clean phone number (remove spaces, dashes, etc.)
  const cleanPhone = phone.replace(/[\s\-\(\)]/g, "");

  try {
    // Option 1: Use Zoho PhoneBridge / SMS Widget
    // This requires the Zoho PhoneBridge extension to be configured
    const smsPayload = {
      to: cleanPhone,
      message: message,
      // Link to meeting for tracking replies
      custom_data: {
        meeting_id: meetingId,
        type: "meeting_confirmation",
      },
    };

    // Try Zoho PhoneBridge first
    if (window.ZOHO?.CRM?.PHONEBRIDGE) {
      const result = await ZOHO.CRM.PHONEBRIDGE.sendSMS({
        Entity: "Events",
        RecordID: meetingId,
        PhoneNumber: cleanPhone,
        Message: message,
      });

      if (result?.status === "success") {
        // Log SMS activity
        await logSMSActivity(meetingId, cleanPhone, message, "sent");
        return { success: true, messageId: result.id };
      }
    }

    // Option 2: Use Zoho Flow / Function for SMS
    // This calls a Zoho Function that handles SMS via Twilio/other provider
    const functionResp = await ZOHO.CRM.FUNCTIONS.execute("send_sms_notification", {
      arguments: JSON.stringify({
        phone: cleanPhone,
        message: message,
        meeting_id: meetingId,
      }),
    });

    if (functionResp?.details?.output?.success) {
      await logSMSActivity(meetingId, cleanPhone, message, "sent");
      return {
        success: true,
        messageId: functionResp.details.output.message_id,
      };
    }

    // Option 3: Direct API call to SMS service (fallback)
    const directResp = await ZOHO.CRM.CONNECTION.invoke(SMS_CONN_NAME, {
      method: "POST",
      url: `${API_DOMAIN}/crm/v5/functions/send_sms/actions/execute`,
      param_type: 2,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phone: cleanPhone,
        message: message,
        meeting_id: meetingId,
      }),
    });

    if (directResp?.details?.statusMessage?.success) {
      await logSMSActivity(meetingId, cleanPhone, message, "sent");
      return { success: true };
    }

    return {
      success: false,
      error: "SMS sending failed - no provider available",
    };
  } catch (err) {
    console.error("SMS send error:", err);
    await logSMSActivity(meetingId, cleanPhone, message, "failed", err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Log SMS activity to the meeting record
 */
async function logSMSActivity(meetingId, phone, message, status, errorMsg = null) {
  try {
    // Add a note to the meeting record
    await ZOHO.CRM.API.addNotes({
      Entity: "Events",
      RecordID: meetingId,
      Title: `SMS ${status === "sent" ? "Sent" : "Failed"}`,
      Content: `SMS ${status} to ${phone}\nMessage: ${message}${
        errorMsg ? `\nError: ${errorMsg}` : ""
      }`,
    });
  } catch (err) {
    console.warn("Could not log SMS activity:", err);
  }
}

/**
 * Build confirmation SMS message for a meeting
 */
export function buildConfirmationSMS(meeting, hostName, customerName) {
  const date = new Date(meeting.Start_DateTime || meeting.startDateTime);
  const formattedDate = date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const formattedTime = date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  const location = meeting.Venue || meeting.location || "our showroom";

  return (
    `Hi ${customerName || "there"}! ` +
    `Your appointment with ${hostName || "us"} is scheduled for ` +
    `${formattedDate} at ${formattedTime} at ${location}. ` +
    `Reply Y to confirm or N to cancel.`
  );
}

/**
 * Send meeting confirmation SMS to customer
 */
export async function sendMeetingConfirmationSMS(meetingData, relatedRecord) {
  const phone = await getCustomerPhone(relatedRecord);
  if (!phone) {
    console.warn("No phone number found for customer");
    return { success: false, error: "No phone number found" };
  }

  const customerName =
    relatedRecord?.name ||
    relatedRecord?.Full_Name ||
    meetingData.Who_Id?.name ||
    "";

  const hostName =
    meetingData.Owner?.name ||
    meetingData.host?.name ||
    "";

  const message = buildConfirmationSMS(meetingData, hostName, customerName);
  return await sendSMS(phone, message, meetingData.id);
}

/**
 * Handle SMS reply from customer
 * This would typically be called from a Zoho Function webhook
 */
export async function handleSMSReply(meetingId, reply, customerPhone) {
  const normalizedReply = (reply || "").trim().toUpperCase();

  try {
    // Get the meeting record
    const meetingResp = await ZOHO.CRM.API.getRecord({
      Entity: "Events",
      RecordID: meetingId,
    });

    const meeting = meetingResp?.data?.[0];
    if (!meeting) {
      return { success: false, error: "Meeting not found" };
    }

    if (normalizedReply === "Y" || normalizedReply === "YES") {
      // Customer confirmed
      return await confirmMeeting(meeting, customerPhone);
    } else if (normalizedReply === "N" || normalizedReply === "NO") {
      // Customer cancelled
      return await cancelMeeting(meeting, customerPhone);
    } else {
      // Unknown reply - send help message
      await sendSMS(
        customerPhone,
        "Sorry, we didn't understand your reply. Please reply Y to confirm or N to cancel your appointment.",
        meetingId
      );
      return { success: true, action: "help_sent" };
    }
  } catch (err) {
    console.error("Error handling SMS reply:", err);
    return { success: false, error: err.message };
  }
}

/**
 * Confirm meeting and send calendar invite
 */
async function confirmMeeting(meeting, customerPhone) {
  try {
    // Update meeting status to Confirmed
    await ZOHO.CRM.API.updateRecord({
      Entity: "Events",
      APIData: {
        id: meeting.id,
        Check_In_Status: "Confirmed",
        // Or use a custom field: Confirmation_Status: "Confirmed"
      },
    });

    // Send calendar invite to customer
    await sendCalendarInvite(meeting);

    // Send confirmation SMS
    await sendSMS(
      customerPhone,
      "Great! Your appointment is confirmed. You'll receive a calendar invite shortly. We look forward to seeing you!",
      meeting.id
    );

    // Log the confirmation
    await ZOHO.CRM.API.addNotes({
      Entity: "Events",
      RecordID: meeting.id,
      Title: "Meeting Confirmed",
      Content: `Customer confirmed the meeting via SMS at ${new Date().toISOString()}`,
    });

    return { success: true, action: "confirmed" };
  } catch (err) {
    console.error("Error confirming meeting:", err);
    return { success: false, error: err.message };
  }
}

/**
 * Cancel meeting and notify showroom manager
 */
async function cancelMeeting(meeting, customerPhone) {
  try {
    // Update meeting status to Cancelled
    await ZOHO.CRM.API.updateRecord({
      Entity: "Events",
      APIData: {
        id: meeting.id,
        Check_In_Status: "Cancelled",
        // Or use a custom field: Confirmation_Status: "Cancelled"
      },
    });

    // Send cancellation confirmation to customer
    await sendSMS(
      customerPhone,
      "Your appointment has been cancelled. If you'd like to reschedule, please contact us.",
      meeting.id
    );

    // Notify showroom manager
    await notifyShowroomManager(meeting);

    // Log the cancellation
    await ZOHO.CRM.API.addNotes({
      Entity: "Events",
      RecordID: meeting.id,
      Title: "Meeting Cancelled",
      Content: `Customer cancelled the meeting via SMS at ${new Date().toISOString()}`,
    });

    return { success: true, action: "cancelled" };
  } catch (err) {
    console.error("Error cancelling meeting:", err);
    return { success: false, error: err.message };
  }
}

/**
 * Send calendar invite to customer
 */
async function sendCalendarInvite(meeting) {
  try {
    // Get participant email
    const participants = meeting.Participants || [];
    const whoId = meeting.Who_Id;
    
    let customerEmail = null;
    
    // Try to get email from participants
    for (const p of participants) {
      if (p.Email || p.email) {
        customerEmail = p.Email || p.email;
        break;
      }
    }
    
    // If no participant email, try to get from Who_Id (Contact/Lead)
    if (!customerEmail && whoId?.id) {
      const module = whoId.module || (meeting.$se_module === "Leads" ? "Leads" : "Contacts");
      const recordResp = await ZOHO.CRM.API.getRecord({
        Entity: module,
        RecordID: whoId.id,
      });
      const record = recordResp?.data?.[0];
      customerEmail = record?.Email || record?.email;
    }

    if (!customerEmail) {
      console.warn("No customer email found for calendar invite");
      return { success: false, error: "No customer email" };
    }

    // Send invite via Zoho Mail / Calendar
    // This uses Zoho's built-in invite mechanism
    await ZOHO.CRM.API.updateRecord({
      Entity: "Events",
      APIData: {
        id: meeting.id,
        // Adding participant with invite
        Participants: [
          ...participants,
          {
            Email: customerEmail,
            invited: true,
            status: "not_known",
          },
        ],
        send_notification: true,
      },
    });

    return { success: true };
  } catch (err) {
    console.error("Error sending calendar invite:", err);
    return { success: false, error: err.message };
  }
}

/**
 * Get user with caching
 */
async function getCachedUser(userId) {
  if (!userId) return null;
  
  // Check cache first
  const cached = userCache.get(userId);
  if (cached && Date.now() - cached.timestamp < USER_CACHE_TTL) {
    return cached.user;
  }
  
  try {
    const userResp = await ZOHO.CRM.API.getUser({ ID: userId });
    const user = userResp?.users?.[0];
    
    // Cache the result
    if (user) {
      userCache.set(userId, {
        user,
        timestamp: Date.now(),
      });
    }
    
    return user;
  } catch (err) {
    console.warn("Could not fetch user:", err);
    return null;
  }
}

/**
 * Notify showroom manager about cancellation
 */
async function notifyShowroomManager(meeting) {
  try {
    const hostId = meeting.Owner?.id;
    if (!hostId) return;

    // Get host's showroom (use cached version)
    const user = await getCachedUser(hostId);
    
    // Try to find showroom from user profile or related field
    const showroomId = user?.Showroom?.id || user?.Showroom_c || user?.showroom_id;
    
    if (!showroomId) {
      // Notify the host directly instead
      await sendInternalNotification(
        hostId,
        "Meeting Cancelled",
        `The meeting "${meeting.Event_Title}" scheduled for ${meeting.Start_DateTime} has been cancelled by the customer.`
      );
      return;
    }

    const manager = await getShowroomManager(showroomId);
    if (manager?.id) {
      await sendInternalNotification(
        manager.id,
        "Meeting Cancelled",
        `The meeting "${meeting.Event_Title}" scheduled for ${meeting.Start_DateTime} with ${meeting.Owner?.name || "a team member"} has been cancelled by the customer.`
      );
    }
  } catch (err) {
    console.error("Error notifying showroom manager:", err);
  }
}

/**
 * Send internal notification to a user
 */
async function sendInternalNotification(userId, title, message) {
  try {
    // Option 1: Create a notification in Zoho CRM
    await ZOHO.CRM.FUNCTIONS.execute("send_internal_notification", {
      arguments: JSON.stringify({
        user_id: userId,
        title: title,
        message: message,
      }),
    });
  } catch (err) {
    console.warn("Could not send internal notification:", err);
    
    // Fallback: Try to send via email (use cached version)
    try {
      const user = await getCachedUser(userId);
      const userEmail = user?.email;
      
      if (userEmail) {
        await ZOHO.CRM.API.sendMail({
          Entity: "Users",
          RecordID: userId,
          Subject: title,
          Content: message,
        });
      }
    } catch (emailErr) {
      console.warn("Fallback email notification also failed:", emailErr);
    }
  }
}

export default {
  sendSMS,
  sendMeetingConfirmationSMS,
  handleSMSReply,
  getCustomerPhone,
  buildConfirmationSMS,
};

