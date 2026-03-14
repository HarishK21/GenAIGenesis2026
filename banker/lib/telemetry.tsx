"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import { usePathname } from "next/navigation";

import { SessionSummary, TelemetryEvent } from "@/lib/types";

type ConsentStatus = "unknown" | "accepted" | "declined";

interface TypingStats {
  chars: number;
  intervals: number[];
  lastKeyAt?: number;
}

interface TelemetryContextValue {
  consentStatus: ConsentStatus;
  sessionId: string;
  setConsentStatus: (value: ConsentStatus) => void;
  recordHesitation: (reason: string) => void;
  markReviewTransfer: (metadata?: Record<string, unknown>) => void;
  markSubmitTransfer: (transferAmount: number, metadata?: Record<string, unknown>) => SessionSummary | null;
  isTelemetryEnabled: boolean;
}

const TelemetryContext = createContext<TelemetryContextValue | null>(null);
const CONSENT_KEY = "northmaple-consent";

function generateSessionId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `demo-${Date.now()}`;
}

function mapPathToPage(pathname: string) {
  if (pathname === "/") {
    return "Home";
  }

  return pathname
    .replace(/\//g, " ")
    .trim()
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

export function TelemetryProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [consentStatus, setConsentState] = useState<ConsentStatus>("unknown");
  const [sessionId] = useState(generateSessionId);
  const pageName = mapPathToPage(pathname);

  const queueRef = useRef<TelemetryEvent[]>([]);
  const pageStartRef = useRef(Date.now());
  const sessionStartRef = useRef(Date.now());
  const firstClickAtRef = useRef<number | null>(null);
  const currentPageRef = useRef(pageName);
  const clickCountRef = useRef(0);
  const clickSequenceRef = useRef<string[]>([]);
  const typingRef = useRef<Record<string, TypingStats>>({});
  const correctionCountRef = useRef(0);
  const hesitationCountRef = useRef(0);
  const focusChangesRef = useRef(0);
  const lastFocusedFieldRef = useRef<string | null>(null);
  const lastClickRef = useRef<{ elementId?: string; at: number } | null>(null);
  const rapidNavFlagRef = useRef(false);
  const lastPageChangeAtRef = useRef<number | null>(null);
  const lastNavClickAtRef = useRef<number | null>(null);
  const mouseRef = useRef({
    distance: 0,
    directionChanges: 0,
    lastX: 0,
    lastY: 0,
    lastAngle: 0,
    lastMoveAt: 0
  });
  const areaPathRef = useRef<string[]>([]);
  const currentAreaRef = useRef<string | null>(null);
  const reviewStartedAtRef = useRef<number | null>(null);
  const submittedAmountsRef = useRef<number[]>([]);

  const isTelemetryEnabled = consentStatus === "accepted";

  const flush = useCallback(async () => {
    if (!queueRef.current.length) {
      return;
    }

    const batch = [...queueRef.current];
    queueRef.current = [];

    try {
      // This is where the fictional banking site forwards behavior signals to the fraud dashboard.
      await fetch(process.env.NEXT_PUBLIC_TELEMETRY_ENDPOINT ?? "/api/telemetry", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          source: "northmaple-bank-demo",
          sentAt: new Date().toISOString(),
          events: batch
        }),
        keepalive: true
      });
    } catch (error) {
      if (process.env.NODE_ENV !== "production") {
        console.info("[telemetry] unable to send demo batch", batch, error);
      }
    }
  }, []);

  const enqueue = useCallback(
    (
      eventType: TelemetryEvent["eventType"],
      options: {
        elementId?: string;
        page?: string;
        metadata?: Record<string, unknown>;
      } = {}
    ) => {
      if (!isTelemetryEnabled) {
        return;
      }

      queueRef.current.push({
        sessionId,
        eventType,
        page: options.page ?? currentPageRef.current,
        elementId: options.elementId,
        timestamp: new Date().toISOString(),
        metadata: options.metadata
      });
    },
    [isTelemetryEnabled, sessionId]
  );

  const calculateAverageTypingSpeed = useCallback(() => {
    const stats = Object.values(typingRef.current);
    const chars = stats.reduce((total, field) => total + field.chars, 0);
    const totalIntervalMs = stats.reduce(
      (total, field) => total + field.intervals.reduce((sum, current) => sum + current, 0),
      0
    );

    if (!chars || !totalIntervalMs) {
      return 0;
    }

    return Number(((chars / totalIntervalMs) * 1000).toFixed(2));
  }, []);

  const isUnusualAmount = useCallback((amount: number) => {
    if (!submittedAmountsRef.current.length) {
      return amount >= 1200;
    }

    const baseline =
      submittedAmountsRef.current.reduce((sum, current) => sum + current, 0) /
      submittedAmountsRef.current.length;

    return amount >= baseline * 1.8;
  }, []);

  const markReviewTransfer = useCallback(
    (metadata?: Record<string, unknown>) => {
      reviewStartedAtRef.current = Date.now();
      enqueue("review_transfer", {
        elementId: "transfer-review",
        metadata
      });
      void flush();
    },
    [enqueue, flush]
  );

  const markSubmitTransfer = useCallback(
    (transferAmount: number, metadata?: Record<string, unknown>) => {
      if (!isTelemetryEnabled) {
        return null;
      }

      const now = Date.now();
      const submitDelayMs = reviewStartedAtRef.current ? now - reviewStartedAtRef.current : 0;
      const summary: SessionSummary = {
        sessionId,
        totalSessionDuration: now - sessionStartRef.current,
        clickCount: clickCountRef.current,
        avgTypingSpeed: calculateAverageTypingSpeed(),
        correctionCount: correctionCountRef.current,
        hesitationCount: hesitationCountRef.current,
        unusualAmountFlag: isUnusualAmount(transferAmount),
        erraticMouseFlag:
          mouseRef.current.directionChanges >= 14 || mouseRef.current.distance >= 4200,
        rapidNavFlag: rapidNavFlagRef.current,
        submitDelayMs,
        focusChanges: focusChangesRef.current,
        transferAmount,
        majorClickSequence: clickSequenceRef.current.slice(-8),
        areaPath: areaPathRef.current.slice(-8)
      };

      enqueue("submit_transfer", {
        elementId: "transfer-submit",
        metadata: {
          transferAmount,
          submitDelayMs,
          ...metadata
        }
      });
      enqueue("session_summary", {
        elementId: "transfer-session-summary",
        metadata: { ...summary }
      });
      submittedAmountsRef.current.push(transferAmount);
      reviewStartedAtRef.current = null;
      void flush();

      return summary;
    },
    [calculateAverageTypingSpeed, enqueue, flush, isTelemetryEnabled, isUnusualAmount, sessionId]
  );

  const recordHesitation = useCallback(
    (reason: string) => {
      if (!isTelemetryEnabled) {
        return;
      }

      hesitationCountRef.current += 1;
      enqueue("hesitation_detected", {
        elementId: "transfer-form",
        metadata: {
          reason,
          count: hesitationCountRef.current
        }
      });
    },
    [enqueue, isTelemetryEnabled]
  );

  useEffect(() => {
    const savedConsent = window.localStorage.getItem(CONSENT_KEY) as ConsentStatus | null;

    if (savedConsent === "accepted" || savedConsent === "declined") {
      setConsentState(savedConsent);
    }
  }, []);

  const setConsentStatus = useCallback((value: ConsentStatus) => {
    setConsentState(value);
    window.localStorage.setItem(CONSENT_KEY, value);
  }, []);

  useEffect(() => {
    if (!isTelemetryEnabled) {
      return;
    }

    const now = Date.now();
    const previousPage = currentPageRef.current;

    if (
      lastPageChangeAtRef.current &&
      previousPage !== pageName &&
      now - lastPageChangeAtRef.current <= 1500
    ) {
      rapidNavFlagRef.current = true;
      enqueue("rapid_navigation", {
        metadata: {
          from: previousPage,
          to: pageName,
          deltaMs: now - lastPageChangeAtRef.current
        }
      });
    }

    currentPageRef.current = pageName;
    pageStartRef.current = now;
    firstClickAtRef.current = null;
    lastPageChangeAtRef.current = now;
    enqueue("page_view", { page: pageName });
  }, [enqueue, isTelemetryEnabled, pageName]);

  useEffect(() => {
    if (!isTelemetryEnabled) {
      return;
    }

    return () => {
      const dwellMs = Date.now() - pageStartRef.current;
      enqueue("page_dwell", {
        page: currentPageRef.current,
        metadata: {
          dwellMs,
          timeBeforeFirstClickMs: firstClickAtRef.current
            ? firstClickAtRef.current - pageStartRef.current
            : null
        }
      });
      void flush();
    };
  }, [enqueue, flush, isTelemetryEnabled, pathname]);

  useEffect(() => {
    if (!isTelemetryEnabled) {
      return;
    }

    const timer = window.setInterval(() => {
      void flush();
    }, 4000);

    const handleVisibility = () => {
      if (document.visibilityState === "hidden") {
        void flush();
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("beforeunload", handleVisibility);

    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("beforeunload", handleVisibility);
    };
  }, [flush, isTelemetryEnabled]);

  useEffect(() => {
    if (!isTelemetryEnabled) {
      return;
    }

    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const tagged = target?.closest<HTMLElement>("[data-telemetry-id]");
      if (!tagged) {
        return;
      }

      const elementId = tagged.dataset.telemetryId;
      const eventType = (tagged.dataset.telemetryEvent as TelemetryEvent["eventType"] | undefined) ??
        (elementId?.startsWith("nav-") ? "nav_click" : "ui_click");
      const now = Date.now();

      clickCountRef.current += 1;

      if (elementId) {
        clickSequenceRef.current.push(elementId);
      }

      if (!firstClickAtRef.current) {
        firstClickAtRef.current = now;
        enqueue("first_click", {
          elementId,
          metadata: {
            timeBeforeFirstClickMs: now - pageStartRef.current
          }
        });
      }

      if (
        lastClickRef.current?.elementId &&
        lastClickRef.current.elementId === elementId &&
        now - lastClickRef.current.at <= 650
      ) {
        enqueue("rapid_repeat_click", {
          elementId,
          metadata: {
            deltaMs: now - lastClickRef.current.at
          }
        });
      }

      lastClickRef.current = { elementId, at: now };

      if (eventType === "nav_click") {
        lastNavClickAtRef.current = now;
      }

      enqueue(eventType, {
        elementId,
        metadata: {
          area: tagged.dataset.telemetryArea,
          sidebarToActionMs:
            tagged.dataset.telemetryRole === "primary-cta" && lastNavClickAtRef.current
              ? now - lastNavClickAtRef.current
              : undefined
        }
      });
    };

    const handleFocus = (event: FocusEvent) => {
      const target = event.target as HTMLElement | null;
      const tagged = target?.closest<HTMLElement>("[data-telemetry-field]");
      if (!tagged) {
        return;
      }

      const field = tagged.dataset.telemetryField ?? "unknown";
      if (lastFocusedFieldRef.current && lastFocusedFieldRef.current !== field) {
        focusChangesRef.current += 1;
      }
      lastFocusedFieldRef.current = field;

      enqueue("transfer_field_focus", {
        elementId: field,
        metadata: {
          focusChanges: focusChangesRef.current
        }
      });
    };

    const handleKeydown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tagged = target?.closest<HTMLElement>("[data-telemetry-field]");
      if (!tagged) {
        return;
      }

      const field = tagged.dataset.telemetryField ?? "unknown";
      const stats = typingRef.current[field] ?? { chars: 0, intervals: [] };
      const now = Date.now();

      if (stats.lastKeyAt) {
        stats.intervals.push(now - stats.lastKeyAt);
      }

      if (event.key === "Backspace") {
        correctionCountRef.current += 1;
      } else if (event.key.length === 1) {
        stats.chars += 1;
      }

      stats.lastKeyAt = now;
      typingRef.current[field] = stats;
    };

    const handleInput = (event: Event) => {
      const target = event.target as HTMLInputElement | HTMLTextAreaElement | null;
      if (!target) {
        return;
      }

      const field = target.dataset.telemetryField;
      if (field !== "amount") {
        return;
      }

      const amount = Number(target.value);
      if (!Number.isFinite(amount)) {
        return;
      }

      enqueue("transfer_amount_change", {
        elementId: "amount",
        metadata: {
          transferAmount: amount,
          unusualAmountFlag: isUnusualAmount(amount)
        }
      });
    };

    const handleMousemove = (event: MouseEvent) => {
      const now = Date.now();
      if (now - mouseRef.current.lastMoveAt < 80) {
        return;
      }

      if (mouseRef.current.lastX && mouseRef.current.lastY) {
        const deltaX = event.clientX - mouseRef.current.lastX;
        const deltaY = event.clientY - mouseRef.current.lastY;
        mouseRef.current.distance += Math.hypot(deltaX, deltaY);

        const angle = Math.atan2(deltaY, deltaX);
        if (Math.abs(angle - mouseRef.current.lastAngle) > Math.PI / 2) {
          mouseRef.current.directionChanges += 1;
        }
        mouseRef.current.lastAngle = angle;
      }

      mouseRef.current.lastX = event.clientX;
      mouseRef.current.lastY = event.clientY;
      mouseRef.current.lastMoveAt = now;
    };

    const handlePointerOver = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;
      const area = target?.closest<HTMLElement>("[data-telemetry-area]")?.dataset.telemetryArea;

      if (!area || currentAreaRef.current === area) {
        return;
      }

      const previous = currentAreaRef.current;
      currentAreaRef.current = area;
      areaPathRef.current.push(area);

      enqueue("area_transition", {
        elementId: area,
        metadata: {
          from: previous,
          to: area,
          totalDistance: Math.round(mouseRef.current.distance)
        }
      });
    };

    document.addEventListener("click", handleClick, true);
    document.addEventListener("focusin", handleFocus, true);
    document.addEventListener("keydown", handleKeydown, true);
    document.addEventListener("input", handleInput, true);
    window.addEventListener("mousemove", handleMousemove, { passive: true });
    document.addEventListener("pointerover", handlePointerOver, true);

    return () => {
      document.removeEventListener("click", handleClick, true);
      document.removeEventListener("focusin", handleFocus, true);
      document.removeEventListener("keydown", handleKeydown, true);
      document.removeEventListener("input", handleInput, true);
      window.removeEventListener("mousemove", handleMousemove);
      document.removeEventListener("pointerover", handlePointerOver, true);
    };
  }, [enqueue, flush, isTelemetryEnabled, isUnusualAmount]);

  const contextValue = useMemo<TelemetryContextValue>(
    () => ({
      consentStatus,
      sessionId,
      setConsentStatus,
      recordHesitation,
      markReviewTransfer,
      markSubmitTransfer,
      isTelemetryEnabled
    }),
    [
      consentStatus,
      isTelemetryEnabled,
      markReviewTransfer,
      markSubmitTransfer,
      recordHesitation,
      sessionId,
      setConsentStatus
    ]
  );

  return <TelemetryContext.Provider value={contextValue}>{children}</TelemetryContext.Provider>;
}

export function useTelemetry() {
  const context = useContext(TelemetryContext);

  if (!context) {
    throw new Error("useTelemetry must be used within the TelemetryProvider.");
  }

  return context;
}
