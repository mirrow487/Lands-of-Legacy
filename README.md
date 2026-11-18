# Lands of Legacy

Tarayıcıda çalışan bir büyük strateji + gerçek zamanlı taktik savaş oyunu.

- **İki harita:** Gerçek dünya (1936, 165 ülke; istediğin ülkeyi seç) ya da Azgaar tarzı hayali dünya (yükselti, biyomlar, nehirler, dağ ve orman simgeleri).
- **Sefer haritası (Bannerlord tarzı):** Zaman sürekli akar (duraklat / 1x / 2x / 4x). Garnizonlardan ordu kurulur; ordular bayraklarıyla haritada yürür, düşman bölgelerini kuşatır ve düşman ordularıyla meydan muharebesine girer. Yapay zekâ orduları da haritada dolaşır.
- **Danışman:** Her ay durumu değerlendirip öneri veren baş danışman. Ayarlar > Yapay Zekâ bölümünden herkes kendi **Gemini** ya da **Claude** API anahtarını bağlarsa danışman oyunun anlık durumunu görerek sorulara yanıt verir (anahtar yalnızca o tarayıcıda saklanır).
- **Büyük strateji:** Her oyunda yeniden üretilen dünya, 8 ulus (kendi bayrakları ve liderleriyle), aylık takvim (1936'dan başlar), hazine / insan gücü / istikrar / araştırma, binalar (fabrika, tahkimat, kışla), 15 teknoloji, ittifaklar ve ilişkiler, seçimli rastgele olaylar, Dünya Gazetesi haber akışı ve 5 harita modu.
- **8 birlik türü:** Piyade, Makineli Tüfek, Tanksavar, Zırhlı Keşif, Tank, Ağır Tank, Topçu, Roket Topçusu.
- **İzometrik savaş alanı:** Bir muharebe başladığında savaş alanına girip piyade, tank ve topçu birliklerini gerçek zamanlı olarak yönetirsin (sürükleyerek seçme, sağ tıkla hareket/saldırı, kontrol grupları, mini harita).

## Çalıştırma

**En kolay yol:** `LandsOfLegacy.html` dosyasını indirip tarayıcıda aç. Tüm oyun bu tek dosyanın içinde.

`index.html` ise `css/` ve `js/` klasörleriyle birlikte çalışır; tek başına indirilirse sayfa stilsiz ve boş görünür.
Kaynak dosyaları değiştirdikten sonra tek dosyalık sürümü yeniden üretmek için:

```bash
python3 build.py
```

İstersen yerel bir sunucuyla da açabilirsin:

```bash
python3 -m http.server 8000
```

Sonra tarayıcıda `http://localhost:8000` adresine git.

## Kontroller

### Strateji haritası
| Girdi | Ne yapar |
|---|---|
| Sol tık | Bölge seç |
| Sürükle / tekerlek | Haritayı kaydır / yakınlaştır |
| Sol tık (ordu) | Orduyu seç |
| Sağ tık | Seçili orduyu oraya yürüt / düşman ordusunun peşine düş |
| Boşluk / 1-2-3 | Zamanı duraklat / hız |
| F | Seçili orduyu kamerayla izle |

### Savaş alanı
| Girdi | Ne yapar |
|---|---|
| Sol tık / sürükle | Birlik seç / kutu seçimi |
| Çift tık | Ekrandaki aynı türden birlikleri seç |
| Sağ tık | Hareket et / hedefe saldır |
| Ctrl + sağ tık, `A` | Saldırı hareketi |
| `S` / `Q` / `P` | Dur / tümünü seç / duraklat |
| Ctrl+1-9, 1-9 | Kontrol grubu kur / seç |
| Ok tuşları, ekran kenarı, orta tuş | Kamera |

## Savaş alanı

Sis perdesi, mevsime ve araziye göre değişen zemin (kar, çöl, ılıman), hava durumu (yağmur, sis, kar, kum fırtınası), köprüler, tarlalar, yıkılabilen ağaç ve evler, tahkimatlar ve birlik tecrübesi (rütbe).

## Ses

Tüm sesler kodla üretilir: mesafeye göre süzülen ve yankılanan silah sesleri, topçu mermisi ıslığı, savaş alanı ambiyansı, strateji ve savaş için ayrı müzikler. Tarayıcıda Türkçe konuşma sesi varsa birlikler telsizden cevap verir. Ses seviyeleri Ayarlar menüsünden değiştirilebilir.

## Veri ve lisanslar

- Ülke sınırları: Natural Earth (kamu malı), `world-atlas` paketi üzerinden sadeleştirilmiş olarak `js/worlddata.js` içinde.
- `js/vendor-anthropic.js`: Anthropic TypeScript SDK (MIT), yalnızca isteğe bağlı yapay zekâ danışmanı için tarayıcıya paketlenmiştir.

## Dosyalar

- `js/mapgen.js` – hayali dünya üretimi ve gerçek dünya haritasının bölgelere ayrılması
- `js/worldinfo.js` – ülkelerin Türkçe adları, başkentleri ve bayrakları
- `js/advisor.js` – danışman (öneriler ve isteğe bağlı Claude sohbeti)
- `js/strategy.js` – harita, ekonomi, diplomasi ve yapay zekâ
- `js/battle.js` – izometrik gerçek zamanlı savaş motoru
- `js/audio.js` – kodla üretilen ses efektleri
