# Lands of Legacy

Tarayıcıda çalışan bir büyük strateji + gerçek zamanlı taktik savaş oyunu.

- **Strateji haritası:** Her oyunda yeniden üretilen bir dünya haritası, bölgeler, uluslar, ekonomi, diplomasi ve yapay zekâ rakipler.
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
| Sağ tık (komşu bölge) | Seçili kuvveti gönder ya da saldır |
| Enter | Turu bitir |

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

## Dosyalar

- `js/mapgen.js` – prosedürel dünya ve bölge üretimi
- `js/strategy.js` – harita, ekonomi, diplomasi ve yapay zekâ
- `js/battle.js` – izometrik gerçek zamanlı savaş motoru
- `js/audio.js` – kodla üretilen ses efektleri
