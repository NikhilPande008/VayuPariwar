# VayuPariwar — Product Architecture

## 1. Product Vision & Challenge Alignment
**VayuPariwar** is a GenAI-powered Urban Air Quality Assistant built for Indian families navigating severe winter smog and urban air pollution. Rather than showing passive AQI numbers, it combines **real-time Indian air quality data**, **deterministic exposure/emission math**, and **personalized GenAI guidance** to answer three daily questions:

1. **When** is it safest for each family member to step outside? (*Safe-Window Planner*)
2. **What** is the direct health and environmental impact of our daily choices? (*SmogShift Simulator*)
3. **How** do we protect our home and get the whole family—including reluctant seniors and busy commuters—on board? (*Multi-Gen Family Care*)

### Alignment with PromptWars Challenge 06
| Challenge Requirement | VayuPariwar Implementation |
| :--- | :--- |
| **Low-Emission Daily Routines** | 24-hour Safe-Window timeline + timing-aware commute and errand swaps. |
| **Indoor Air Quality Management** | Budget-aware Home Shield actions (HEPA vs. zero-cost DIY, cross-ventilation timers, kitchen exhaust habits). |
| **Sustainable Alternatives & Direct Impact** | Interactive SmogShift toggles with deterministic $\text{PM}_{2.5}$ exposure reduction (%) and $\text{CO}_2$ avoided (kg/day), paired with plain-English AI explanations. |
| **Personalization & Indian Context** | Multi-generational household profile builder (Commuter, Child, Senior, Respiratory Sensitivity) + Indian city/station awareness + English/Hindi WhatsApp briefings. |
| **Real-Time Data (No Dummy Metrics)** | Live CPCB (via WAQI) station readings with visible station name, timestamp, and explicit Open-Meteo truthful fallback. |

---

## 2. Household Profile Model
VayuPariwar models an entire **household** using zero-friction toggle pills:

* **Household Members (Multi-select):**
  * **Daily Commuter:** 2-Wheeler, Solo Car, Public Transit, or Work-from-Home (WFH)
  * **Young Children (0–12 yrs):** School commute & outdoor play adjustments
  * **Senior Citizens (60+ yrs):** Morning walk habits & cardiopulmonary sensitivity
  * **Respiratory Sensitivity:** Asthma/allergies triggering stricter exposure thresholds
* **Home Environment:**
  * **Air Purification:** Owns HEPA Purifier vs. Budget/No Purifier
  * **Kitchen Setup:** Gas Stove (with/without chimney) vs. Induction
  * **Flat Exposure:** Roadside/Lower Floor vs. High-Rise

---

## 3. Core Functional Modules

### Persistent Top Context Bar
* **Location Selector:** Geolocation auto-detect + quick-select Indian cities (Delhi, Pune, Mumbai, Bengaluru, Kolkata, Lucknow, Gurugram, Noida).
* **Truthful Live AQI Pill:** Displays Indian National AQI (NAQI), severity category (`Good`, `Satisfactory`, `Moderate`, `Poor`, `Very Poor`, `Severe`), primary pollutant ($\text{PM}_{2.5}$ / $\text{PM}_{10}$), exact monitoring station name, and last updated timestamp.
* **Household Profile Bar:** Collapsible pill selector that immediately recalculates the dashboard when changed.

### Tab 1: Safe-Window Family Plan
* **24-Hour Safe-Window Timeline:** Vertical bar chart of hourly $\text{PM}_{2.5}$ levels highlighting:
  * **Best Window:** Lowest 3-hour rolling $\text{PM}_{2.5}$ window during waking hours (06:00–21:00).
  * **Peak Smog Warning:** Worst inversion hours (typically early morning / late night).
* **Role-Based Action Cards:** Individual cards per selected household member with concrete Morning, Afternoon, and Evening guidance.
* **Home Shield (Indoor Air Hacks):** 3–4 prioritized indoor actions tailored to the home setup (exact window-opening hours, wet-mopping instead of dry-sweeping, lid-on cooking + exhaust, or DIY Corsi-Rosenthal box instructions if no HEPA purifier is owned).

### Tab 2: SmogShift Interactive Simulator
* **One-Tap Daily Choice Toggles:**
  1. **Commute Mode:** Solo Car / 2-Wheeler $\rightarrow$ Metro / Bus / Carpool / WFH.
  2. **Outdoor Activity Timing:** Peak Morning (7:00 AM) $\rightarrow$ Safe Window (e.g., 3:00 PM).
  3. **Indoor Habits:** Standard $\rightarrow$ Exhaust + Lid-on Cooking + Skip Incense/Dhoop.
  4. **Personal Protection:** None $\rightarrow$ N95 Mask Outdoors + Door Draft Sealing.
* **Instant Impact Meters (Deterministic):**
  * **Personal $\text{PM}_{2.5}$ Inhalation Reduced (%)**
  * **Community $\text{CO}_2$ Emissions Avoided (kg/day)**
* **GenAI "Why This Matters" Card:** Explains the direct health and environmental trade-off of the active toggles in 2–3 clear, jargon-free sentences grounded in today's live AQI.

### Tab 3: Family Briefing & Copilot
* **WhatsApp-Ready Family Briefing:** One-click generator with an **English / Hindi** toggle. Formats the day's safe windows, Home Shield steps, and empathetic nudges (e.g., gently explaining to grandparents why shifting their morning walk protects their lungs today) with a **Copy to Clipboard** button.
* **Context-Aware Q&A Copilot:** Lightweight chat interface pre-grounded with live station data and household profile for follow-up questions (*"Is it safe to take my 5-year-old to the park at 5 PM?"*).

---

## 4. UX, Accessibility & Truthful UI Standards
* **Minimalist, Uncluttered Layout:** Single top bar + 3 focused tabs. No dense engineering dashboards.
* **Truthful Status Reporting:** Never display hardcoded or fabricated AQI metrics. If the primary CPCB/WAQI station is offline or rate-limited, explicitly badge the UI with `Fallback: Open-Meteo Model` and show the exact timestamp. If all sources fail, display a clear error state with a retry button.
* **WCAG 2.1 AA Accessibility:** Never rely on color alone for AQI severity—pair every color badge with a text label and distinct icon. Support full keyboard navigation and `aria-live="polite"` regions for dynamically loaded AI content.

---

## 5. PromptWars Submission & Demo Flow (2–3 Minutes)
1. **0:00–0:30 (Live Data Proof):** Load VayuPariwar for Delhi or Pune, highlighting the live CPCB/WAQI station name, NAQI score, and timestamp.
2. **0:30–1:15 (Multi-Gen Personalization):** Switch the household profile from *Solo Car Commuter* to *Family with Toddler, Senior Citizen, & No Purifier*—show the Safe-Window plan and Home Shield hacks dynamically adapt.
3. **1:15–2:00 (SmogShift Direct Impact):** Toggle Commute to Metro and Walk to Safe Window—show instant deterministic $\text{PM}_{2.5}$ and $\text{CO}_2$ meters update alongside the GenAI impact explanation.
4. **2:00–2:30 (WhatsApp Briefing & Copilot):** Generate a Hindi/English Family Briefing, copy it, and ask one live follow-up question in the Copilot.