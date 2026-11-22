/**
 * Barrel exports for external AQI data clients (WAQI primary, Open-Meteo forecast/fallback).
 */
export {
  EXTERNAL_FETCH_TIMEOUT_MS,
  fetchWithTimeout,
} from "@/lib/aqi/fetchWithTimeout";
export {
  fetchWaqiStation,
  usAqiToPm10UgM3,
  usAqiToPm25UgM3,
  type WaqiStationReading,
} from "@/lib/aqi/waqiClient";
export {
  fetchOpenMeteoAirQuality,
  type OpenMeteoReading,
} from "@/lib/aqi/openMeteoClient";
