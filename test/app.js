async function sendMessage() {
  const token = document.getElementById("token").value;
  const channel = document.getElementById("channel").value;
  const message = document.getElementById("message").value;

  const response = await fetch("https://your-server.example.com/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, channel, message })
  });

  if (response.ok) {
    alert("送信成功！");
  } else {
    alert("送信失敗...");
  }
}
