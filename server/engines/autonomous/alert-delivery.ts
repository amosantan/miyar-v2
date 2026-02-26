/**
 * MIYAR Alert Delivery — Email via Resend
 *
 * Delivers critical and high severity alerts via email.
 * Gracefully degrades if RESEND_API_KEY is not configured.
 */

import type { InsertPlatformAlert as Alert } from "../../../drizzle/schema";

const RESEND_API_URL = "https://api.resend.com/emails";

interface DeliveryResult {
    delivered: boolean;
    channel: "email" | "skipped";
    error?: string;
}

/**
 * Deliver an alert via email using the Resend API.
 * Only sends for critical and high severity alerts.
 */
export async function deliverAlert(alert: Alert & { id?: number }): Promise<DeliveryResult> {
    const apiKey = process.env.RESEND_API_KEY;
    const recipientEmail = process.env.ALERT_RECIPIENT_EMAIL || process.env.ADMIN_EMAIL;

    // Graceful degradation — skip if no API key or recipient
    if (!apiKey) {
        console.log("[AlertDelivery] RESEND_API_KEY not set, skipping email delivery");
        return { delivered: false, channel: "skipped" };
    }

    if (!recipientEmail) {
        console.log("[AlertDelivery] No ALERT_RECIPIENT_EMAIL or ADMIN_EMAIL set, skipping");
        return { delivered: false, channel: "skipped" };
    }

    // Only send emails for critical and high severity
    if (alert.severity !== "critical" && alert.severity !== "high") {
        return { delivered: false, channel: "skipped" };
    }

    const severityEmoji = alert.severity === "critical" ? "🔴" : "🟠";
    const severityLabel = alert.severity.toUpperCase();

    const htmlBody = `
    <div style="font-family: 'Inter', -apple-system, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #0d1117, #161b22); padding: 24px; border-radius: 12px 12px 0 0;">
        <h1 style="color: #e6edf3; margin: 0; font-size: 20px;">
          ${severityEmoji} MIYAR Alert — ${severityLabel}
        </h1>
      </div>
      <div style="background: #ffffff; padding: 24px; border: 1px solid #d0d7de; border-top: none; border-radius: 0 0 12px 12px;">
        <h2 style="color: #1f2328; margin-top: 0;">${alert.title}</h2>
        <p style="color: #656d76; line-height: 1.6;">${alert.body || ""}</p>
        
        ${alert.suggestedAction ? `
          <div style="background: #f6f8fa; border-left: 4px solid #0969da; padding: 12px 16px; margin: 16px 0; border-radius: 0 6px 6px 0;">
            <strong style="color: #1f2328;">Suggested Action:</strong>
            <p style="color: #656d76; margin: 4px 0 0;">${alert.suggestedAction}</p>
          </div>
        ` : ""}
        
        <p style="color: #656d76; font-size: 12px; margin-top: 24px;">
          Alert Type: <code>${alert.alertType}</code> · 
          Generated: ${new Date().toISOString()}
        </p>
      </div>
    </div>
  `;

    try {
        const response = await fetch(RESEND_API_URL, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                from: "MIYAR Alerts <alerts@miyar.ai>",
                to: [recipientEmail],
                subject: `${severityEmoji} [${severityLabel}] ${alert.title}`,
                html: htmlBody,
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[AlertDelivery] Resend API error (${response.status}):`, errorText);
            return { delivered: false, channel: "email", error: errorText };
        }

        const result = await response.json();
        console.log(`[AlertDelivery] Email sent successfully (ID: ${result.id}) for alert: ${alert.title}`);
        return { delivered: true, channel: "email" };
    } catch (error: any) {
        console.error("[AlertDelivery] Failed to send email:", error.message);
        return { delivered: false, channel: "email", error: error.message };
    }
}
