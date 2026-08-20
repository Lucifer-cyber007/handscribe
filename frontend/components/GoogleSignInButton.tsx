"use client";

import { useRouter } from "next/navigation";
import Script from "next/script";
import { useEffect, useRef } from "react";
import { useToast } from "@/components/Toast";
import { ApiError, googleSignIn } from "@/lib/api";
import { useAuth } from "@/lib/auth";

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential: string }) => void;
          }) => void;
          renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void;
        };
      };
    };
  }
}

/** Renders nothing if NEXT_PUBLIC_GOOGLE_CLIENT_ID isn't set — Google
 * sign-in is optional, email/password auth works regardless. */
export default function GoogleSignInButton() {
  const buttonRef = useRef<HTMLDivElement>(null);
  const { login } = useAuth();
  const { showToast } = useToast();
  const router = useRouter();
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  useEffect(() => {
    if (!clientId) return;
    let cancelled = false;

    const tryInitialize = (): boolean => {
      if (cancelled || !buttonRef.current || !window.google) return false;
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: async (response) => {
          try {
            const result = await googleSignIn(response.credential);
            login(result.access_token, result.user);
            router.push("/tools");
          } catch (err) {
            showToast(err instanceof ApiError ? err.message : "Google sign-in failed.", "error");
          }
        },
      });
      window.google.accounts.id.renderButton(buttonRef.current, {
        theme: "outline",
        size: "large",
        width: 320,
      });
      return true;
    };

    // The gsi script's own onLoad only fires once per page load — in this
    // single-page app, navigating between /login, /signup, or back here
    // after logging out remounts this component without the script
    // reloading, so onLoad alone would miss those cases. Poll briefly
    // instead: this covers both a fresh script load and one that was
    // already loaded by an earlier page in the same session.
    if (tryInitialize()) return;
    const interval = setInterval(() => {
      if (tryInitialize()) clearInterval(interval);
    }, 100);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [clientId, login, router, showToast]);

  if (!clientId) return null;

  return (
    <>
      <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" />
      <div ref={buttonRef} />
    </>
  );
}
