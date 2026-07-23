/**
 * EV-01b — Platform probe.
 *
 * Answers "which structured catalogue endpoint, if any, does this storefront
 * expose?" so adding a source becomes a registry row rather than new code.
 * Every probe request passes the same strict robots gate as acquisition.
 *
 * This is a discovery aid, not an acquisition path — it records what a domain
 * offers; a human still records the terms decision before anything is read.
 */

import { assertUrlAllowedByRobots, RobotsPolicyError } from "../../robots-policy";
import { PLATFORM_USER_AGENT } from "./base";
import type { SourcePlatform } from "./types";

export interface PlatformProbeResult {
    platform: SourcePlatform;
    /** The endpoint that answered, when one did. */
    endpoint: string | null;
    /** Item count the endpoint reported or returned, when determinable. */
    sampleCount: number | null;
    detail: string;
}

const PROBE_TIMEOUT_MS = 15_000;

async function probe(url: string): Promise<{ status: number; body: string; headers: Headers } | null> {
    try {
        await assertUrlAllowedByRobots(url, PLATFORM_USER_AGENT);
    } catch (err) {
        if (err instanceof RobotsPolicyError) return null;
        throw err;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
    try {
        const response = await globalThis.fetch(url, {
            signal: controller.signal,
            headers: {
                Accept: "application/json, text/html;q=0.9",
                "User-Agent": PLATFORM_USER_AGENT,
            },
        });
        return {
            status: response.status,
            body: (await response.text()).slice(0, 200_000),
            headers: response.headers,
        };
    } catch {
        return null;
    } finally {
        clearTimeout(timeout);
    }
}

/**
 * Probe a storefront origin. Ordered cheapest-and-most-definitive first.
 * Returns `none` rather than guessing when nothing answers structurally.
 */
export async function detectPlatform(originUrl: string): Promise<PlatformProbeResult> {
    const origin = new URL(originUrl).origin;

    const shopifyUrl = `${origin}/products.json?limit=1`;
    const shopify = await probe(shopifyUrl);
    if (shopify && shopify.status === 200) {
        try {
            const parsed = JSON.parse(shopify.body);
            if (Array.isArray(parsed?.products)) {
                return {
                    platform: "shopify",
                    endpoint: `${origin}/products.json`,
                    sampleCount: parsed.products.length,
                    detail: "Shopify products.json returned a products array",
                };
            }
        } catch {
            // HTML behind a 200 is a themed 404 page, not a Shopify endpoint.
        }
    }

    const wooUrl = `${origin}/wp-json/wc/store/v1/products?per_page=1`;
    const woo = await probe(wooUrl);
    if (woo && woo.status === 200) {
        try {
            const parsed = JSON.parse(woo.body);
            if (Array.isArray(parsed)) {
                const total = woo.headers.get("x-wp-total");
                return {
                    platform: "woocommerce",
                    endpoint: `${origin}/wp-json/wc/store/v1/products`,
                    sampleCount: total ? Number.parseInt(total, 10) : parsed.length,
                    detail: "WooCommerce Store API returned a product array",
                };
            }
        } catch {
            // Same reasoning as above.
        }
    }

    const magento = await probe(originUrl);
    if (magento && magento.status === 200) {
        const priceAttrs = magento.body.match(/data-price-amount="/g)?.length ?? 0;
        if (priceAttrs > 0) {
            return {
                platform: "magento",
                endpoint: originUrl,
                sampleCount: priceAttrs,
                detail: `Magento price attributes present (${priceAttrs} on the probed page)`,
            };
        }
    }

    return {
        platform: "none",
        endpoint: null,
        sampleCount: null,
        detail: "No structured catalogue endpoint answered; needs another acquisition path",
    };
}
