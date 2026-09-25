"use client";

import type {
  AuthenticationResponseJSON,
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
  RegistrationResponseJSON,
} from "@simplewebauthn/types";

/**
 * Browser half of passkeys: turns the server's JSON options into the
 * binary form navigator.credentials expects, and the device's answer back
 * into JSON. Mirrors @simplewebauthn/browser v9, which pairs with the v9
 * server package (user IDs travel as UTF-8 text, everything else as
 * base64url).
 */

function fromB64url(value: string): ArrayBuffer {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

function toB64url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function passkeysSupported(): boolean {
  return typeof window !== "undefined" && "PublicKeyCredential" in window && !!navigator.credentials;
}

/** True when the device has Face ID, Touch ID, a fingerprint reader, Windows Hello or a PIN set up. */
export async function deviceUnlockAvailable(): Promise<boolean> {
  if (!passkeysSupported()) return false;
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

/** Plain-language reason a passkey prompt failed, or null if the person just cancelled. */
export function describePasskeyError(error: unknown): string | null {
  const name = (error as { name?: string })?.name;
  if (name === "NotAllowedError" || name === "AbortError") return null;
  if (name === "InvalidStateError") return "This device is already set up for your account.";
  if (name === "SecurityError") return "Passkeys only work on the KASI web address (https).";
  return error instanceof Error ? error.message : "The device could not complete the request.";
}

export async function createPasskey(
  options: PublicKeyCredentialCreationOptionsJSON,
): Promise<RegistrationResponseJSON> {
  const credential = (await navigator.credentials.create({
    publicKey: {
      ...options,
      challenge: fromB64url(options.challenge),
      user: { ...options.user, id: new TextEncoder().encode(options.user.id) },
      excludeCredentials: options.excludeCredentials?.map((c) => ({
        ...c,
        id: fromB64url(c.id),
        transports: c.transports as AuthenticatorTransport[] | undefined,
      })),
    },
  })) as PublicKeyCredential | null;
  if (!credential) throw new Error("No passkey was created.");

  const response = credential.response as AuthenticatorAttestationResponse;
  return {
    id: credential.id,
    rawId: toB64url(credential.rawId),
    type: "public-key",
    authenticatorAttachment: (credential.authenticatorAttachment ?? undefined) as RegistrationResponseJSON["authenticatorAttachment"],
    clientExtensionResults: credential.getClientExtensionResults(),
    response: {
      clientDataJSON: toB64url(response.clientDataJSON),
      attestationObject: toB64url(response.attestationObject),
      transports: (response.getTransports?.() ?? []) as RegistrationResponseJSON["response"]["transports"],
    },
  };
}

export async function assertPasskey(
  options: PublicKeyCredentialRequestOptionsJSON,
): Promise<AuthenticationResponseJSON> {
  const credential = (await navigator.credentials.get({
    publicKey: {
      ...options,
      challenge: fromB64url(options.challenge),
      allowCredentials: options.allowCredentials?.map((c) => ({
        ...c,
        id: fromB64url(c.id),
        transports: c.transports as AuthenticatorTransport[] | undefined,
      })),
    },
  })) as PublicKeyCredential | null;
  if (!credential) throw new Error("No passkey was used.");

  const response = credential.response as AuthenticatorAssertionResponse;
  return {
    id: credential.id,
    rawId: toB64url(credential.rawId),
    type: "public-key",
    authenticatorAttachment: (credential.authenticatorAttachment ?? undefined) as AuthenticationResponseJSON["authenticatorAttachment"],
    clientExtensionResults: credential.getClientExtensionResults(),
    response: {
      clientDataJSON: toB64url(response.clientDataJSON),
      authenticatorData: toB64url(response.authenticatorData),
      signature: toB64url(response.signature),
      userHandle: response.userHandle ? new TextDecoder().decode(response.userHandle) : undefined,
    },
  };
}
