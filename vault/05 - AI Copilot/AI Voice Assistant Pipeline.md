---
title: "PawPOS AI Voice Assistant Pipeline"
type: "ai"
tags:
  - pawpos
  - ai
  - voice
  - rag
  - groq
  - elevenlabs
status: "active"
updated_at: "2026-09-06"
related_links:
  - "[[00 - PawPOS Second Brain MOC]]"
  - "[[Groq 120B & Whisper Large Turbo]]"
  - "[[ElevenLabs Voice Synthesis]]"
  - "[[POS Terminal & Cart State]]"
---

# 🎙️ AI Voice Assistant Pipeline

Di tengah kesibukan kasir pet shop saat tangan memegang anjing/kucing pelanggan atau menimbang pakan karung, kasir tidak selalu dapat mengetikkan pertanyaan ke komputer.

**PawPOS AI Copilot** menyediakan asisten operasional suara hands-free (**Natural Voice Operational RAG**) yang memungkinkan kasir bertanya dengan suara dan mendengarkan jawaban asisten secara instan.

---

## 🌊 Pipeline Suara Hulu-ke-Hilir (End-to-End Voice Pipeline)

```mermaid
flowchart TD
    MIC["1. Kasir Tekan Tombol 'Rekam Suara' / Shortcut Mic"] --> RECORDER["MediaRecorder API (Audio WebM/Opus)"]
    
    RECORDER --> UPLOAD["2. POST /api/v1/assistant/transcriptions (FormData Audio)"]
    
    UPLOAD --> WHISPER["3. Groq Whisper Large Turbo (STT Ultra-Fast ~200ms)"]
    
    WHISPER --> TEXT_QUERY["Teks Pertanyaan Kasir:<br/>'Stok Royal Canin Kitten ada berapa ya?'"]
    
    TEXT_QUERY --> RAG_CONTEXT["4. Ambil Konteks Toko Terkini (Store RAG):<br/>- Data Stok Produk<br/>- Status Shift Kasir<br/>- Aturan Bisnis Toko"]
    
    RAG_CONTEXT --> GROQ_LLM["5. Inferensi Groq Llama-3.3-70B / GPT-OSS 120B<br/>(300+ token/detik)"]
    
    GROQ_LLM --> LLM_RESPONSE["Jawaban Asisten Teks:<br/>'Stok Royal Canin Kitten tersisa 24 bag di Toko Utama.'"]
    
    LLM_RESPONSE --> ELEVEN_LABS["6. ElevenLabs Multilingual v2 (Natural TTS)"]
    
    ELEVEN_LABS --> AUDIO_STREAM["Stream Audio Suara Kasir Alami (MP3)"]
    
    AUDIO_STREAM --> SPEAKER["7. Browser Memutar Suara Jawaban Asisten ke Kasir"]
```

---

## 🎯 Use-Cases Utama AI Copilot di Meja Kasir

1. **Pengecekan Stok Kilat**:
   - *Kasir bertanya*: *"Cek stok pasir kucing gumpal lavender."*
   - *AI menjawab*: *"Pasir bentonite lavender masih ada 45 bag di Toko Utama."*
2. **Panduan Transaksi Khusus**:
   - *Kasir bertanya*: *"Bagaimana cara mencatat pembayaran split tunai dan QRIS?"*
   - *AI menjawab*: *"Pilih metode Split di modal bayar, masukkan porsi uang tunai yang diterima, dan biarkan sistem menghitung sisa tagihan QRIS secara otomatis."*
3. **Konsultasi Resep & Nutrisi Hewan**:
   - *Kasir bertanya*: *"Pelanggan tanya pakan untuk kucing yang kulitnya sensitif dan gatal."*
   - *AI menjawab*: *"Rekomendasikan Pro Plan Sensitive Skin & Stomach Salmon 2.5kg yang mengandung asam lemak Omega untuk kesehatan mantel bulu dan kulit kucing."*

---
*Kembali ke:* [[00 - PawPOS Second Brain MOC]] | *Topik Terkait:* [[Groq 120B & Whisper Large Turbo]], [[ElevenLabs Voice Synthesis]]
