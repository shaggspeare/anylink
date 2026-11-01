import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  Environment,
  NotificationTypeV2,
  SignedDataVerifier,
  VerificationException,
  VerificationStatus,
  type JWSTransactionDecodedPayload,
  type ResponseBodyV2DecodedPayload,
} from "@apple/app-store-server-library";
import type { PlanEvent } from "../plan";

/** Pro in App Store Connect (docs/pro-build-plan.md § What ships): two subscriptions in the group "AnyLink Pro", and a
 * non-consumable. The iOS app's ProStore and AnyLink.storekit use the same ids. */
export const PRODUCTS = {
  monthly: "com.shaggspeare.anylink.pro.monthly",
  yearly: "com.shaggspeare.anylink.pro.yearly",
  lifetime: "com.shaggspeare.anylink.pro.lifetime",
} as const;

const BUNDLE_ID = "com.shaggspeare.anylink";
const ROOTS = ["AppleRootCA-G3.cer", "AppleIncRootCertificate.cer", "AppleComputerRootCertificate.cer"];

/** The part of Apple's `SignedDataVerifier` used here, so tests can pass a stub. */
export type Verifier = Pick<
  SignedDataVerifier,
  "verifyAndDecodeTransaction" | "verifyAndDecodeRenewalInfo" | "verifyAndDecodeNotification"
>;

let roots: Buffer[] | undefined;
const verifiers = new Map<string, SignedDataVerifier>();

/** The environment signed data says it comes from, read before anything is verified. */
function claimedEnvironment(jws: string): string | undefined {
  try {
    const payload = JSON.parse(Buffer.from(jws.split(".")[1] ?? "", "base64url").toString());
    return payload.environment ?? payload.data?.environment ?? payload.summary?.environment;
  } catch {
    return undefined;
  }
}

/** A verifier for the environment `jws` claims, checked against Apple's root certificates (apple-roots/), or null
 * when that environment isn't accepted here:
 * - Production needs `APPLE_APP_ID`, the app's numeric id in App Store Connect.
 * - Sandbox always works: App Review and TestFlight buy there. `facts` labels those purchases and limits them.
 * - Xcode and LocalTesting data is signed by Xcode, not Apple, and nothing checks it, so it's accepted only by a
 *   development server (`next dev`) with `APP_STORE_ALLOW_XCODE=1`, never by a production build, previews included:
 *   they share the database.
 * The claim can't pick a weaker verifier: each one checks the environment again after verifying. */
export function appleVerifier(jws: string): Verifier | null {
  const environment = claimedEnvironment(jws);
  const appId = Number(process.env.APPLE_APP_ID) || undefined;
  if (environment === Environment.PRODUCTION && !appId) console.warn("APPLE_APP_ID isn't set: refusing Production App Store data");
  const accepted =
    environment === Environment.SANDBOX ||
    (environment === Environment.PRODUCTION && appId !== undefined) ||
    ((environment === Environment.XCODE || environment === Environment.LOCAL_TESTING) &&
      process.env.APP_STORE_ALLOW_XCODE === "1" &&
      process.env.NODE_ENV !== "production");
  if (!accepted || !environment) return null;
  let verifier = verifiers.get(environment);
  if (!verifier) {
    // Read at run time; next.config.ts traces the files into the two billing routes.
    roots ??= ROOTS.map((name) => readFileSync(join(process.cwd(), "src/lib/billing/apple-roots", name)));
    verifier = new SignedDataVerifier(roots, true, environment as Environment, BUNDLE_ID, appId);
    verifiers.set(environment, verifier);
  }
  return verifier;
}

/** How long a lifetime bought outside production (App Review, TestFlight, development) lasts, from its purchase. */
const TEST_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;

type Facts = {
  product: string;
  purchase: string;
  refundKey: string;
  until: Date | null;
  purchasedAt: Date;
  revokedAt: Date | null;
  signedAt: number;
};

/** The parts of a transaction the plan needs. Null for a product that isn't Pro, a subscription without an expiry, or
 * a transaction without ids. Outside production the product is labelled ("sandbox:…", "xcode:…"), so it never matches
 * a real purchase and those grants can be found, and a lifetime lasts a week from its purchase, however often it's
 * posted again. */
function facts(tx: JWSTransactionDecodedPayload): Facts | null {
  const id = tx.productId ?? "";
  const lifetime = id === PRODUCTS.lifetime;
  if (!lifetime && id !== PRODUCTS.monthly && id !== PRODUCTS.yearly) return null;
  if ((!lifetime && !tx.expiresDate) || !tx.transactionId || !tx.originalTransactionId) return null;
  const live = tx.environment === Environment.PRODUCTION;
  const purchasedAt = new Date(tx.purchaseDate ?? 0);
  return {
    product: live ? id : `${String(tx.environment).toLowerCase()}:${id}`,
    purchase: tx.originalTransactionId,
    refundKey: lifetime ? tx.originalTransactionId : tx.transactionId,
    until: !lifetime ? new Date(tx.expiresDate!) : live ? null : new Date(purchasedAt.getTime() + TEST_LIFETIME_MS),
    purchasedAt,
    revokedAt: tx.revocationDate ? new Date(tx.revocationDate) : null,
    signedAt: tx.signedDate ?? 0,
  };
}

type From = PlanEvent["from"];
const about = (f: Facts, from: From, signedAt: number) => ({ from, purchase: f.purchase, refundKey: f.refundKey, product: f.product, signedAt });
const grant = (f: Facts, from: From, until: Date | null, signedAt = f.signedAt, reversal = false): PlanEvent => ({
  ...about(f, from, signedAt),
  kind: "grant",
  until,
  purchasedAt: f.purchasedAt,
  ...(reversal ? { reversal } : {}),
});
const end = (f: Facts, from: From, at: Date, covered: Date | null, signedAt = f.signedAt, refund = false): PlanEvent => ({
  ...about(f, from, signedAt),
  kind: "end",
  covered,
  at,
  ...(refund ? { refund } : {}),
});

/** A verified transaction on its own: a refunded or revoked one ends Pro, any other grants it. */
export function transactionEvent(tx: JWSTransactionDecodedPayload, from: From = "app"): PlanEvent | null {
  const f = facts(tx);
  if (!f) return null;
  return f.revokedAt ? end(f, from, f.revokedAt, f.until, f.signedAt, true) : grant(f, from, f.until);
}

/** `retry`: Apple's revocation check couldn't be reached. */
export type PurchaseRefusal = "environment" | "invalid" | "retry" | "account" | "product";

/** A transaction the app sent for `userId`: after a purchase, for a renewal it saw, or on Restore. It must carry their
 * id as its `appAccountToken`, which ties a purchase to one account, so nobody can claim someone else's. */
export async function purchaseEvent(
  jws: string,
  userId: string,
  verifierFor: (jws: string) => Verifier | null = appleVerifier
): Promise<PlanEvent | PurchaseRefusal> {
  const verifier = verifierFor(jws);
  if (!verifier) return "environment";
  let tx: JWSTransactionDecodedPayload;
  try {
    tx = await verifier.verifyAndDecodeTransaction(jws);
  } catch (error) {
    const retry = error instanceof VerificationException && error.status === VerificationStatus.RETRYABLE_VERIFICATION_FAILURE;
    return retry ? "retry" : "invalid";
  }
  if (tx.appAccountToken?.toLowerCase() !== userId.toLowerCase()) return "account";
  return transactionEvent(tx) ?? "product";
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** What a verified notification does, and to which account: its transaction's `appAccountToken`. Any client can set
 * that token, so the events only touch the purchase the account is already on (`planAfter`). Null for the types
 * nothing acts on, and for purchases made without a token. */
export async function notificationEvent(
  n: ResponseBodyV2DecodedPayload,
  verifier: Verifier,
  now = new Date()
): Promise<{ userId: string; event: PlanEvent } | null> {
  if (!n.data?.signedTransactionInfo) return null;
  const tx = await verifier.verifyAndDecodeTransaction(n.data.signedTransactionInfo);
  const f = facts(tx);
  const userId = tx.appAccountToken?.toLowerCase();
  if (!f || !userId || !UUID.test(userId)) return null;
  const signedAt = n.signedDate ?? f.signedAt;
  const graceEnd = async () => {
    const signed = n.data?.signedRenewalInfo;
    const renewal = signed ? await verifier.verifyAndDecodeRenewalInfo(signed) : undefined;
    return renewal?.gracePeriodExpiresDate ? new Date(renewal.gracePeriodExpiresDate) : null;
  };

  let event: PlanEvent | null = null;
  switch (n.notificationType) {
    case NotificationTypeV2.SUBSCRIBED:
    case NotificationTypeV2.DID_RENEW:
    case NotificationTypeV2.DID_CHANGE_RENEWAL_STATUS:
    // An upgrade starts the new product at once, even when it's made outside the app.
    case NotificationTypeV2.DID_CHANGE_RENEWAL_PREF:
      event = transactionEvent(tx, "apple");
      break;
    case NotificationTypeV2.REFUND_REVERSED:
      event = grant(f, "apple", f.until, signedAt, true);
      break;
    case NotificationTypeV2.DID_FAIL_TO_RENEW: {
      // Pro until the billing grace period ends; without one, the expiry already on the account stands.
      const grace = await graceEnd();
      event = grace && grant(f, "apple", grace);
      break;
    }
    case NotificationTypeV2.EXPIRED:
      event = end(f, "apple", f.until ?? now, f.until);
      break;
    case NotificationTypeV2.GRACE_PERIOD_EXPIRED: {
      const covered = (await graceEnd()) ?? f.until;
      event = end(f, "apple", covered ?? now, covered);
      break;
    }
    case NotificationTypeV2.REFUND:
    case NotificationTypeV2.REVOKE:
      event = end(f, "apple", f.revokedAt ?? now, f.until, signedAt, true);
      break;
  }
  return event && { userId, event };
}

/** App Store Server Notifications V2. Returns the status to answer Apple with: 200 once the notification verifies,
 * whatever its type, so Apple stops resending it; 403 when it doesn't verify; 503 when Apple's revocation check
 * couldn't be reached, so Apple tries again later. If `apply` fails (the database), it throws, and the 500 makes
 * Apple resend too. */
export async function handleNotification(
  signedPayload: string,
  apply: (userId: string, event: PlanEvent) => Promise<void>,
  verifierFor: (jws: string) => Verifier | null = appleVerifier
): Promise<200 | 403 | 503> {
  const verifier = verifierFor(signedPayload);
  if (!verifier) return 403;
  let n: ResponseBodyV2DecodedPayload;
  let change: Awaited<ReturnType<typeof notificationEvent>>;
  try {
    n = await verifier.verifyAndDecodeNotification(signedPayload);
    change = await notificationEvent(n, verifier);
  } catch (error) {
    const status = error instanceof VerificationException ? error.status : error;
    console.warn("App Store notification didn't verify", status);
    return status === VerificationStatus.RETRYABLE_VERIFICATION_FAILURE ? 503 : 403;
  }
  if (!change) {
    console.info("App Store notification ignored", n.notificationType, n.subtype ?? "");
    return 200;
  }
  await apply(change.userId, change.event);
  return 200;
}
