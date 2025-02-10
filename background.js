// Replace PORT with the actual port number you are using (e.g., 1234)
const WS_URL = "ws://localhost:9182";
let ws = new WebSocket(WS_URL);

ws.onopen = () => {
  console.log("WebSocket connection opened");
};

ws.onmessage = (event) => {
  console.log("Received message:", event.data);
};

ws.onerror = (error) => {
  console.error("WebSocket error:", error);
};

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "executeCode") {
    if (ws.readyState === WebSocket.OPEN) {
      const payload = {
        type: "execute code",
        code: message.code
      };
      ws.send(JSON.stringify(payload));
      sendResponse({ status: "sent" });
    } else {
      sendResponse({ status: "WebSocket not connected" });
    }
  }
});
