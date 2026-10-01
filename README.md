# Pronto CRM

Etkinlik firmaları için **e-tablo hızında** müşteri ve katılımcı yönetimi. Google Sheets/Excel alışkanlığıyla çalışın: hücreye tıkla, yaz, Enter'a bas. Görüşme geçmişi kişi kaydının içinde.

> PROJE.TXT'deki tanıma göre geliştirilmiş çalışan prototip (Next.js 15 + SQLite).

## Öne çıkanlar

- **E-tablo ızgarası** — hücre içi düzenleme, klavyeyle gezinme (ok tuşları, Enter, F2, Delete), sütun sıralama, sütun genişletme/gizleme, satır yoğunluğu
- **Yapıştır-aktar** — Google Sheets'ten kopyaladığınız bloğu ızgaraya yapıştırın; mevcut satırlar güncellenir, fazlası yeni kişi olarak eklenir. Ctrl+C ile seçili satırları tekrar Sheets'e taşıyın
- **Görüşme geçmişi** — kişi detayında zaman çizelgesi: tarih, kim, konu, not. "Son görüşme" sütununda renkli sağlık noktası (yeşil ≤30 gün, amber ≤90, kırmızı 90+, gri hiç yok)
- **Hızlı filtreler** — "Hiç görüşülmeyenler", "90+ gündür görüşülmeyenler" gibi hazır görünümler, alan bazlı kurallı filtre editörü, kaydedilebilir görünümler
- **Liste Seçenekleri** — Ünvan, Şehir, Kaynak alanları için lookup yönetimi; Şehirler'de 81 il hazır, diğerlerinde kişilerde geçen değerler. Izgarada ve formlarda öneri olarak çıkar; yeniden adlandırmada kişi kayıtları eşitlenir
- **Etkinlikler** — liste sayfasında arama + durum filtresi + sütun sıralama; etkinlik detayında katılımcı arama + durum filtresi + sıralama
- **İçe aktarma sihirbazı** — Excel (.xlsx/.xls/.csv), Google Sheets (yapıştır), HubSpot ve Zoho CSV dışa aktarımları; Türkçe/İngilizce başlık tanıma, e-posta ile mükerrer yönetimi (atla/güncelle/ekle), görüşme sütunlarını da aktarma
- **Geri al** — her hücre düzenleme ve toplu işlem sonrası toast üzerinden, ayrıca Ctrl+Z
- **Komut paleti** — Ctrl+K ile kişi/etkinlik arama ve hızlı komutlar
- **API entegrasyonları** — Inbound: anahtarlı `POST /api/v1/people`; Outbound: olay bazlı, HMAC imzalı webhook'lar + test gönderimi + teslim günlüğü (Ayarlar → API Entegrasyonları)
- **Yedekleme** — tam JSON yedek indir / geri yükle, kişileri CSV indir
- **Gündüz/gece teması**, denetim kaydı (kim ne zaman ne değiştirdi), basit rol yönetimi (yönetici/ekip üyesi)

## Hızlı başlangıç

```bash
npm install
npm run dev
```

http://localhost:3000 → giriş ekranı:

| Kullanıcı | Şifre | Rol |
|---|---|---|
| ayse@pronto.app | pronto123 | Yönetici |
| can@pronto.app | pronto123 | Ekip üyesi |
| elif@pronto.app | pronto123 | Ekip üyesi |

İlk açılışta SQLite veritabanı (`data/pronto.db`) otomatik oluşur ve **200 kişi, 10 etkinlik, ~350 görüşme** içeren demo verisi üretilir.

```bash
# prodüksiyon derlemesi
npm run build && npm start

# demo verisini sıfırla (sunucu kapalıyken)
npm run reset
```

## Docker ile

```bash
docker compose up --build -d
```

Uygulama `http://localhost:3000` üzerinde çalışır; veritabanı `pronto-data` adlı volume'da kalıcıdır.

## API (inbound) örneği

```bash
# Ayarlar → API Entegrasyonları bölümünden anahtar alın
curl -X POST http://localhost:3000/api/v1/people \
  -H "Authorization: Bearer pronto_sk_..." \
  -H "Content-Type: application/json" \
  -d '{"firstName":"Zeynep","lastName":"Kaya","email":"zeynep@ornek.com"}'
```

## Klavye kısayolları

| Kısayol | İşlev |
|---|---|
| `Ctrl+K` | Komut paleti (ara, git, komut) |
| Ok tuşları | Hücreler arasında gezin |
| `Enter` / `F2` / yazmaya başla | Hücreyi düzenle |
| `Enter` | Kaydet ve aşağı in · `Tab` kaydet ve sağa git |
| `Shift+Enter` | Satırın detay çekmecesini aç |
| `Esc` | Düzenlemeyi iptal et |
| `Delete` | Hücreyi temizle |
| `Ctrl+C` | Aktif hücreyi ya da seçili satırları kopyala |
| `Ctrl+V` | Izgaraya yapıştır (çoklu hücre destekli) |
| `Ctrl+Z` | Son işlemi geri al |
| `Boşluk` | Satırı seç/kaldır |

## Teknoloji

Next.js 15 (App Router, standalone) · TypeScript · Tailwind CSS · shadcn-style Radix bileşenleri · TanStack Query · better-sqlite3 · bcryptjs · SheetJS + PapaParse · Geist font · Docker (node:20-slim)

## Proje yapısı

```
src/
  app/                  sayfalar + API rotaları
    (app)/              oturum gerektiren uygulama kabuğu
    api/                REST uçları (auth, people, events, import, export, keys, webhooks…)
    api/v1/             anahtarlı genel API
  components/
    data-grid/          e-tablo bileşeni
    people/ events/ import/ settings/
  lib/                  db şeması, seed, auth, webhook/audit yardımcıları
data/                   SQLite dosyası (volume'a bağlanır)
```

## Kapsam notları

Bilinçli olarak kapsam dışı: e-posta takibi, takvim entegrasyonu, pazarlama otomasyonu, satış pipeline'ı. "Otomatik yedek" anahtarı ayarı saklar; sunucu tarafı zamanlama ileri sürüm notudur.
