---
title: "PawPOS ElevenLabs Voice Synthesis"
type: "ai"
tags:
  - pawpos
  - ai
  - elevenlabs
  - tts
  - audio
status: "active"
updated_at: "2026-09-06"
related_links:
  - "[[00 - PawPOS Second Brain MOC]]"
  - "[[AI Voice Assistant Pipeline]]"
  - "[[Groq 120B & Whisper Large Turbo]]"
---

# 🗣️ ElevenLabs Voice Synthesis

Untuk menciptakan pengalaman asisten kasir yang benar-benar terasa seperti rekan kerja di toko, **PawPOS** mengintegrasikan **ElevenLabs Multilingual v2** untuk menghasilkan suara Text-to-Speech (TTS) yang hangat, jernih, dan tidak terdengar kaku seperti robot.

---

## 🎧 Konfigurasi Suara Kasir

- **Model**: `eleven_multilingual_v2`
- **Dukungan Bahasa**: Bahasa Indonesia dengan aksentuasi yang fasih dan intonasi kasir yang ramah.
- **Voice ID**: Dipilih karakter suara yang jelas (*clarity* tinggi) agar mudah didengar di lingkungan toko yang bising (suara gonggongan anjing, keramaian pelanggan, atau musik latar toko).
- **Latency Optimization**: Menggunakan streaming chunk audio (format MP3 44.1kHz 64kbps) agar suara mulai terdengar di detik pertama sebelum seluruh kalimat selesai disintesis.

---

## 🔊 Browser Playback Engine

Frontend mendengarkan respons audio stream dan memutarnya menggunakan **HTML5 Web Audio API**:
```ts
export async function playAssistantAudio(audioBlob: Blob): Promise<void> {
  const audioUrl = URL.createObjectURL(audioBlob)
  const audio = new Audio(audioUrl)
  await audio.play()
  audio.onended = () => {
    URL.revokeObjectURL(audioUrl)
  }
}
```

---
*Kembali ke:* [[00 - PawPOS Second Brain MOC]] | *Topik Terkait:* [[AI Voice Assistant Pipeline]], [[Groq 120B & Whisper Large Turbo]]
