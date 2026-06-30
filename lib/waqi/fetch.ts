import axios from "axios";
import { SensorReading } from "../db/database";
import { calculateAqi, getAqiCategory } from "../ml/aqiCalc";
import { detectSource } from "../ml/mlPredictor";

const DEFAULT_TOKEN = "2762cbe0240a9a00d82cc8e635b8fb10c02cee70"; // WAQI public default token

export async function fetchLatestFromWaqi(token?: string, lat = 28.635, lng = 77.228): Promise<SensorReading | null> {
  const activeToken = token || process.env.WAQI_API_TOKEN || DEFAULT_TOKEN;
  const url = `https://api.waqi.info/feed/geo:${lat};${lng}/?token=${activeToken}`;

  try {
    const response = await axios.get(url, { timeout: 8000 });
    if (response.status !== 200 || response.data.status !== "ok") {
      console.warn("WAQI fetch failed or invalid status:", response.data);
      return null;
    }

    const data = response.data.data;
    const iaqi = data.iaqi || {};
    const temperature = iaqi.t ? parseFloat(iaqi.t.v) : 28.0;
    const humidity = iaqi.h ? parseFloat(iaqi.h.v) : 55.0;
    const pm25 = iaqi.pm25 ? parseFloat(iaqi.pm25.v) : 60.0;
    
    // Scale CO (ppm) and NO2 (ppm) safely from WAQI ppb/index representation
    const coRaw = iaqi.co ? parseFloat(iaqi.co.v) : 1.2;
    const co = coRaw > 10 ? coRaw / 10.0 : coRaw;
    
    const no2Raw = iaqi.no2 ? parseFloat(iaqi.no2.v) : 35.0;
    const no2 = no2Raw > 1 ? no2Raw / 1000.0 : no2Raw;

    // Compute Indian CPCB AQI dynamically to keep dashboard and maps consistent
    const rawAqi = calculateAqi(pm25, co, no2);
    const aqi = Math.max(0, Math.min(450, Math.round(rawAqi)));
    const catInfo = getAqiCategory(aqi);
    
    // TVOC: Estimate TVOC since it's not a standard pollutant reported by WAQI stations
    const tvoc = iaqi.tvoc ? parseFloat(iaqi.tvoc.v) : Math.max(0.05, Math.min(2.0, pm25 * 0.004 + (Math.random() * 0.1 - 0.05)));

    const dateStr = data.time.s || new Date().toISOString();
    const hour = new Date(dateStr).getUTCHours();
    
    const sourceRes = detectSource(
      pm25,
      co,
      no2,
      tvoc,
      temperature,
      humidity,
      hour
    );

    return {
      timestamp: new Date(dateStr).toISOString(),
      temperature: Math.round(temperature * 10) / 10,
      humidity: Math.round(humidity * 10) / 10,
      pm25: Math.round(pm25 * 10) / 10,
      tvoc: Math.round(tvoc * 100) / 100,
      no2: Math.round(no2 * 1000) / 1000,
      co: Math.round(co * 100) / 100,
      aqi,
      aqi_category: catInfo.category,
      source_detected: sourceRes.source,
      ward_id: "ward_01",
    };
  } catch (err) {
    console.error("Error fetching from WAQI:", err);
    return null;
  }
}

export interface WaqiStationBound {
  lat: number;
  lon: number;
  aqi: number;
  name: string;
}

export async function fetchWaqiStationsInBounds(token?: string): Promise<WaqiStationBound[]> {
  const activeToken = token || DEFAULT_TOKEN;
  const url = `https://api.waqi.info/v2/map/bounds/?latlng=28.4,76.8,28.9,77.4&token=${activeToken}`;
  try {
    const response = await axios.get(url, { timeout: 8000 });
    if (response.status === 200 && response.data.status === "ok") {
      const list = response.data.data || [];
      return list.map((item: any) => ({
        lat: parseFloat(item.lat),
        lon: parseFloat(item.lon),
        aqi: parseInt(item.aqi, 10) || 100,
        name: item.station?.name || "WAQI Station",
      }));
    }
  } catch (e) {
    console.error("Failed to fetch WAQI stations in bounds:", e);
  }
  return [];
}
