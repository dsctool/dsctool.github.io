import express from "express";
import fetch from "node-fetch";

const app = express();
app.use(express.json());

app.post("/send", async (req, res) => {
  const { token, channel, message } = req.body;

  const discordRes = await fetch(`https://discord.com/api/v10/channels/${channel}/messages`, {
    method: "POST",
    headers: {
      "Authorization": `Bot ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ content: message })
  });

  if (discordRes.ok) {
    res.send({ success: true });
  } else {
    res.status(500).send({ error: "Discord送信失敗" });
  }
});

app.listen(3000, () => console.log("API running"));
