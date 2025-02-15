// Replace PORT with the actual port number you are using (e.g., 1234)
const WS_URL = "ws://localhost:9182";
let ws = new WebSocket(WS_URL);

ws.onopen = () => {
  console.log("WebSocket connection opened");
  // executeBtn.disabled = false;
};

ws.onmessage = (event) => {
  console.log("Received message:", event.data);
};

ws.onerror = (error) => {
  console.error("WebSocket error:", error);
};

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "executeCode") {
    console.log(message.type)
    console.log(ws.readyState)
    console.log(WebSocket.OPEN)
    if (ws.readyState === WebSocket.OPEN) {
      console.log(ws.readyState)
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

// Function to add the execute button to a code element
function addExecuteButton(codeElement) {
    // Create a container for our tooltip or red dot button
    const container = document.createElement("div");
    container.style.position = "absolute";
    container.style.right = "0";
    container.style.top = "0";
    container.style.zIndex = "1000";
  
    // Create the red dot or indicator (you can style this as desired)
    const indicator = document.createElement("div");
    indicator.style.width = "10px";
    indicator.style.height = "10px";
    indicator.style.backgroundColor = "red";
    indicator.style.borderRadius = "50%";
    indicator.style.cursor = "pointer";
  
    // Create the tooltip that contains the "Execute Code" button
    const tooltip = document.createElement("div");
    tooltip.style.position = "absolute";
    tooltip.style.right = "15px";
    tooltip.style.top = "0";
    tooltip.style.backgroundColor = "#fff";
    tooltip.style.border = "1px solid #ccc";
    tooltip.style.padding = "5px";
    tooltip.style.display = "none";  // hidden by default
    tooltip.style.zIndex = "1000";
  
    const executeBtn = document.createElement("button");
    executeBtn.textContent = "Execute Code";
    // executeBtn.disabled = true;
    tooltip.appendChild(executeBtn);
  
    // Append both the indicator and tooltip to the container
    container.appendChild(indicator);
    container.appendChild(tooltip);
  
    // Make sure the code element has a relative position for absolute positioning to work
    if (window.getComputedStyle(codeElement).position === "static") {
      codeElement.style.position = "relative";
    }
    codeElement.appendChild(container);
  
    // Show tooltip on hover over indicator
    indicator.addEventListener("mouseover", () => {
      tooltip.style.display = "block";
    });
    indicator.addEventListener("mouseout", () => {
        if (!tooltip.contains(e.relatedTarget)) {
      tooltip.style.display = "none";}
    });
  
    // Prevent tooltip from disappearing when hovered directly
    tooltip.addEventListener("mouseover", () => {
      tooltip.style.display = "block";
    });
    tooltip.addEventListener("mouseout", () => {
      tooltip.style.display = "none";
    });
  
    // When execute button is clicked, send the code content
    // executeBtn.addEventListener("click", (e) => {
    //   e.stopPropagation();
    //   // Extract the code text from the codeElement
    //   const codeContent = codeElement.innerText;
    //   console.log("Code conduct "+ codeContent)
  
    //   // Send message to the background script
    //   chrome.runtime.sendMessage(
    //     { type: "executeCode", code: codeContent },
    //     (response) => {
    //       console.log("Response from background:", response.status);
    //     }
    //   );
    // });
    executeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const codeContent = codeElement.innerText;
      console.log("Code content: " + codeContent);
    
      if (ws.readyState === WebSocket.OPEN) {
        const payload = {
          type: "execute code",
          code: codeContent
        };
        ws.send(JSON.stringify(payload));
        console.log("Sent payload over WebSocket");
      } else {
        console.log("WebSocket not connected");
      }
    });
  }
  
  // After the page loads, find code markup and attach the UI
  function initCodeExecution() {
    console.log("Kalyan");
    // Example selectors – adjust according to the structure of GitHub or your target site.
    const codeBlocks = document.querySelectorAll("pre > code, code");
  
    codeBlocks.forEach((codeBlock) => {
      // Avoid adding duplicate buttons if the script runs more than once
      if (!codeBlock.dataset.executeButtonAdded) {
        addExecuteButton(codeBlock);
        codeBlock.dataset.executeButtonAdded = "true";
      }
    });
  }
  
  // Run after DOM is fully loaded
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initCodeExecution);
  } else {
    console.log(document.readyState)
    initCodeExecution();
  }
  console.log("Kiran")
  // In case of dynamically loaded content (e.g., via AJAX), you might want to run the function periodically or observe mutations.
  