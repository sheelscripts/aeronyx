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

export function useLiveData(
  customSource?: string,
  customWaqiToken?: string,
  customThingspeakChannel?: string,
  customThingspeakKey?: string
) {
  const [source, setSource] = useState("real_api");
  const [waqiToken, setWaqiToken] = useState("2762cbe0240a9a00d82cc8e635b8fb10c02cee70");
  const [thingspeakChannel, setThingspeakChannel] = useState("3418865");
  const [thingspeakKey, setThingspeakKey] = useState("HZMI1LP3UUHK2S7O");

  const [data, setData] = useState<LiveDataResult | null>(null);

  // Load initial cached reading from sessionStorage after mounting to prevent SSR hydration mismatches
  useEffect(() => {
    try {
      const cached = sessionStorage.getItem("aeronyx_last_reading");
      if (cached) {
        setData(JSON.parse(cached));
      }
    } catch {}
  }, []);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadingStep, setLoadingStep] = useState("init");
  const [backendStatus, setBackendStatus] = useState("checking"); // 'checking'|'online'|'waking'|'offline'
  const dataRef = useRef<LiveDataResult | null>(null);
  dataRef.current = data;

  // Sync inputs if props update (from dashboard directly)
  useEffect(() => {
    if (customSource) setSource(customSource);
  }, [customSource]);
  useEffect(() => {
    if (customWaqiToken !== undefined) setWaqiToken(customWaqiToken);
  }, [customWaqiToken]);
  useEffect(() => {
    if (customThingspeakChannel !== undefined) setThingspeakChannel(customThingspeakChannel);
  }, [customThingspeakChannel]);
  useEffect(() => {
    if (customThingspeakKey !== undefined) setThingspeakKey(customThingspeakKey);
  }, [customThingspeakKey]);

  // Sync with localStorage for cross-page navigation & sidebar updates
  useEffect(() => {
    const handleStorageChange = () => {
      setSource(customSource || localStorage.getItem("aeronyx_data_source") || "real_api");
      setWaqiToken(customWaqiToken || localStorage.getItem("aeronyx_waqi_token") || "2762cbe0240a9a00d82cc8e635b8fb10c02cee70");
      setThingspeakChannel(customThingspeakChannel || localStorage.getItem("aeronyx_thingspeak_channel") || "3418865");
      setThingspeakKey(customThingspeakKey || localStorage.getItem("aeronyx_thingspeak_key") || "HZMI1LP3UUHK2S7O");
    };

    handleStorageChange(); // Load immediately on client mount to prevent mismatches
    window.addEventListener("storage", handleStorageChange);
    const interval = setInterval(handleStorageChange, 2000);
    return () => {
      window.removeEventListener("storage", handleStorageChange);
      clearInterval(interval);
    };
  }, [customSource, customWaqiToken, customThingspeakChannel, customThingspeakKey]);

  // Step 1: Load active source immediately so dashboard is never blank
  useEffect(() => {
    setLoadingStep("connecting");
    getLiveData(source, waqiToken, thingspeakChannel, thingspeakKey)
      .then((res) => {
        if (res) {
          setData((prev) => (prev && prev._source === res._source ? prev : res));
          try {
            sessionStorage.setItem("aeronyx_last_reading", JSON.stringify(res));
          } catch {}
        }
      })
      .catch(() => {})
      .finally(() => {
        setLoading(false);
        setLoadingStep("done");
      });
  }, [source, waqiToken, thingspeakChannel, thingspeakKey]);

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
          const result = await getLiveData(source, waqiToken, thingspeakChannel, thingspeakKey);
          if (!cancelled && result && (result._source === "backend" || result._source === "waqi-api" || result._source === "thingspeak")) {
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
            const result = await getLiveData(source, waqiToken, thingspeakChannel, thingspeakKey);
            if (!cancelled && result && (result._source === "backend" || result._source === "waqi-api" || result._source === "thingspeak")) {
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
  }, [source, waqiToken, thingspeakChannel, thingspeakKey]);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setLoadingStep("fetching");
      const result = await getLiveData(source, waqiToken, thingspeakChannel, thingspeakKey);
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
  }, [source, waqiToken, thingspeakChannel, thingspeakKey]);

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
