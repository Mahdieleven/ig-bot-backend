const express = require("express");
const cors = require("cors");
const axios = require("axios");

require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

/* ---------- تنظیمات اینستاگرام از env ---------- */
const IG_VERIFY_TOKEN = process.env.IG_VERIFY_TOKEN;
const IG_PAGE_ACCESS_TOKEN = process.env.IG_PAGE_ACCESS_TOKEN;
const IG_IG_BUSINESS_ID = process.env.IG_IG_BUSINESS_ID;

/* ---------- هوش مصنوعی ساده لوکال (همون قبلی) ---------- */
function simpleLocalAISuggestion(message) {
  const text = String(message || "").toLowerCase();

  if (text.includes("قیمت") || text.includes("چنده") || text.includes("price")) {
    return "سلام 🌸 مرسی از پیامت، بگو دقیقا کدوم محصول یا مدل رو دیدی تا قیمت و موجودی همون رو دقیق برات بگم.";
  }
  if (
    text.includes("ارسال") ||
    text.includes("پست") ||
    text.includes("تیپاکس") ||
    text.includes("delivery")
  ) {
    return "سلام عزیز 🌷 ارسال‌هامون با پست و تیپاکس انجام می‌شه و معمولا بین ۲ تا ۵ روز کاری به دستت می‌رسه. شهری که هستی رو هم بگو تا دقیق‌تر راهنمایی‌ات کنم.";
  }
  if (
    text.includes("سفارش") ||
    text.includes("خرید") ||
    text.includes("order") ||
    text.includes("چطور")
  ) {
    return "خیلی هم عالی 🛒 لطفاً مدل و رنگ مورد نظرت رو بگو تا هم قیمت رو بگم هم راهنمایت کنم برای ثبت نهایی سفارش.";
  }
  return "سلام 😊 مرسی از پیامت، بگو دقیقا دنبال چه مدل یا چه رنگی هستی تا بهتر و سریع‌تر راهنماییت کنم.";
}

/* ---------- API داخلی که فرانت الان استفاده می‌کنه ---------- */
app.post("/api/ai/suggest", (req, res) => {
  const msg = req.body && req.body.message ? req.body.message : "";
  const suggestion = simpleLocalAISuggestion(msg);
  res.json({ suggestion });
});

/* ===================================================================
   بخش اینستاگرام: Webhook + ارسال پیام
   =================================================================== */

/* 1) Webhook Verification (GET) 
   وقتی URL وبهوک رو تو Meta ثبت می‌کنی، یه GET با hub.challenge می‌زنه */
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === IG_VERIFY_TOKEN) {
    console.log("✅ IG Webhook verified!");
    return res.status(200).send(challenge);
  }

  console.log("❌ IG Webhook verify failed!");
  return res.sendStatus(403);
});

/* 2) Webhook Receiver (POST)
   اینستاگرام وقتی پیام جدید بیاد اینجا POST می‌زند */
app.post("/webhook", async (req, res) => {
  try {
    const body = req.body;
    console.log("📩 Incoming webhook:", JSON.stringify(body, null, 2));

    // ساختار دقیق body تو مستندات اینستاگرام هست؛ اینجا به سادگی یه نمونه هندل می‌کنیم
    if (body.object === "instagram") {
      const entry = body.entry?.[0];
      const changes = entry?.changes?.[0];
      const value = changes?.value;

      // بسته به نسخه API ممکنه value از نوع messaging / messages / ... باشه
      const message = value?.messages?.[0];
      const fromUserId = message?.from;
      const text = message?.text;

      if (fromUserId && text) {
        console.log("پیام جدید از", fromUserId, ":", text);

        // پیشنهاد خودکار بساز
        const replyText = simpleLocalAISuggestion(text);

        // برای اینکه واقعاً جواب بدیم به کاربر، تابع زیر رو فعال کن:
        await sendInstagramMessage(fromUserId, replyText);
      }
    }

    res.sendStatus(200);
  } catch (e) {
    console.error("Webhook error:", e);
    res.sendStatus(500);
  }
});

/* 3) تابع ارسال پیام به اینستاگرام 
   توجه: Endpoint دقیق و فیلدها رو حتماً از مستند رسمی Instagram Graph چک کن */
async function sendInstagramMessage(recipientId, text) {
  if (!IG_PAGE_ACCESS_TOKEN || !IG_IG_BUSINESS_ID) {
    console.warn("⚠️ IG tokens not set, فقط لاگ می‌گیریم:", text);
    return;
  }

  try {
    const url = `https://graph.facebook.com/v19.0/${IG_IG_BUSINESS_ID}/messages`;

    const payload = {
      recipient: { id: recipientId },
      message: { text },
      messaging_type: "RESPONSE",
    };

    const params = {
      access_token: IG_PAGE_ACCESS_TOKEN,
    };

    const response = await axios.post(url, payload, { params });
    console.log("✅ IG DM sent:", response.data);
  } catch (err) {
    console.error("❌ Error sending IG message:", err.response?.data || err.message);
  }
}

/* =================================================================== */

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`IG Bot backend running on http://localhost:${PORT}`);
});
