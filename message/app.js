document.getElementById("discordForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const token = document.getElementById("token").value;
  const channel = document.getElementById("channel").value;
  const message = document.getElementById("message").value;

  const progress = document.getElementById("progress");
  const notification = document.getElementById("notification");

  // プログレスバー表示
  progress.classList.remove("hidden");
  notification.classList.add("hidden");

  try {
    const res = await fetch(`https://discord.com/api/v10/channels/${channel}/messages`, {
      method: "POST",
      headers: {
        "Authorization": `Bot ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ content: message })
    });

    progress.classList.add("hidden");

    if (res.ok) {
      notification.textContent = "✅ 送信成功！";
      notification.className = "notification success";
    } else {
      notification.textContent = "❌ 送信失敗...";
      notification.className = "notification error";
    }
    notification.classList.remove("hidden");

  } catch (err) {
    progress.classList.add("hidden");
    notification.textContent = "⚠️ エラーが発生しました";
    notification.className = "notification error";
    notification.classList.remove("hidden");
  }
});
