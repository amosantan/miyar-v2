/**
 * MIYAR Webhook Dispatch Engine
 * Sends event payloads to configured webhook endpoints.
 */

import { getActiveWebhookConfigs, updateWebhookConfig } from "../db";
import crypto from "crypto";

export interface WebhookPayload {
  event: string;
  timestamp: string;
  data: Record<string, any>;
}

function signPayload(payload: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

function applyFieldMapping(data: Record<string, any>, mapping: Record<string, string> | null): Record<string, any> {
  if (!mapping) return data;
  const mapped: Record<string, any> = {};
  for (const [miyarField, crmField] of Object.entries(mapping)) {
    if (data[miyarField] !== undefined) {
      mapped[crmField] = data[miyarField];
    }
  }
  // Include unmapped fields as-is
  for (const [key, value] of Object.entries(data)) {
    if (!mapping[key]) {
      mapped[key] = value;
    }
  }
  return mapped;
}

export async function dispatchWebhook(event: string, data: Record<string, any>): Promise<{ sent: number; failed: number; results: Array<{ webhookId: number; status: number | null; error?: string }> }> {
  const configs = await getActiveWebhookConfigs(event);
  const results: Array<{ webhookId: number; status: number | null; error?: string }> = [];
  let sent = 0;
  let failed = 0;

  for (const config of configs) {
    const payload: WebhookPayload = {
      event,
      timestamp: new Date().toISOString(),
      data: applyFieldMapping(data, config.fieldMapping as Record<string, string> | null),
    };

    const body = JSON.stringify(payload);
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-MIYAR-Event": event,
      "X-MIYAR-Timestamp": payload.timestamp,
    };

    if (config.secret) {
      headers["X-MIYAR-Signature"] = signPayload(body, config.secret);
    }

    try {
      const url = typeof config.url === "string" ? config.url : "";
      const response = await fetch(url, {
        method: "POST",
        headers,
        body,
        signal: AbortSignal.timeout(10000),
      });

      await updateWebhookConfig(config.id, {
        lastTriggeredAt: new Date(),
        lastStatus: response.status,
      });

      if (response.ok) {
        sent++;
        results.push({ webhookId: config.id, status: response.status });
      } else {
        failed++;
        results.push({ webhookId: config.id, status: response.status, error: `HTTP ${response.status}` });
      }
    } catch (err: any) {
      failed++;
      await updateWebhookConfig(config.id, {
        lastTriggeredAt: new Date(),
        lastStatus: 0,
      });
      results.push({ webhookId: config.id, status: null, error: err.message });
    }
  }

  return { sent, failed, results };
}
