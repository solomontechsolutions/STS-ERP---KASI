"use client";

import { useEffect, useRef, useState } from "react";
import { Video, PhoneOff } from "lucide-react";
import { recordJoinAction } from "@/lib/actions/meetings";

type JitsiApi = {
  addListener: (event: string, fn: () => void) => void;
  dispose: () => void;
};
type JitsiCtor = new (domain: string, options: Record<string, unknown>) => JitsiApi;

declare global {
  interface Window {
    JitsiMeetExternalAPI?: JitsiCtor;
  }
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.JitsiMeetExternalAPI) return resolve();
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("Meeting service failed to load")));
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Meeting service failed to load"));
    document.body.appendChild(script);
  });
}

/**
 * Embedded video room. Nothing starts until the user taps Join, so opening
 * the meeting page never switches on a camera by surprise. Joining records
 * attendance for the minutes.
 */
export function MeetingRoom({
  meetingId,
  domain,
  scriptUrl,
  roomName,
  jwt,
  displayName,
  email,
  subject,
}: {
  meetingId: string;
  domain: string;
  scriptUrl: string;
  roomName: string;
  jwt: string | null;
  displayName: string;
  email: string;
  subject: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<JitsiApi | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "live" | "left" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => () => apiRef.current?.dispose(), []);

  async function join() {
    setState("loading");
    setError(null);
    try {
      await loadScript(scriptUrl);
      if (!window.JitsiMeetExternalAPI || !containerRef.current) throw new Error("Meeting service unavailable");
      const api = new window.JitsiMeetExternalAPI(domain, {
        roomName,
        jwt: jwt ?? undefined,
        parentNode: containerRef.current,
        width: "100%",
        height: "100%",
        userInfo: { displayName, email },
        configOverwrite: {
          subject,
          prejoinPageEnabled: true,
          disableDeepLinking: true, // stay in the browser/PWA on phones
          startWithAudioMuted: true,
          fileRecordingsEnabled: false,
          liveStreamingEnabled: false,
          transcription: { enabled: false },
        },
        interfaceConfigOverwrite: { MOBILE_APP_PROMO: false, SHOW_JITSI_WATERMARK: false },
      });
      apiRef.current = api;
      api.addListener("videoConferenceJoined", () => {
        setState("live");
        void recordJoinAction(meetingId);
      });
      api.addListener("readyToClose", () => {
        api.dispose();
        apiRef.current = null;
        setState("left");
      });
      setState("live");
    } catch (e) {
      setState("error");
      setError(e instanceof Error ? e.message : "Could not start the meeting.");
    }
  }

  function leave() {
    apiRef.current?.dispose();
    apiRef.current = null;
    setState("left");
  }

  const active = state === "loading" || state === "live";

  return (
    <div className="space-y-3">
      <div
        ref={containerRef}
        className={active ? "h-[75vh] min-h-[420px] w-full overflow-hidden rounded-lg border border-border bg-black" : "hidden"}
      />
      {active ? (
        <button
          type="button"
          onClick={leave}
          className="inline-flex items-center gap-2 rounded-md bg-status-danger px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          <PhoneOff className="h-4 w-4" /> Leave meeting
        </button>
      ) : (
        <div className="rounded-lg border border-border bg-surface p-6 text-center">
          <Video className="mx-auto h-8 w-8 text-primary" strokeWidth={1.5} />
          <p className="mt-2 text-sm text-muted-foreground">
            {state === "left"
              ? "You have left the meeting."
              : "You will see a preview to check your camera and microphone before entering."}
          </p>
          <button
            type="button"
            onClick={join}
            className="mt-4 inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            <Video className="h-4 w-4" /> {state === "left" ? "Rejoin" : "Join meeting"}
          </button>
          {error && <p className="mt-3 text-sm text-status-danger">{error}</p>}
        </div>
      )}
    </div>
  );
}
