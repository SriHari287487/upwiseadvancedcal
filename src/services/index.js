/**
 * Services Index
 * Export all services for easy importing
 */

// SMS Service - handles sending SMS and processing replies
export {
  sendSMS,
  sendMeetingConfirmationSMS,
  handleSMSReply,
  getCustomerPhone,
  buildConfirmationSMS,
  getShowroomManager,
} from "./SMSService";

// Business Hours Service - user-specific hours and time-off
export {
  getOrgBusinessHours,
  getUserBusinessHours,
  getUserTimeOff,
  isWithinBusinessHours,
  isDateDayOff,
  getBlockedSlots,
  getCalendarBusinessHoursInfo,
  getBatchCalendarInfo,
  clearUserHoursCache,
  DEFAULT_BUSINESS_HOURS,
} from "./BusinessHoursService";

// SMS Webhook Handler - for processing incoming SMS replies
export {
  parseSMSWebhook,
  findMeetingByPhone,
  processSMSReply,
} from "./SMSWebhookHandler";

