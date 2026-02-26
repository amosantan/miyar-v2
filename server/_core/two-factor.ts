/**
 * Two-Factor Authentication (2FA) — TOTP Support (P3-4)
 *
 * Implements Time-based One-Time Password (RFC 6238) for 2FA.
 *
 * Dependencies needed: npm install otplib qrcode
 * Until installed, 2FA functionality will be disabled gracefully.
 *
 * Flow:
 *   1. User enables 2FA → generate secret + QR code
 *   2. User scans QR → verifies with 6-digit code
 *   3. On login, user must provide 6-digit code after password
 */

let otplib: any = null;
let QRCode: any = null;

try {
    otplib = require("otplib");
    QRCode = require("qrcode");
} catch {
    console.log("[2fa] otplib/qrcode not installed — 2FA disabled");
}

// ─── Setup ──────────────────────────────────────────────────────────────────

export interface TwoFactorSetup {
    secret: string;
    otpauthUrl: string;
    qrCodeDataUrl: string;
}

/**
 * Generate a new 2FA secret and QR code for a user.
 */
export async function generateTwoFactorSetup(
    userEmail: string,
): Promise<TwoFactorSetup | null> {
    if (!otplib || !QRCode) return null;

    const secret = otplib.authenticator.generateSecret();
    const otpauthUrl = otplib.authenticator.keyuri(userEmail, "MIYAR", secret);

    const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);

    return { secret, otpauthUrl, qrCodeDataUrl };
}

// ─── Verification ───────────────────────────────────────────────────────────

/**
 * Verify a TOTP code against the stored secret.
 * Returns true if the code is valid within the time window.
 */
export function verifyTwoFactorCode(secret: string, code: string): boolean {
    if (!otplib) return false;

    try {
        return otplib.authenticator.verify({ token: code, secret });
    } catch {
        return false;
    }
}

// ─── Recovery Codes ─────────────────────────────────────────────────────────

/**
 * Generate a set of one-time recovery codes.
 * These should be hashed before storage.
 */
export function generateRecoveryCodes(count: number = 8): string[] {
    const codes: string[] = [];
    for (let i = 0; i < count; i++) {
        const code = Array.from({ length: 8 }, () =>
            Math.random().toString(36).charAt(2),
        ).join("").toUpperCase();
        // Format as XXXX-XXXX
        codes.push(`${code.substring(0, 4)}-${code.substring(4, 8)}`);
    }
    return codes;
}

// ─── Status Check ───────────────────────────────────────────────────────────

/**
 * Check if 2FA is available (dependencies installed).
 */
export function isTwoFactorAvailable(): boolean {
    return otplib !== null && QRCode !== null;
}
