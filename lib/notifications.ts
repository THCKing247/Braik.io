import { prisma } from "./prisma"
import { ROLES } from "./roles"

export type NotificationType =
  | "announcement"
  | "event_created"
  | "event_updated"
  | "event_starting_soon"
  | "message"
  | "thread_reply"
  | "ai_task_completed"
  | "billing_reminder"
  | "payment_reminder"
  | "account_status"

export interface NotificationPayload {
  type: NotificationType
  teamId: string
  title: string
  body?: string
  linkUrl?: string
  linkType?: string
  linkId?: string
  metadata?: Record<string, any>
  // Optional: specify target users (if not provided, will be determined by type and role visibility)
  targetUserIds?: string[]
  // Optional: exclude specific users (e.g., the creator)
  excludeUserIds?: string[]
}

/**
 * Create in-app notifications for users based on notification type and role visibility
 * Respects parent restrictions and role hierarchy per BRAIK_MASTER_INTENT.md
 */
export async function createNotifications(payload: NotificationPayload): Promise<void> {
  const { type, teamId, title, body, linkUrl, linkType, linkId, metadata, targetUserIds, excludeUserIds = [] } = payload

  // If targetUserIds are specified, use them directly
  if (targetUserIds && targetUserIds.length > 0) {
    const userIds = targetUserIds.filter(id => !excludeUserIds.includes(id))
    
    await prisma.notification.createMany({
      data: userIds.map(userId => ({
        userId,
        teamId,
        type,
        title,
        body: body || null,
        linkUrl: linkUrl || null,
        linkType: linkType || null,
        linkId: linkId || null,
        metadata: metadata || null,
      })),
    })

    // Send email notifications to Head Coach if applicable
    await sendEmailNotificationsIfNeeded(payload, userIds)
    return
  }

  // Otherwise, determine recipients based on notification type and role visibility
  const recipients = await determineNotificationRecipients(type, teamId, excludeUserIds)

  if (recipients.length === 0) {
    return
  }

  // Create in-app notifications
  await prisma.notification.createMany({
    data: recipients.map(userId => ({
      userId,
      teamId,
      type,
      title,
      body: body || null,
      linkUrl: linkUrl || null,
      linkType: linkType || null,
      linkId: linkId || null,
      metadata: metadata || null,
    })),
  })

  // Send email notifications to Head Coach if applicable
  await sendEmailNotificationsIfNeeded(payload, recipients)
}

/**
 * Determine which users should receive a notification based on type and role visibility
 */
async function determineNotificationRecipients(
  type: NotificationType,
  teamId: string,
  excludeUserIds: string[]
): Promise<string[]> {
  // Get all team memberships
  const memberships = await prisma.membership.findMany({
    where: { teamId },
    include: {
      user: {
        select: { id: true, email: true },
      },
    },
  })

  const recipientIds: string[] = []

  switch (type) {
    case "announcement":
      // All team members receive announcement notifications
      // (Visibility filtering happens at display time based on announcement.audience)
      recipientIds.push(...memberships.map(m => m.userId))
      break

    case "event_created":
    case "event_updated":
      // All team members receive event notifications
      // (Event visibility filtering happens at display time based on event.visibility and scoping)
      recipientIds.push(...memberships.map(m => m.userId))
      break

    case "event_starting_soon":
      // All team members receive event starting soon notifications
      recipientIds.push(...memberships.map(m => m.userId))
      break

    case "message":
    case "thread_reply":
      // Only thread participants receive message notifications
      // (This should be called with targetUserIds from the message API)
      // For now, return empty - should be handled by caller with targetUserIds
      break

    case "ai_task_completed":
      // Notify the user who requested the AI task
      // (This should be called with targetUserIds from the AI API)
      // For now, return empty - should be handled by caller with targetUserIds
      break

    case "billing_reminder":
    case "payment_reminder":
    case "account_status":
      // Only Head Coach receives billing/payment/account notifications
      const headCoachMembership = memberships.find(m => m.role === ROLES.HEAD_COACH)
      if (headCoachMembership) {
        recipientIds.push(headCoachMembership.userId)
      }
      break

    default:
      // Default: all team members
      recipientIds.push(...memberships.map(m => m.userId))
  }

  // Filter out excluded users
  return recipientIds.filter(id => !excludeUserIds.includes(id))
}

/**
 * Send email notifications to Head Coach if applicable
 * Per spec: Email notifications for Head Coach only for:
 * - Announcements
 * - Events
 * - Billing/payment/account status
 */
async function sendEmailNotificationsIfNeeded(
  payload: NotificationPayload,
  recipientUserIds: string[]
): Promise<void> {
  const { type, teamId } = payload

  // Only send emails for specific notification types
  const emailEligibleTypes: NotificationType[] = [
    "announcement",
    "event_created",
    "event_updated",
    "event_starting_soon",
    "billing_reminder",
    "payment_reminder",
    "account_status",
  ]

  if (!emailEligibleTypes.includes(type)) {
    return
  }

  // Get Head Coach memberships for this team
  const headCoachMemberships = await prisma.membership.findMany({
    where: {
      teamId,
      role: ROLES.HEAD_COACH,
    },
    include: {
      user: {
        select: { id: true, email: true, name: true },
      },
    },
  })

  // Filter to only Head Coaches who are recipients
  const headCoachRecipients = headCoachMemberships.filter(m =>
    recipientUserIds.includes(m.userId)
  )

  for (const membership of headCoachRecipients) {
    const user = membership.user

    // Check user's email preferences
    const preferences = await prisma.notificationPreference.findUnique({
      where: { userId: user.id },
    })

    // Check if email is enabled for this notification type
    let shouldEmail = false
    if (type === "announcement" && (preferences?.emailAnnouncements ?? true)) {
      shouldEmail = true
    } else if (
      (type === "event_created" || type === "event_updated" || type === "event_starting_soon") &&
      (preferences?.emailEvents ?? true)
    ) {
      shouldEmail = true
    } else if (
      (type === "billing_reminder" || type === "payment_reminder" || type === "account_status") &&
      (preferences?.emailBilling ?? true)
    ) {
      shouldEmail = true
    }

    if (shouldEmail && user.email) {
      // Send email notification
      await sendEmailNotification(user.email, user.name || "Coach", payload)
    }
  }
}

/**
 * Send an email notification
 * TODO: Integrate with email service (e.g., SendGrid, Resend, or SMTP)
 * For now, this is a placeholder that logs the email
 */
async function sendEmailNotification(
  to: string,
  name: string,
  payload: NotificationPayload
): Promise<void> {
  const { type, title, body, linkUrl } = payload

  // Build email subject and content
  const subject = `[Braik] ${title}`
  const emailBody = body || "You have a new notification in Braik."

  // TODO: Implement actual email sending
  // For now, log the email that would be sent
  console.log(`[EMAIL NOTIFICATION] To: ${to}, Subject: ${subject}`)
  console.log(`Body: ${emailBody}`)
  if (linkUrl) {
    console.log(`Link: ${linkUrl}`)
  }

  // In production, this would use an email service like:
  // - Resend: await resend.emails.send({ from, to, subject, html })
  // - SendGrid: await sgMail.send({ to, from, subject, html })
  // - Nodemailer: await transporter.sendMail({ to, subject, html })
}

/**
 * Mark a notification as read
 */
export async function markNotificationAsRead(
  notificationId: string,
  userId: string
): Promise<void> {
  await prisma.notification.updateMany({
    where: {
      id: notificationId,
      userId, // Ensure user can only mark their own notifications as read
    },
    data: {
      read: true,
      readAt: new Date(),
    },
  })
}

/**
 * Mark all notifications as read for a user in a team
 */
export async function markAllNotificationsAsRead(
  userId: string,
  teamId: string
): Promise<void> {
  await prisma.notification.updateMany({
    where: {
      userId,
      teamId,
      read: false,
    },
    data: {
      read: true,
      readAt: new Date(),
    },
  })
}

/**
 * Get unread notification count for a user in a team
 */
export async function getUnreadNotificationCount(
  userId: string,
  teamId: string
): Promise<number> {
  return await prisma.notification.count({
    where: {
      userId,
      teamId,
      read: false,
    },
  })
}
