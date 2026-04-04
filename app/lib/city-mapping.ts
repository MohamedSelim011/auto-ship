const CITIES: { id: number; names: string[] }[] = [
  { id: 1,  names: ["قاهره", "القاهره", "القاهرة", "cairo", "cario", "nasr city", "nasrcity", "nasr", "shubra el kheima", "shubra el-kheima", "shubra", "شبرا الخيمة", "شبرا", "مدينة نصر"] },
  { id: 2,  names: ["اسكندريه", "اسكندرية", "alexandria", "alex", "alexandriya"] },
  { id: 3,  names: ["جيزة", "الجيزة", "giza", "gizaah"] },
  { id: 4,  names: ["قليوبية", "qalyubia", "qalyoubia", "kaliobia"] },
  { id: 5,  names: ["مطروح", "matrouh", "marsa matrouh", "matroh"] },
  { id: 6,  names: ["اسوان", "aswan", "asuan"] },
  { id: 8,  names: ["المنوفية", "monufia", "menofia", "monofeya"] },
  { id: 10, names: ["البحيرة", "beheira", "behira", "el beheira"] },
  { id: 12, names: ["كفر الشيخ", "kafr el sheikh", "kafr el-sheikh", "kafrelshiekh", "kafrelsheikh", "kafr"] },
  { id: 14, names: ["شرقيه", "الشرقية", "sharqia", "sharkia"] },
  { id: 15, names: ["غربيه", "gharbia", "gharbiya"] },
  { id: 16, names: ["بحر الاحمر", "red sea", "redsea", "hurghada"] },
  { id: 17, names: ["شرم الشيخ", "sharm el sheikh", "sharm el-sheikh", "sharm", "sharmelsheikh"] },
  { id: 18, names: ["اسماعيلية", "ismailia", "ismailiya"] },
  { id: 19, names: ["سويس", "السويس", "suez"] },
  { id: 20, names: ["بورسعيد", "port said", "portsaid"] },
  { id: 21, names: ["دقهلية", "dakahlia", "dakahlya"] },
  { id: 22, names: ["دمياط", "damietta", "dumyat"] },
  { id: 23, names: ["فيوم", "fayoum", "faiyum"] },
  { id: 24, names: ["منيا", "minya", "menya"] },
  { id: 25, names: ["بني سويف", "beni suef", "bani suef"] },
  { id: 26, names: ["اسيوط", "assiut", "asyut"] },
  { id: 27, names: ["اقصر", "الأقصر", "luxor"] },
  { id: 28, names: ["سوهاج", "sohag", "sohaj"] },
  { id: 29, names: ["قنا", "qena", "kena"] },
  { id: 30, names: ["مترو", "metro", "cairo metro"] },
  { id: 31, names: ["وادي جديد", "new valley", "newvalley"] },
  { id: 32, names: ["خارج التغطية", "out of coverage", "outside area"] },
  { id: 33, names: ["جنوب سيناء", "south sinai", "southsinai"] },
];

// Build a flat lookup map: normalized name → id
const CITY_LOOKUP = new Map<string, number>();
for (const city of CITIES) {
  for (const name of city.names) {
    CITY_LOOKUP.set(name.toLowerCase(), city.id);
  }
}

export function resolveCityId(cityName: string): number {
  return CITY_LOOKUP.get(cityName.trim().toLowerCase()) ?? 1;
}
