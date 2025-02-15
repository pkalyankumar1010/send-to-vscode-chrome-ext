// Global persistent WebSocket instance and message queue.
let wsConnection = null;
let messageQueue = [];
let pingInterval = null;
function displayAlert(message, duration = 2000) {
    const alertDiv = document.createElement('div');
    alertDiv.innerText = message;
    alertDiv.style.position = 'fixed';
    alertDiv.style.bottom = '30px';
    alertDiv.style.left = '50%';
    alertDiv.style.transform = 'translateX(-50%)';
    alertDiv.style.backgroundColor = 'rgba(0, 0, 0, 0.85)';
    alertDiv.style.color = '#fff';
    alertDiv.style.padding = '12px 24px';
    alertDiv.style.borderRadius = '8px';
    alertDiv.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.3)';
    alertDiv.style.fontSize = '16px';
    alertDiv.style.fontWeight = '500';
    alertDiv.style.opacity = '0';
    alertDiv.style.transition = 'opacity 0.3s ease-in-out';
    alertDiv.style.zIndex = '9999';
  
    document.body.appendChild(alertDiv);
    
    // Trigger fade-in.
    window.getComputedStyle(alertDiv).opacity; // force reflow
    alertDiv.style.opacity = '1';
    
    // Remove after the specified duration.
    setTimeout(() => {
      alertDiv.style.opacity = '0';
      setTimeout(() => {
        if (alertDiv.parentElement) {
          alertDiv.parentElement.removeChild(alertDiv);
        }
      }, 300); // match transition duration
    }, duration);
  }
/**
 * Returns the current WebSocket connection if it is open or connecting.
 * Otherwise, creates a new one, attaches event listeners, and returns it.
 */
function getOrCreateWebSocket() {
  // If there is an active connection (OPEN or CONNECTING), reuse it.
  if (wsConnection && (wsConnection.readyState === WebSocket.OPEN || wsConnection.readyState === WebSocket.CONNECTING)) {
    return wsConnection;
  }

  // Create a new WebSocket connection.
  wsConnection = new WebSocket("ws://localhost:9182");

  wsConnection.addEventListener("open", () => {
    console.log("WebSocket connection opened.");

    // Start a ping interval to keep the connection alive.
    if (!pingInterval) {
      pingInterval = setInterval(() => {
        if (wsConnection && wsConnection.readyState === WebSocket.OPEN) {
          wsConnection.send(JSON.stringify({ type: "ping" }));
        }
      }, 10000); // ping every 10 seconds
    }

    // Flush any queued messages.
    while (messageQueue.length > 0) {
      const msg = messageQueue.shift();
      wsConnection.send(JSON.stringify({ type: "execute", content: msg }));
      displayAlert("Code executed successfully!");
    }
  });

  wsConnection.addEventListener("error", (err) => {
    console.error("WebSocket error:", err);
    // Do not close the connection here—allow the server to recover.
  });

  wsConnection.addEventListener("close", () => {
    console.log("WebSocket connection closed.");
    wsConnection = null;
    if (pingInterval) {
      clearInterval(pingInterval);
      pingInterval = null;
    }
  });

  return wsConnection;
}

/**
 * Sends the given code through the persistent WebSocket connection.
 * If the connection is not yet open, the message is queued.
 */
function sendCode(code) {
  const socket = getOrCreateWebSocket();
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ type: "execute", content: code }));
  } else {
    // Queue the message to send when the connection opens.
    messageQueue.push(code);
  }
}
// Wait for dynamic elements on YouTube to load using a MutationObserver
function waitForElement(selector, timeout = 10000) {
    return new Promise((resolve, reject) => {
      const interval = 300;
      let elapsed = 0;
      const timer = setInterval(() => {
        const el = document.querySelector(selector);
        if (el) {
          clearInterval(timer);
          resolve(el);
        }
        elapsed += interval;
        if (elapsed >= timeout) {
          clearInterval(timer);
          reject(`Element ${selector} not found`);
        }
      }, interval);
    });
  }
  
  // Parse GitHub repo link from video description
  function extractGitHubLink(text) {
    const githubLinkRegex = /https?:\/\/github\.com\/([\w.-]+)\/([\w.-]+)/;
    const match = text.match(githubLinkRegex);
    console.log(match)
    if (match) {
      return { owner: match[1], repo: match[2] };
    }
    return null;
  }
  
  // Try fetching README from branchName; returns promise that rejects if not found.
  async function fetchReadme(owner, repo, branchName) {
    const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branchName}/README.md`;
    const response = await fetch(rawUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch README from ${branchName}`);
    }
    return await response.text();
  }
  
  function insertReadmeHtml(html) {
    // Create the outer container.
    const container = document.createElement('div');
    container.id = 'github-readme-container';
    container.style.border = '1px solid #ccc';
    container.style.backgroundColor = '#fff';
    container.style.boxSizing = 'border-box';
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.borderRadius = '10px'; // Curved edges for the container
  
    // Create the fixed header.
    const header = document.createElement('div');
    header.id = 'readme-header';
    header.innerText = 'Readme Chrome Extension';
    header.style.background = 'linear-gradient(135deg, #6a11cb, #2575fc)'; // Gradient background.
    header.style.color = '#fff';               // White text.
    header.style.padding = '12px 20px';          // Extra padding.
    header.style.fontSize = '20px';              // Larger text size.
    header.style.fontWeight = 'bold';            
    header.style.textAlign = 'center';           // Center the text.
    header.style.borderBottom = '2px solid rgba(255, 255, 255, 0.3)';
    header.style.boxShadow = '0 2px 5px rgba(0, 0, 0, 0.2)'; // Subtle drop shadow.
    header.style.flex = '0 0 auto';
      // Round the top corners of the header
  header.style.borderTopLeftRadius = '10px';
  header.style.borderTopRightRadius = '10px';
  
    // Create the content area that will scroll.
    const contentDiv = document.createElement('div');
    contentDiv.id = 'readme-content';
    contentDiv.style.overflowY = 'auto';
    // This div will take up the remaining space.
    contentDiv.style.flex = '1 1 auto';
    
    // Wrap the markdown content in an article with GitHub markdown styling.
    const article = document.createElement('article');
    article.classList.add('markdown-body');
    article.innerHTML = html;
    contentDiv.appendChild(article);
    
    // Append header and content to the container.
    container.appendChild(header);
    container.appendChild(contentDiv);
    
    // Set the container's height to match the YouTube video height.
    let videoContainer = document.querySelector('#player') || document.querySelector('video');
    if (videoContainer) {
      const videoHeight = videoContainer.offsetHeight;
      container.style.height = videoHeight + 'px';
    } else {
      container.style.height = '400px';
    }
    
    // Insert the container into the recommendations area.
    const secondary = document.querySelector('#secondary');
    if (secondary) {
      secondary.prepend(container);
      container.style.width = '100%'; // Use full width of the recommendations column.
    } else {
      // Fallback: position fixed at the right side.
      container.style.position = 'fixed';
      container.style.top = '50px';
      container.style.right = '20px';
      container.style.width = '300px';
    }
    
    return container;
  }
  
  // Append red dot with execute button to each code block in container
  function enhanceCodeBlocks(container) {
    const codeBlocks = container.querySelectorAll('pre');
    codeBlocks.forEach((pre) => {
      // Create the red dot element
      const redDot = document.createElement('span');
      redDot.classList.add('red-dot');
      // Create the hidden execute button
      const executeBtn = document.createElement('button');
      executeBtn.classList.add('execute-btn');
      executeBtn.textContent = 'Execute Code';
      redDot.appendChild(executeBtn);
      pre.style.position = 'relative';
      pre.appendChild(redDot);
          // Variable to store the hide timeout.
    let hideTimeout = null;
    
    function showButton() {
      if (hideTimeout) {
        clearTimeout(hideTimeout);
        hideTimeout = null;
      }
      executeBtn.style.display = 'block';
    }
    
    function hideButton() {
      executeBtn.style.display = 'none';
    }
    
    // Show the button when the mouse enters the red dot or the button.
    redDot.addEventListener('mouseenter', showButton);
    executeBtn.addEventListener('mouseenter', showButton);
    
    // When the mouse leaves either element, set a timeout to hide the button after 2 seconds.
    redDot.addEventListener('mouseleave', () => {
      hideTimeout = setTimeout(() => {
        hideButton();
      }, 2000);
    });
    executeBtn.addEventListener('mouseleave', () => {
      hideTimeout = setTimeout(() => {
        hideButton();
      }, 2000);
    });
  
      // When button is clicked, send the code to the local WebSocket server
      executeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const codeBlock = pre.querySelector('code');
        if (codeBlock) {
          sendCode(codeBlock.textContent);
        }
      });
    });
  }
  
// Send the code using the open WebSocket connection.
// Function to send code using the available WebSocket connection.
// function sendCode(code) {
//     const message = { type: "execute", content: code };
//     getWebSocket()
//       .then(socket => {
//         socket.send(JSON.stringify(message));
//       })
//       .catch(err => {
//         console.error("WebSocket error:", err);
//       });
//   }
  
  // Main function to coordinate everything
  async function init() {
    try {
      // Wait for the description container to load.
      // Updated selector to match YouTube's description element (using the id from your provided HTML)
      const descriptionElement = await waitForElement('ytd-text-inline-expander#description-inline-expander');
      console.log("Description element:", descriptionElement);
      
      // Get the text content of the description
    //   const descriptionText = descriptionElement.innerText || descriptionElement.textContent;
    //   console.log("Description text:", descriptionText);
    // Instead of using the text (which can be truncated), look for an anchor with a GitHub link.
    const githubAnchor = descriptionElement.querySelector("a[href*='github.com']");
    if (!githubAnchor) {
      console.warn("No GitHub repository link found in the description anchors.");
      return;
    }

    // Get the full href; if it's a YouTube redirect, extract the 'q' parameter value.
    let githubUrl = githubAnchor.href;
    if (githubUrl.includes("redirect")) {
      try {
        const urlObj = new URL(githubUrl);
        const extractedUrl = urlObj.searchParams.get("q");
        if (extractedUrl) {
          githubUrl = extractedUrl;
        }
      } catch (e) {
        console.error("Error parsing redirect URL:", e);
      }
    }
    console.log("GitHub URL found:", githubUrl);
      // Extract GitHub repository info from the description text
      const repoInfo = extractGitHubLink(githubUrl);
      if (!repoInfo) {
        console.warn("No GitHub repository link found in the video description.");
        return;
      }
      
      let markdownContent = "";
      // Try fetching README from 'main', then fallback to 'master'
      try {
        markdownContent = await fetchReadme(repoInfo.owner, repoInfo.repo, 'main');
      } catch (e) {
        console.warn(e.message);
        try {
          markdownContent = await fetchReadme(repoInfo.owner, repoInfo.repo, 'master');
        } catch (e) {
          console.error("Failed to fetch README from both 'main' and 'master' branches.");
          return;
        }
      }
    
      // Convert markdown to HTML using marked library (make sure marked is loaded)
      const htmlContent = marked.parse(markdownContent);
      const container = insertReadmeHtml(htmlContent);
      enhanceCodeBlocks(container);
    } catch (error) {
      console.error("Error initializing extension:", error);
    }
  }
  console.log("Content script loaded, starting init...");
  // Run the init function after slight delay to ensure page elements load.
  setTimeout(init, 2000);
  