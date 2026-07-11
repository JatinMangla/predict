// Validation against known panchang dates (Drik Panchang 2024 reference):
// Paush Purnima was 25 Jan 2024; Amavasya 9 Feb 2024; Makar Sankranti 15 Jan
// 2024; Amanta Magha began with the 9 Feb new moon; Vikram Samvat 2081
// began at Chaitra (9 Apr 2024).

import { describe, it, expect } from "vitest";
import {
  buildMonthCalendar,
  lunarMonthInfo,
  dayTimings,
  LUNAR_MONTHS,
} from "./hinduCalendar";

const DELHI = { lat: 28.6139, lon: 77.209, tz: -330 }; // IST = UTC+5:30

describe("hindu calendar month grid", () => {
  const jan2024 = buildMonthCalendar(2024, 0, DELHI.lat, DELHI.lon, DELHI.tz);

  it("marks Purnima on 25 Jan 2024", () => {
    const d25 = jan2024.find((d) => d.day === 25)!;
    expect(d25.isPurnima).toBe(true);
    expect(d25.paksha).toBe("shukla");
    // Moon should be nearly full (elongation near 180°)
    expect(Math.abs(d25.elongation - 180)).toBeLessThan(15);
  });

  it("marks Makar Sankranti on 15 Jan 2024", () => {
    const d15 = jan2024.find((d) => d.day === 15)!;
    expect(d15.sankrantiSign).toBe(9); // Capricorn
  });

  it("has exactly one sankranti in the month", () => {
    expect(jan2024.filter((d) => d.sankrantiSign !== undefined).length).toBe(1);
  });

  it("marks Amavasya on 9 Feb 2024 and new moon is dark", () => {
    const feb2024 = buildMonthCalendar(2024, 1, DELHI.lat, DELHI.lon, DELHI.tz);
    const d9 = feb2024.find((d) => d.day === 9)!;
    expect(d9.isAmavasya).toBe(true);
    const nearNew = d9.elongation > 330 || d9.elongation < 15;
    expect(nearNew).toBe(true);
  });

  it("tithis progress monotonically through the month (mod 30)", () => {
    for (let i = 1; i < jan2024.length; i++) {
      const diff = (jan2024[i].tithi - jan2024[i - 1].tithi + 30) % 30;
      expect(diff).toBeLessThanOrEqual(2); // 0 (rare), 1 or 2 (kshaya tithi)
    }
  });
});

describe("festivals (validated against 2024 panchang)", () => {
  const fest = (year: number, month: number) =>
    buildMonthCalendar(year, month, DELHI.lat, DELHI.lon, DELHI.tz);

  it("Diwali falls on 31 Oct or 1 Nov 2024", () => {
    const oct = fest(2024, 9);
    const nov = fest(2024, 10);
    const days = [...oct, ...nov].filter((d) =>
      d.festivals.some((f) => f.en.includes("Diwali"))
    );
    expect(days.length).toBeGreaterThanOrEqual(1);
    const labels = days.map(
      (d) => `${new Date(d.dayStartMs + 12 * 3600 * 1000).getMonth()}-${d.day}`
    );
    expect(labels.some((l) => l === "9-31" || l === "10-1")).toBe(true);
  });

  it("Maha Shivratri on 8 Mar 2024", () => {
    const mar = fest(2024, 2);
    const day = mar.find((d) => d.festivals.some((f) => f.en.includes("Shivratri")));
    expect(day?.day).toBe(8);
  });

  it("Krishna Janmashtami on 26 Aug 2024 (±1 day)", () => {
    const aug = fest(2024, 7);
    const day = aug.find((d) => d.festivals.some((f) => f.en.includes("Janmashtami")));
    expect(day).toBeDefined();
    expect(Math.abs(day!.day - 26)).toBeLessThanOrEqual(1);
  });

  it("Makar Sankranti named on 15 Jan 2024", () => {
    const jan = fest(2024, 0);
    const d15 = jan.find((d) => d.day === 15)!;
    expect(d15.festivals.some((f) => f.en.includes("Makar Sankranti"))).toBe(true);
  });

  it("Holi (Dhulandi) on 25 Mar 2024", () => {
    const mar = fest(2024, 2);
    const day = mar.find((d) => d.festivals.some((f) => f.en.includes("Holi (")));
    expect(day?.day).toBe(25);
  });
});

describe("day timings", () => {
  it("Rahu Kaal on Monday is the 2nd octant of the day", () => {
    const jan = buildMonthCalendar(2024, 0, DELHI.lat, DELHI.lon, DELHI.tz);
    const monday = jan.find((d) => d.weekday === 1 && d.sunriseMs && d.sunsetMs)!;
    const tm = dayTimings(monday);
    const span = monday.sunsetMs! - monday.sunriseMs!;
    expect(tm.rahuKaal![0]).toBeCloseTo(monday.sunriseMs! + span / 8, -3);
    expect(tm.rahuKaal![1]).toBeCloseTo(monday.sunriseMs! + span / 4, -3);
  });
  it("Abhijit straddles solar noon and is absent on Wednesday", () => {
    const jan = buildMonthCalendar(2024, 0, DELHI.lat, DELHI.lon, DELHI.tz);
    const thu = jan.find((d) => d.weekday === 4 && d.sunriseMs && d.sunsetMs)!;
    const tm = dayTimings(thu);
    const mid = (thu.sunriseMs! + thu.sunsetMs!) / 2;
    expect(tm.abhijit![0]).toBeLessThan(mid);
    expect(tm.abhijit![1]).toBeGreaterThan(mid);
    const wed = jan.find((d) => d.weekday === 3 && d.sunriseMs && d.sunsetMs)!;
    expect(dayTimings(wed).abhijit).toBeNull();
  });
});

describe("lunar month (Amanta) and Vikram Samvat", () => {
  it("mid-Jan 2024 falls in Pausha", () => {
    const m = lunarMonthInfo(Date.UTC(2024, 0, 20, 12));
    expect(LUNAR_MONTHS[m.index].en).toBe("Pausha");
  });
  it("mid-Feb 2024 falls in Magha", () => {
    const m = lunarMonthInfo(Date.UTC(2024, 1, 20, 12));
    expect(LUNAR_MONTHS[m.index].en).toBe("Magha");
  });
  it("mid-Apr 2024 is Chaitra, Vikram Samvat 2081", () => {
    const m = lunarMonthInfo(Date.UTC(2024, 3, 15, 12));
    expect(LUNAR_MONTHS[m.index].en).toBe("Chaitra");
    expect(m.vikramSamvat).toBe(2081);
  });
});
