// Breakpoints: [C_low, C_high, I_low, I_high]
export const PM25_BREAKPOINTS = [
  [0, 30, 0, 50],
  [31, 60, 51, 100],
  [61, 90, 101, 200],
  [91, 120, 201, 300],
  [121, 250, 301, 400],
  [251, 500, 401, 500],
];

export const NO2_BREAKPOINTS = [
  [0, 40, 0, 50],
  [41, 80, 51, 100],
  [81, 180, 101, 200],
  [181, 280, 201, 300],
  [281, 400, 301, 400],
  [401, 500, 401, 500],
];

export const CO_BREAKPOINTS = [
  [0, 1.0, 0, 50],
  [1.1, 2.0, 51, 100],
  [2.1, 10.0, 101, 200],
  [10.1, 17.0, 201, 300],
  [17.1, 34.0, 301, 400],
  [34.1, 500.0, 401, 500],
];

export const AQI_CATEGORIES = [
  [0, 50, "Good", "#55a049"],
  [51, 100, "Satisfactory", "#a3c853"],
  [101, 200, "Moderate", "#b45309"],
  [201, 300, "Poor", "#f29c33"],
  [301, 400, "Very Poor", "#e93f33"],
  [401, 500, "Severe", "#af2d24"],
];

const CO_PPM_TO_MG = 1.131; // Conversion factor

function linearAqi(concentration: number, breakpoints: number[][]): number {
  for (const [c_lo, c_hi, i_lo, i_hi] of breakpoints) {
    if (concentration >= c_lo && concentration <= c_hi) {
      return Math.round(((i_hi - i_lo) / (c_hi - c_lo)) * (concentration - c_lo) + i_lo);
    }
  }
  return 0;
}

export function calculateAqi(pm25: number, coPpm: number, no2Ppm: number): number {
  const aqiPm25 = linearAqi(pm25, PM25_BREAKPOINTS);
  const aqiCo = linearAqi(coPpm * CO_PPM_TO_MG, CO_BREAKPOINTS);
  const aqiNo2 = linearAqi(no2Ppm, NO2_BREAKPOINTS);
  return Math.max(aqiPm25, aqiCo, aqiNo2);
}

export function getAqiCategory(aqi: number): { category: string; color: string } {
  for (const [lo, hi, name, color] of AQI_CATEGORIES) {
    if (aqi >= (lo as number) && aqi <= (hi as number)) {
      return { category: name as string, color: color as string };
    }
  }
  return { category: "Severe", color: "#af2d24" };
}

export function getHealthAdvisory(aqi: number, source?: string): {
  aqi: number;
  category: string;
  color: string;
  general: string[];
  vulnerable: string[];
  outdoor_safe: boolean;
  mask_recommended: boolean;
} {
  const cat = getAqiCategory(aqi);
  const base = {
    aqi,
    category: cat.category,
    color: cat.color,
    general: [] as string[],
    vulnerable: [] as string[],
    outdoor_safe: true,
    mask_recommended: false,
  };

  if (aqi <= 50) {
    base.general = ["Air quality is excellent. Enjoy outdoor activities!"];
    base.vulnerable = ["No precautions needed."];
  } else if (aqi <= 100) {
    base.general = [
      "Air quality is acceptable.",
      "Unusually sensitive people should limit prolonged outdoor exertion.",
    ];
    base.vulnerable = ["People with respiratory conditions may experience mild discomfort."];
  } else if (aqi <= 200) {
    base.general = [
      "Reduce prolonged outdoor exertion.",
      "Keep windows closed during peak hours.",
    ];
    base.vulnerable = [
      "Children, elderly, and asthmatics should limit outdoor activity.",
      "Use air purifiers indoors.",
    ];
    base.mask_recommended = true;
  } else if (aqi <= 300) {
    base.general = [
      "Avoid outdoor exercise.",
      "Wear N95 mask if going outside.",
      "Keep all windows shut.",
    ];
    base.vulnerable = ["Stay indoors. Use air purifier.", "Keep emergency medications accessible."];
    base.outdoor_safe = false;
    base.mask_recommended = true;
  } else {
    base.general = [
      "HEALTH EMERGENCY — Stay indoors.",
      "Wear N95 mask if outdoor exposure is unavoidable.",
      "Avoid all physical exertion outdoors.",
    ];
    base.vulnerable = [
      "Do not go outdoors under any circumstances.",
      "Seek medical help if experiencing breathing difficulty.",
    ];
    base.outdoor_safe = false;
    base.mask_recommended = true;
  }

  if (source === "construction") {
    base.general.push("Construction dust detected — avoid areas near building sites.");
  } else if (source === "biomass") {
    base.general.push("Biomass burning detected — avoid areas with smoke or haze.");
  } else if (source === "vehicle" || source === "vehicular") {
    base.general.push("Vehicle exhaust is primary source — avoid busy roads.");
  }

  return base;
}
