---
title: "PawPOS Groq 120B & Whisper Large Turbo"
type: "ai"
tags:
  - pawpos
  - ai
  - groq
  - whisper
  - llm
  - lpu
status: "active"
updated_at: "2026-09-06"
related_links:
  - "[[00 - PawPOS Second Brain MOC]]"
  - "[[AI Voice Assistant Pipeline]]"
  - "[[ElevenLabs Voice Synthesis]]"
---

# ⚡ Groq 120B & Whisper Large Turbo

Dalam skenario operasional kasir, latensi AI di atas 2 detik tidak dapat diterima karena akan membuat pelanggan menunggu di antrean. PawPOS menggunakan **Groq LPU™ (Language Processing Unit)** untuk mencapai latensi inferensi sub-detik yang luar biasa.

---

## 🏎️ Mengapa Groq LPU?

- **Kecepatan Inferensi**: Menghasilkan lebih dari **300 hingga 500 token per detik**.
- **Model yang Digunakan**:
  - `whisper-large-v3-turbo`: Transkripsi audio suara menjadi teks dalam waktu ~150 - 250 milidetik.
  - `llama-3.3-70b-versatile` / `gpt-oss-120b`: Model penalaran mendalam untuk menjawab pertanyaan operasional toko secara akurat dan berbahasa Indonesia yang sopan.

---

## 🧩 Format Prompt System RAG Kasir

Ketika backend mengirimkan query kasir ke Groq, konteks toko disisipkan ke dalam System Prompt:

```markdown
Anda adalah PawPOS AI Copilot, asisten operasional cerdas untuk toko hewan dan klinik pet shop ini.

Konteks Operasional Toko Saat Ini:
- Outlet Aktif: Toko Utama
- Kasir yang Bertugas: Rizky (Shift Pagi Aktif)
- Saldo Kas Laci: Rp 440.000
- Daftar Produk Stok Kritis:
  * Pro Plan Salmon 2.5kg: 11 bag (Batas min: 5 bag)
  * Catit Scratching Post: 8 pcs (Batas min: 2 pcs)

Instruksi Anda:
1. Jawab secara ringkas, to-the-point, dan ramah kasir (maksimal 2-3 kalimat).
2. Gunakan Bahasa Indonesia yang natural.
3. Selalu prioritaskan keselamatan hewan jika ditanya mengenai dosis vitamin atau pakan.
```

---

## 🛡️ Fallback Saat Mode AI Non-Aktif (`AI_ENABLED=false`)

Jika variabel environment `AI_ENABLED=false` atau kunci `GROQ_API_KEY` belum disetel:
- Sistem tidak crash.
- Backend menyediakan **Mock Assistant Engine** berbasis rule-based keyword matching yang tetap merespons pertanyaan umum kasir seperti stok produk, bantuan split payment, dan panduan buka/tutup shift.

---
*Kembali ke:* [[00 - PawPOS Second Brain MOC]] | *Topik Terkait:* [[AI Voice Assistant Pipeline]], [[ElevenLabs Voice Synthesis]]
