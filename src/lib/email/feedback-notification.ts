import { sendSupportNotificationEmail } from '@/lib/email'

interface SendFeedbackNotificationEmailParams {
  feedbackId: string
  type: 'general' | 'generation'
  rating: 'up' | 'down'
  comment: string | null
  context: 'landing' | 'dashboard' | 'generation'
  category: 'bug' | 'suggestion' | 'question' | 'other' | null
  options: string[] | null
  userEmail: string | null
  personId: string | null
  generationId: string | null
}

/**
 * Send feedback notification email to support team
 */
export async function sendFeedbackNotificationEmail({
  feedbackId,
  type,
  rating,
  comment,
  context,
  category,
  options,
  userEmail,
  personId,
  generationId,
}: SendFeedbackNotificationEmailParams) {
  const ratingEmoji = rating === 'up' ? '👍' : '👎'
  const ratingText = rating === 'up' ? 'Positive' : 'Negative'
  
  // Build user info section
  let userInfo = 'Anonymous user'
  if (personId) {
    userInfo = `Person ID: ${personId}`
    if (userEmail) {
      userInfo += ` (${userEmail})`
    }
  } else if (userEmail) {
    userInfo = `Email: ${userEmail} (not registered)`
  }

  // Build generation link if applicable
  // For background jobs, default to the team domain (admin access)
  let generationLink = ''
  if (generationId) {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://teamshotspro.com'
    generationLink = `\n\nView Generation: ${baseUrl}/app/generations/${generationId}`
  }

  // Build options/reasons section
  let optionsText = ''
  if (options && options.length > 0) {
    if (type === 'generation') {
      optionsText = `\n\nSelected Issues:\n${options.map(opt => `- ${opt}`).join('\n')}`
    } else if (category) {
      optionsText = `\n\nCategory: ${category}`
    }
  }

  const subject = `Feedback ${ratingText} ${ratingEmoji} - ${type === 'generation' ? 'Generation' : 'General'}`
  
  const message = `New ${ratingText.toLowerCase()} feedback received:

Feedback ID: ${feedbackId}
Type: ${type === 'generation' ? 'Generation Feedback' : 'General Feedback'}
Rating: ${ratingText} ${ratingEmoji}
Context: ${context}
${userInfo}${generationLink}${optionsText}

${comment ? `Comment:\n${comment}` : 'No comment provided'}`

  const metadata = {
    feedbackId,
    type,
    rating,
    context,
    category,
    options,
    personId,
    userEmail,
    generationId,
  }

  return await sendSupportNotificationEmail({
    subject,
    message,
    metadata,
  })
}

