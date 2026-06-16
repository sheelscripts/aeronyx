import axios from "axios";

const OPEN_METEO_AIR_QUALITY_URL = "https://air-quality-api.open-meteo.com/v1/air-quality";
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

let _cacheTimestamp: Date | null = null;
let _liveZoneCache: Record<string, any> = {};

async function fetchZoneLiveAqi(zoneName: string, lat: number, lng: number): Promise<any | null> {
  try {
    const response = await axios.get(OPEN_METEO_AIR_QUALITY_URL, {
      params: {
        latitude: lat,
        longitude: lng,
        current: "us_aqi,pm2_5",
        timezone: "auto",
      },
      timeout: 5000,
    });
    if (response.status !== 200) return null;
    const data = response.data;
    const current = data.current || {};
    const us_aqi = current.us_aqi;
    const pm25 = current.pm2_5;

    if (us_aqi === undefined && pm25 === undefined) {
      return null;
    }

    return {
      zone: zoneName,
      us_aqi: us_aqi !== undefined ? Math.round(parseFloat(us_aqi)) : null,
      pm25: pm25 !== undefined ? parseFloat(pm25) : null,
      timestamp: current.time || new Date().toISOString(),
      source: "open-meteo",
    };
  } catch (err) {
    console.warn(`Open-Meteo AQI fetch failed for ${zoneName}:`, err);
    return null;
  }
}

export async function getLiveZoneAqi(zoneDefs: Record<string, { lat: number; lng: number }>): Promise<Record<string, any>> {
  const now = new Date();
  if (
    _cacheTimestamp &&
    now.getTime() - _cacheTimestamp.getTime() < CACHE_TTL_MS &&
    Object.keys(_liveZoneCache).length > 0
  ) {
    return _liveZoneCache;
  }

  const fresh: Record<string, any> = {};
  const promises = Object.entries(zoneDefs).map(async ([zoneName, zdef]) => {
    const res = await fetchZoneLiveAqi(zoneName, zdef.lat, zdef.lng);
    if (res) {
      fresh[zoneName] = res;
    }
  });

  await Promise.all(promises);

  if (Object.keys(fresh).length > 0) {
    _liveZoneCache = fresh;
    _cacheTimestamp = now;
    console.log(`Live AQI cache updated for ${Object.keys(fresh).length} zones.`);
  }

  return _liveZoneCache;
}
