/**
 * 標準報酬月額（協会けんぽ／厚生年金の等級表）
 * 令和6年9月分以降の一般的な区分に準拠。健康保険組合加入の場合は別表が必要な場合があります。
 */
export type StandardGradeRow = { lo: number; hi: number | null; std: number };

/** 報酬月額（円）の下限「以上」・上限「未満」。最上級のみ上限なし。 */
const GRADES: StandardGradeRow[] = [
  { lo: 0, hi: 93_000, std: 88_000 },
  { lo: 93_000, hi: 101_000, std: 98_000 },
  { lo: 101_000, hi: 107_000, std: 104_000 },
  { lo: 107_000, hi: 114_000, std: 110_000 },
  { lo: 114_000, hi: 121_000, std: 118_000 },
  { lo: 121_000, hi: 129_000, std: 126_000 },
  { lo: 129_000, hi: 137_000, std: 134_000 },
  { lo: 137_000, hi: 145_000, std: 142_000 },
  { lo: 145_000, hi: 155_000, std: 150_000 },
  { lo: 155_000, hi: 165_000, std: 160_000 },
  { lo: 165_000, hi: 175_000, std: 170_000 },
  { lo: 175_000, hi: 185_000, std: 180_000 },
  { lo: 185_000, hi: 195_000, std: 190_000 },
  { lo: 195_000, hi: 210_000, std: 200_000 },
  { lo: 210_000, hi: 230_000, std: 220_000 },
  { lo: 230_000, hi: 250_000, std: 240_000 },
  { lo: 250_000, hi: 270_000, std: 260_000 },
  { lo: 270_000, hi: 290_000, std: 280_000 },
  { lo: 290_000, hi: 310_000, std: 300_000 },
  { lo: 310_000, hi: 330_000, std: 320_000 },
  { lo: 330_000, hi: 350_000, std: 340_000 },
  { lo: 350_000, hi: 370_000, std: 360_000 },
  { lo: 370_000, hi: 395_000, std: 380_000 },
  { lo: 395_000, hi: 425_000, std: 410_000 },
  { lo: 425_000, hi: 455_000, std: 440_000 },
  { lo: 455_000, hi: 485_000, std: 470_000 },
  { lo: 485_000, hi: 515_000, std: 500_000 },
  { lo: 515_000, hi: 545_000, std: 530_000 },
  { lo: 545_000, hi: 575_000, std: 560_000 },
  { lo: 575_000, hi: 605_000, std: 590_000 },
  { lo: 605_000, hi: 635_000, std: 620_000 },
  { lo: 635_000, hi: 665_000, std: 650_000 },
  { lo: 665_000, hi: 695_000, std: 680_000 },
  { lo: 695_000, hi: 730_000, std: 710_000 },
  { lo: 730_000, hi: 770_000, std: 750_000 },
  { lo: 770_000, hi: 810_000, std: 790_000 },
  { lo: 810_000, hi: 855_000, std: 830_000 },
  { lo: 855_000, hi: 905_000, std: 880_000 },
  { lo: 905_000, hi: 955_000, std: 930_000 },
  { lo: 955_000, hi: 1_005_000, std: 980_000 },
  { lo: 1_005_000, hi: 1_055_000, std: 1_030_000 },
  { lo: 1_055_000, hi: 1_115_000, std: 1_090_000 },
  { lo: 1_115_000, hi: 1_180_000, std: 1_150_000 },
  { lo: 1_180_000, hi: 1_260_000, std: 1_220_000 },
  { lo: 1_260_000, hi: 1_340_000, std: 1_300_000 },
  { lo: 1_340_000, hi: 1_355_000, std: 1_380_000 },
  { lo: 1_355_000, hi: null, std: 1_390_000 },
];

export function standardRemunerationForEarnings(monthlyEarningsYen: number): {
  grade: number;
  standardMonthlyRemuneration: number;
} {
  const y = Math.max(0, Math.floor(monthlyEarningsYen));
  for (let i = 0; i < GRADES.length; i++) {
    const g = GRADES[i]!;
    if (y >= g.lo && (g.hi === null || y < g.hi)) {
      return { grade: i + 1, standardMonthlyRemuneration: g.std };
    }
  }
  return { grade: GRADES.length, standardMonthlyRemuneration: GRADES[GRADES.length - 1]!.std };
}
