import { useState, useEffect, useRef, useCallback } from "react";
import { getLiveData, getHistoryData, pingBackend, fetchThingSpeakLive } from "../services/api";

export interface LiveDataResult {
  timestamp: string;
  temperature: number;
  humidity: number;
  pm25: number;
  tvoc: number;
  no2: number;
  co: number;
  aqi: number;
  aqi_category: string;
  aqi_color?: string;
  source_detected: string;
  _source?: "backend" | "thingspeak";
  status?: string;
}

export function useLiveData() {
  const [data, setData] = useState<LiveDataResult | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const cached = sessionStorage.getItem("aeronyx_last_reading");
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadingStep, setLoadingStep] = useState("init");
  const [backendStatus, setBackendStatus] = useState("checking"); // 'checking'|'online'|'waking'|'offline'
  const dataRef = useRef<LiveDataResult | null>(null);
  dataRef.current = data;

  // Step 1: Load ThingSpeak immediately so dashboard is never blank
  useEffect(() => {
    setLoadingStep("connecting");
    fetchThingSpeakLive()
      .then((ts) => {
        if (ts) {
          setData((prev) => (prev ? prev : { ...ts, _source: "thingspeak" }));
          try {
            sessionStorage.setItem("aeronyx_last_reading", JSON.stringify({ ...ts, _source: "thingspeak" }));
          } catch {}
        }
      })
      .catch(() => {})
      .finally(() => {
        setLoading(false);
        setLoadingStep("done");
      });
  }, []);

  // Step 2: Wake backend and upgrade data once it's ready
  useEffect(() => {
    let cancelled = false;
    let wakeTimer: NodeJS.Timeout;

    async function wakeAndUpgrade() {
      setBackendStatus("checking");
      const alive = await pingBackend();
      if (cancelled) return;

      if (alive) {
        setBackendStatus("online");
        try {
          const result = await getLiveData();
          if (!cancelled && result && result._source === "backend") {
            setData(result);
            try {
              sessionStorage.setItem("aeronyx_last_reading", JSON.stringify(result));
            } catch {}
          }
        } catch {}
        return;
      }

      setBackendStatus("waking");
      let attempts = 0;
      const poll = async () => {
        if (cancelled) return;
        attempts++;
        const up = await pingBackend();
        if (up && !cancelled) {
          setBackendStatus("online");
          try {
            const result = await getLiveData();
            if (!cancelled && result && result._source === "backend") {
              setData(result);
              try {
                sessionStorage.setItem("aeronyx_last_reading", JSON.stringify(result));
              } catch {}
            }
          } catch {}
        } else if (attempts < 15 && !cancelled) {
          wakeTimer = setTimeout(poll, 8000);
        } else if (!cancelled) {
          setBackendStatus("offline");
        }
      };
      wakeTimer = setTimeout(poll, 8000);
    }

    wakeAndUpgrade();
    return () => {
      cancelled = true;
      clearTimeout(wakeTimer);
    };
  }, []);

  const fetchData = useCallback(async () => {
    try {
      setLoadingStep("fetching");
      const result = await getLiveData();
      if (result) {
        setData(result);
        if (result._source === "backend") setBackendStatus("online");
        try {
          sessionStorage.setItem("aeronyx_last_reading", JSON.stringify(result));
        } catch {}
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
      setLoadingStep("done");
    }
  }, []);

  useEffect(() => {
    // Polling every 30s as a fallback for standard websocket
    const interval = setInterval(fetchData, 30000);
    return () => {
      clearInterval(interval);
    };
  }, [fetchData]);

  return { data, loading, error, loadingStep, backendStatus, refetch: fetchData };
}

export function useHistoryData(results = 200) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetch() {
      try {
        const history = await getHistoryData(results);
        setData(history);
      } catch {
        setData([]);
      } finally {
        setLoading(false);
      }
    }
    fetch();
    const interval = setInterval(fetch, 60000);
    return () => clearInterval(interval);
  }, [results]);

  return { data, loading };
}

export function useTimeAgo(timestamp: string) {
  const [timeAgo, setTimeAgo] = useState("");

  useEffect(() => {
    if (!timestamp) return;

    function update() {
      const now = new Date();
      const then = new Date(timestamp);
      const seconds = Math.floor((now.getTime() - then.getTime()) / 1000);

      if (seconds < 10) setTimeAgo("just now");
      else if (seconds < 60) setTimeAgo(`${seconds}s ago`);
      else if (seconds < 3600) setTimeAgo(`${Math.floor(seconds / 60)}m ago`);
      else if (seconds < 86400) setTimeAgo(`${Math.floor(seconds / 3600)}h ago`);
      else setTimeAgo(`${Math.floor(seconds / 86400)}d ago`);
    }

    update();
    const interval = setInterval(update, 5000);
    return () => clearInterval(interval);
  }, [timestamp]);

  return timeAgo;
}
