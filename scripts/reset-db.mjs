import fs from "node:fs";
import path from "node:path";

const dataDir = path.join(process.cwd(), "data");
for (const f of ["pronto.db", "pronto.db-wal", "pronto.db-shm"]) {
  const p = path.join(dataDir, f);
  if (fs.existsSync(p)) {
    fs.rmSync(p);
    console.log("silindi:", p);
  }
}
console.log("Veritabanı silindi. Sunucu yeniden başladığında demo verisi yeniden üretilir.");
