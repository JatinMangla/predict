// Validation against known panchang dates (Drik Panchang 2024 reference):
// Paush Purnima was 25 Jan 2024; Amavasya 9 Feb 2024; Makar Sankranti 15 Jan
// 2024; Amanta Magha began with the 9 Feb new moon; Vikram Samvat 2081
// began at Chaitra (9 Apr 2024).

import { describe, it, expect } from "vitest";
import {
  buildMonthCalendar,
  lunarMonthInfo,
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
