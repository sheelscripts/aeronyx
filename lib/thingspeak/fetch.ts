import axios from "axios";
import { insertSensorReading, getSensorReadings, SensorReading } from "../db/database";
import { calculateAqi, getAqiCategory } from "../ml/aqiCalc";
import { detectSource } from "../ml/mlPredictor";
import { interpolateWind } from "../weather/windService";

const CHANNEL_ID = process.env.THINGSPEAK_CHANNEL_ID || "3316545";
const READ_API_KEY = process.env.THINGSPEAK_READ_API_KEY || "GFGLEQFXSC40CFOO";
const BASE_URL = `https://api.thingspeak.com/channels/${CHANNEL_ID}`;

// Toggle for demo mode
const DEMO_MODE = process.env.DEMO_MODE || "auto"; // "auto", "true", "false"

// In-memory cache for fast responses in Serverless environments (best effort)
let _latestReading: SensorReading | null = null;

function randomDashboardAqi(): number {
  return Math.floor(Math.random() * (180 - 100 + 1)) + 100;
}

// Generates a realistic reading based on time-of-day diurnal patterns
export async function generateDemoReading(dateObj?: Date): Promise<SensorReading> {
  const now = dateObj || new Date();
  const hour = now.getUTCHours() + now.getUTCMinutes() / 60.0;

  // Diurnal pattern: pollution peaks at ~8am and ~6pm (rush hours)
  const morningPeak = Math.exp(-Math.pow(hour - 8, 2) / 8);
  const eveningPeak = Math.exp(-Math.pow(hour - 18, 2) / 8);
  const trafficFactor = 0.3 + 0.7 * (morningPeak + eveningPeak);

  const getNoise = (scale = 1.0) => {
    const u1 = Math.random();
    const u2 = Math.random();
    const randStdNormal = Math.sqrt(-2.0 * Math.log(u1)) * Math.sin(2.0 * Math.PI * u2);
    return scale * randStdNormal;
  };

  const temperature = 28.0 + 5 * Math.sin(((hour - 14) * Math.PI) / 12) + getNoise(1.5);
  const humidity = 55.0 - 15 * Math.sin(((hour - 14) * Math.PI) / 12) + getNoise(3);
  const pm25 = Math.max(30, 70 * trafficFactor + getNoise(8));
  const co = Math.max(0.5, 2.8 * trafficFactor + getNoise(0.3));
  const no2 = Math.max(0.02, 0.06 * trafficFactor + getNoise(0.01));
  const tvoc = Math.max(0.05, 0.45 * trafficFactor + getNoise(0.08));

  const calculatedAqi = calculateAqi(pm25, co, no2);
  const aqi = randomDashboardAqi();
  const catInfo = getAqiCategory(aqi);
  const wind = await interpolateWind(28.635, 77.228);

  const sourceRes = detectSource(
    Math.round(pm25 * 10) / 10,
    Math.round(co * 100) / 100,
    Math.round(no2 * 1000) / 1000,
    Math.round(tvoc * 100) / 100,
    Math.round(Math.max(15, Math.min(45, temperature)) * 10) / 10,
    Math.round(Math.max(20, Math.min(95, humidity)) * 10) / 10,
    hour
  );

  return {
    timestamp: now.toISOString(),
    temperature: Math.round(Math.max(15, Math.min(45, temperature)) * 10) / 10,
    humidity: Math.round(Math.max(20, Math.min(95, humidity)) * 10) / 10,
    pm25: Math.round(pm25 * 10) / 10,
    tvoc: Math.round(tvoc * 100) / 100,
    no2: Math.round(no2 * 1000) / 1000,
    co: Math.round(co * 100) / 100,
    aqi,
    aqi_category: catInfo.category,
    source_detected: sourceRes.source,
    ward_id: "ward_01",
  };
}

function isAllZeros(feed: any): boolean {
  for (const key of ["field3", "field4", "field5", "field6"]) {
    const val = feed[key];
    if (val && parseFloat(val) !== 0.0) {
      return false;
    }
  }
  return true;
}

export async function fetchLatestFromThingSpeak(): Promise<SensorReading | null> {
  let useDemo = DEMO_MODE === "true";

  if (DEMO_MODE !== "true") {
    try {
      const response = await axios.get(`${BASE_URL}/feeds/last.json`, {
        params: { api_key: READ_API_KEY },
        timeout: 8000,
      });

      if (response.status !== 200 || !response.data || !response.data.created_at || isAllZeros(response.data)) {
        console.log("Device offline or invalid data. Falling back to simulated mode.");
        useDemo = true;
      } else {
        const data = response.data;
        const temperature = parseFloat(data.field1) || 0.0;
        const humidity = parseFloat(data.field2) || 0.0;
        const pm25 = parseFloat(data.field3) || 0.0;
        const tvoc = parseFloat(data.field4) || 0.0;
        const no2 = parseFloat(data.field5) || 0.0;
        const co = parseFloat(data.field6) || 0.0;
        const aqiRaw = parseInt(data.field7, 10) || 0;

        const aqi = aqiRaw > 0 ? aqiRaw : calculateAqi(pm25, co, no2);
        const catInfo = getAqiCategory(aqi);
        const hour = new Date(data.created_at).getUTCHours();

        const sourceRes = detectSource(
          pm25,
          co,
          no2,
          tvoc,
          temperature,
          humidity,
          hour
        );

        const reading: SensorReading = {
          timestamp: data.created_at,
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

        _latestReading = reading;
        return reading;
      }
    } catch (err) {
      console.error("ThingSpeak fetch error:", err);
      useDemo = true;
    }
  }

  if (useDemo || DEMO_MODE === "auto") {
    const reading = await generateDemoReading();
    _latestReading = reading;
    return reading;
  }

  return _latestReading;
}

export function generateDemoHistory(hours = 24): SensorReading[] {
  const readings: SensorReading[] = [];
  const intervalMinutes = 5;
  const totalPoints = (hours * 60) / intervalMinutes;
  const now = Date.now();

  for (let i = 0; i < totalPoints; i++) {
    const time = new Date(now - (totalPoints - i) * intervalMinutes * 60 * 1000);
    // Generate a simulated reading for this time point
    const hour = time.getUTCHours() + time.getUTCMinutes() / 60.0;
    const morningPeak = Math.exp(-Math.pow(hour - 8, 2) / 8);
    const eveningPeak = Math.exp(-Math.pow(hour - 18, 2) / 8);
    const trafficFactor = 0.3 + 0.7 * (morningPeak + eveningPeak);

    const temperature = Math.round((28.0 + 5 * Math.sin(((hour - 14) * Math.PI) / 12) + (Math.random() * 3 - 1.5)) * 10) / 10;
    const humidity = Math.round((55.0 - 15 * Math.sin(((hour - 14) * Math.PI) / 12) + (Math.random() * 6 - 3.0)) * 10) / 10;
    const pm25 = Math.round(Math.max(30, 70 * trafficFactor + (Math.random() * 16 - 8.0)) * 10) / 10;
    const co = Math.round(Math.max(0.5, 2.8 * trafficFactor + (Math.random() * 0.6 - 0.3)) * 100) / 100;
    const no2 = Math.round(Math.max(0.02, 0.06 * trafficFactor + (Math.random() * 0.02 - 0.01)) * 1000) / 1000;
    const tvoc = Math.round(Math.max(0.05, 0.45 * trafficFactor + (Math.random() * 0.16 - 0.08)) * 100) / 100;

    const aqi = Math.round(100 + Math.random() * 80);
    const catInfo = getAqiCategory(aqi);

    const sourceRes = detectSource(pm25, co, no2, tvoc, temperature, humidity, hour);

    readings.push({
      timestamp: time.toISOString(),
      temperature,
      humidity,
      pm25,
      tvoc,
      no2,
      co,
      aqi,
      aqi_category: catInfo.category,
      source_detected: sourceRes.source,
      ward_id: "ward_01",
    });
  }

  return readings;
}

export async function getHistory(hours = 24, wardId = "ward_01"): Promise<SensorReading[]> {
  try {
    const list = await getSensorReadings(hours, wardId);
    if (list.length >= 10) {
      return list;
    }
  } catch (err) {
    console.error("Error reading history from database:", err);
  }

  return generateDemoHistory(hours);
}
