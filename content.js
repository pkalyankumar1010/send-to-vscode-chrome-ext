// Global persistent WebSocket instance and message queue.
let wsConnection = null;
let messageQueue = [];
let pingInterval = null;

let autoExecEnabled = false;
let autoExecCommands = []; // Array of {time: number, code: string, executed: boolean}
let videoElement = null;
let videoTimeListener = null;
let autoScrollEnabled = false;
let videoScrollListener = null;
// Global reference for the readme container
let readmeContainer = null;
// Helper to reposition the readme container based on the saved position state.
// Position can be "right" (default) or "bottom" (between video and description).
function repositionReadmeContainer() {
  const position = localStorage.getItem('readmePosition') || 'right';
  
  if (!readmeContainer) return;
  
  // Remove container from its current parent.
  if (readmeContainer.parentElement) {
    readmeContainer.parentElement.removeChild(readmeContainer);
  }
  
  if (position === 'bottom') {
    // Insert below the video and above the description.
    // Find the description element (using id "description-inline-expander" from your earlier code).
    // const descriptionElement = document.querySelector('ytd-text-inline-expander#description-inline-expander');
    const descriptionElement = document.querySelector('div#bottom-row');
    if (descriptionElement) {
      descriptionElement.parentNode.insertBefore(readmeContainer, descriptionElement);
      readmeContainer.style.width = '100%';
    } else {
      // Fallback: insert at the end of the primary content.
      document.querySelector('#primary')?.appendChild(readmeContainer);
    }
  } else {
    // Default: insert into the recommendations area (right side)
    const secondary = document.querySelector('#secondary');
    if (secondary) {
      secondary.prepend(readmeContainer);
      readmeContainer.style.width = '100%';
    } else {
      // Fallback: fixed at right
      readmeContainer.style.position = 'fixed';
      readmeContainer.style.top = '50px';
      readmeContainer.style.right = '20px';
      readmeContainer.style.width = '300px';
    }
  }
}
// Functions to enable/disable auto scroll.
function enableAutoScrollFeature() {
  const video = document.querySelector('video');
  if (video && !videoScrollListener) {
    videoScrollListener = updateAutoScroll; // use the updateAutoScroll function as the listener
    video.addEventListener('timeupdate', videoScrollListener);
  }
}

function disableAutoScrollFeature() {
  const video = document.querySelector('video');
  if (video && videoScrollListener) {
    video.removeEventListener('timeupdate', videoScrollListener);
    videoScrollListener = null;
  }
}
// NEW: Convert timestamp (e.g., "0:00" or "01:02:03") to seconds.
function convertTimestampToSeconds(ts) {
  const parts = ts.split(':').map(Number);
  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  } else if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  return 0;
}

// NEW: Transform raw markdown by wrapping scroll sections with a div.
function transformScrollMarkers(markdown) {
  // This regex finds blocks starting with the start marker and ending with the end marker.
  return markdown.replace(
    /<!--SCROLL_START:TIME_STAMP=([\d:]+)-->([\s\S]*?)<!--SCROLL_END:TIME_STAMP=([\d:]+)-->/g,
    (match, start, content, end) => {
      return `<div class="scroll-section" data-start="${start.trim()}" data-end="${end.trim()}">\n${content}\n</div>`;
    }
  );
}
// NEW: Update auto-scroll based on the current video time.
function updateAutoScroll() {
  const video = document.querySelector('video');
  if (!video) return;
  const currentTime = video.currentTime;
  const contentDiv = document.getElementById('readme-content');
  if (!contentDiv) return;

  // Find the active scroll section
  const sections = contentDiv.querySelectorAll('.scroll-section');
  let activeSection = null;
  for (const section of sections) {
    const startSec = convertTimestampToSeconds(section.dataset.start);
    const endSec = convertTimestampToSeconds(section.dataset.end);
    if (currentTime >= startSec && currentTime <= endSec) {
      activeSection = section;
      break;
    }
  }

  if (!activeSection) return;

  // Calculate scroll parameters
  const startSec = convertTimestampToSeconds(activeSection.dataset.start);
  const endSec = convertTimestampToSeconds(activeSection.dataset.end);
  const progress = Math.max(0, Math.min(1, (currentTime - startSec) / (endSec - startSec)));

  const sectionTop = activeSection.offsetTop;
  const sectionHeight = activeSection.offsetHeight;
  const containerHeight = contentDiv.clientHeight;

  // Calculate scroll range for this section
  const scrollStart = sectionTop;
  const scrollEnd = sectionTop + sectionHeight - containerHeight;
  
  // Only animate scroll if section is taller than container
  if (scrollEnd > scrollStart) {
    const targetScroll = scrollStart + (progress * (scrollEnd - scrollStart));
    contentDiv.scrollTop = targetScroll;
  } else {
    contentDiv.scrollTop = scrollStart;
  }
}
// ===========================================
// NEW: Parse auto-execution commands from raw markdown
// ===========================================
function parseAutoExecCommands(markdown) {
  let commands = [];
  // Regex to capture commands wrapped in the special comments.
  const regex = /<!--START:PLAYLIVECODE\s+TIME=(\d+)s-->\s*```[a-zA-Z]*\s*([\s\S]*?)\s*```[\s\S]*?<!--END:PLAYLIVECODE-->/g;
  let match;
  while ((match = regex.exec(markdown)) !== null) {
    let time = parseInt(match[1], 10);
    let code = match[2].trim();
    commands.push({ time: time, code: code, executed: false });
  }
  return commands;
}

// ===========================================
// NEW: Functions to enable/disable auto-execution
// ===========================================
function enableAutoExec() {
  videoElement = document.querySelector('video');
  if (videoElement && !videoTimeListener) {
    videoTimeListener = function() {
      const currentTime = videoElement.currentTime;
      autoExecCommands.forEach(cmd => {
        if (!cmd.executed && currentTime >= cmd.time) {
          sendCode(cmd.code);
          cmd.executed = true;
        }
      });
      // NEW: Process insert commands
      insertCommands.forEach(cmd => {
        if (!cmd.executed && currentTime >= cmd.time) {
          sendInsertCode(cmd);
          cmd.executed = true;
        }
      });
    };
    videoElement.addEventListener('timeupdate', videoTimeListener);
  }
}

function disableAutoExec() {
  if (videoElement && videoTimeListener) {
    videoElement.removeEventListener('timeupdate', videoTimeListener);
    videoTimeListener = null;
  }
}

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
          // wsConnection.send(JSON.stringify({ type: "ping" }));
        }
      }, 10000); // ping every 10 seconds
    }

    // Flush any queued messages.
    while (messageQueue.length > 0) {
      const msg = messageQueue.shift();
      wsConnection.send(JSON.stringify({ type: "execCode", content: msg }));
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
    displayAlert("Code executed successfully!");
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
      // Save container globally so it can be repositioned later.
  readmeContainer = container;
  
    // Create the fixed header.
    const header = document.createElement('div');
    header.id = 'readme-header';
    header.innerText = 'Play Live Code';
    header.style.background = 'linear-gradient(135deg, #6a11cb, #2575fc)'; // Gradient background.
    header.style.color = '#fff';               // White text.
    header.style.padding = '12px 20px';          // Extra padding.
    header.style.fontSize = '20px';              // Larger text size.
    header.style.fontWeight = 'bold';            
    header.style.textAlign = 'center';           // Center the text.
    if ((localStorage.getItem('readmePosition') || 'right') === 'right') {
      header.style.textAlign = 'left'; // Extra space for toggles when at right.
    } else {
      header.style.textAlign = 'center';
    }
    header.style.borderBottom = '2px solid rgba(255, 255, 255, 0.3)';
    header.style.boxShadow = '0 2px 5px rgba(0, 0, 0, 0.2)'; // Subtle drop shadow.
    header.style.flex = '0 0 auto';
      // Round the top corners of the header
  header.style.borderTopLeftRadius = '10px';
  header.style.borderTopRightRadius = '10px';
  header.style.position = 'relative'; // to position toggle button

    // ------------------------------
  // NEW: Readme Position Toggle
  // ------------------------------
  const positionToggleContainer = document.createElement('div');
  positionToggleContainer.style.position = 'absolute';
  positionToggleContainer.style.top = '10px';
  positionToggleContainer.style.right = '120px'; // Adjust so it doesn't overlap other toggles
  positionToggleContainer.style.cursor = 'pointer';
  positionToggleContainer.title = 'Toggle Readme Position';

  const positionToggleInput = document.createElement('input');
  positionToggleInput.type = 'checkbox';
  positionToggleInput.id = 'readmePositionToggle';
  positionToggleInput.style.display = 'none';

  const positionToggleLabel = document.createElement('label');
  positionToggleLabel.htmlFor = 'readmePositionToggle';
  positionToggleLabel.style.width = '40px';
  positionToggleLabel.style.height = '20px';
  positionToggleLabel.style.background = '#ccc';
  positionToggleLabel.style.borderRadius = '20px';
  positionToggleLabel.style.display = 'inline-block';
  positionToggleLabel.style.verticalAlign = 'middle';
  positionToggleLabel.style.position = 'relative';

  const positionToggleCircle = document.createElement('span');
  positionToggleCircle.style.position = 'absolute';
  positionToggleCircle.style.top = '2px';
  // Default "right" position: circle left at 2px.
  positionToggleCircle.style.left = '2px';
  positionToggleCircle.style.width = '16px';
  positionToggleCircle.style.height = '16px';
  positionToggleCircle.style.background = '#fff';
  positionToggleCircle.style.borderRadius = '50%';
  positionToggleCircle.style.transition = '0.3s';

  positionToggleLabel.appendChild(positionToggleCircle);
  positionToggleContainer.appendChild(positionToggleInput);
  positionToggleContainer.appendChild(positionToggleLabel);
  header.appendChild(positionToggleContainer);
  
    // Initialize the toggle based on localStorage (default "right" if not set).
    let storedPosition = localStorage.getItem('readmePosition') || 'right';
    if(storedPosition === 'bottom'){
      positionToggleInput.checked = true;
      positionToggleLabel.style.background = '#66bb6a';
      positionToggleCircle.style.left = '22px';
    } else {
      positionToggleInput.checked = false;
      positionToggleLabel.style.background = '#ccc';
      positionToggleCircle.style.left = '2px';
    }
    
    // Toggle event listener: update localStorage and reposition the container.
    positionToggleInput.addEventListener('change', function() {
      if (positionToggleInput.checked) {
        localStorage.setItem('readmePosition', 'bottom');
        positionToggleLabel.style.background = '#66bb6a';
        positionToggleCircle.style.left = '22px';
      } else {
        localStorage.setItem('readmePosition', 'right');
        positionToggleLabel.style.background = '#ccc';
        positionToggleCircle.style.left = '2px';
      }
      repositionReadmeContainer();
    });
    // ------------------------------
  // NEW: Auto Scroll Toggle
  // ------------------------------
  const autoScrollToggleContainer = document.createElement('div');
  autoScrollToggleContainer.style.position = 'absolute';
  autoScrollToggleContainer.style.top = '10px';
  autoScrollToggleContainer.style.right = '60px'; // positioned slightly left of other toggles if any
  autoScrollToggleContainer.style.cursor = 'pointer';
  autoScrollToggleContainer.title = 'Auto Scroll';

  const autoScrollToggleInput = document.createElement('input');
  autoScrollToggleInput.type = 'checkbox';
  autoScrollToggleInput.id = 'autoScrollToggle';
  autoScrollToggleInput.style.display = 'none';

  const autoScrollToggleLabel = document.createElement('label');
  autoScrollToggleLabel.htmlFor = 'autoScrollToggle';
  autoScrollToggleLabel.style.width = '40px';
  autoScrollToggleLabel.style.height = '20px';
  autoScrollToggleLabel.style.background = '#ccc';
  autoScrollToggleLabel.style.borderRadius = '20px';
  autoScrollToggleLabel.style.display = 'inline-block';
  autoScrollToggleLabel.style.verticalAlign = 'middle';
  autoScrollToggleLabel.style.position = 'relative';

  const autoScrollToggleCircle = document.createElement('span');
  autoScrollToggleCircle.style.position = 'absolute';
  autoScrollToggleCircle.style.top = '2px';
  autoScrollToggleCircle.style.left = '2px';
  autoScrollToggleCircle.style.width = '16px';
  autoScrollToggleCircle.style.height = '16px';
  autoScrollToggleCircle.style.background = '#fff';
  autoScrollToggleCircle.style.borderRadius = '50%';
  autoScrollToggleCircle.style.transition = '0.3s';

  autoScrollToggleLabel.appendChild(autoScrollToggleCircle);
  autoScrollToggleContainer.appendChild(autoScrollToggleInput);
  autoScrollToggleContainer.appendChild(autoScrollToggleLabel);
  header.appendChild(autoScrollToggleContainer);

// Initialize Auto Scroll state from localStorage.
let storedAutoScroll = localStorage.getItem('autoScrollEnabled') === 'true';
autoScrollToggleInput.checked = storedAutoScroll;
if(storedAutoScroll){
  autoScrollToggleLabel.style.background = '#66bb6a';
  autoScrollToggleCircle.style.left = '22px';
  enableAutoScrollFeature();
} else {
  autoScrollToggleLabel.style.background = '#ccc';
  autoScrollToggleCircle.style.left = '2px';
  disableAutoScrollFeature();
}

autoScrollToggleInput.addEventListener('change', function() {
  if (autoScrollToggleInput.checked) {
    localStorage.setItem('autoScrollEnabled', 'true');
    autoScrollToggleLabel.style.background = '#66bb6a';
    autoScrollToggleCircle.style.left = '22px';
    enableAutoScrollFeature();
  } else {
    localStorage.setItem('autoScrollEnabled', 'false');
    autoScrollToggleLabel.style.background = '#ccc';
    autoScrollToggleCircle.style.left = '2px';
    disableAutoScrollFeature();
  }
});
    // ===========================================
  // NEW: Create the toggle button for auto code execution
  // ===========================================
  const toggleContainer = document.createElement('div');
  toggleContainer.style.position = 'absolute';
  toggleContainer.style.top = '10px';
  toggleContainer.style.right = '10px';
  toggleContainer.style.cursor = 'pointer';
  toggleContainer.title = 'Execute in Sync';

  // Hidden checkbox
  const toggleInput = document.createElement('input');
  toggleInput.type = 'checkbox';
  toggleInput.id = 'autoExecToggle';
  toggleInput.style.display = 'none';

  // Custom toggle label styling like a day/night switch
  const toggleLabel = document.createElement('label');
  toggleLabel.htmlFor = 'autoExecToggle';
  toggleLabel.style.width = '40px';
  toggleLabel.style.height = '20px';
  toggleLabel.style.background = '#ccc';
  toggleLabel.style.borderRadius = '20px';
  toggleLabel.style.display = 'inline-block';
  toggleLabel.style.verticalAlign = 'middle';
  toggleLabel.style.position = 'relative';

  const toggleCircle = document.createElement('span');
  toggleCircle.style.position = 'absolute';
  toggleCircle.style.top = '2px';
  toggleCircle.style.left = '2px';
  toggleCircle.style.width = '16px';
  toggleCircle.style.height = '16px';
  toggleCircle.style.background = '#fff';
  toggleCircle.style.borderRadius = '50%';
  toggleCircle.style.transition = '0.3s';

  toggleLabel.appendChild(toggleCircle);
  toggleContainer.appendChild(toggleInput);
  toggleContainer.appendChild(toggleLabel);
  header.appendChild(toggleContainer);

  // Event listener for toggle changes.
  toggleInput.addEventListener('change', function() {
    autoExecEnabled = toggleInput.checked;
    if (autoExecEnabled) {
      enableAutoExec();
      toggleLabel.style.background = '#66bb6a';
      toggleCircle.style.left = '22px';
    } else {
      disableAutoExec();
      toggleLabel.style.background = '#ccc';
      toggleCircle.style.left = '2px';
    }
  });
  
  
    // Create the content area that will scroll.
    const contentDiv = document.createElement('div');
    contentDiv.id = 'readme-content';
    contentDiv.style.overflowY = 'auto';
    contentDiv.style.paddingLeft = '10px';
    // This div will take up the remaining space.
    contentDiv.style.flex = '1 1 auto';
    contentDiv.style.scrollBehavior = 'smooth';
    
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
     // Insert the container based on the saved position.
  repositionReadmeContainer(); 
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
  // ===========================================
// NEW: Parse insert commands from raw markdown
// ===========================================
// This function extracts commands with FILEPATH, SEARCHSTRING and TIME.
function parseInsertCommands(markdown) {
  let commands = [];
  const regex = /<!--START:INSERT PLAYLIVECODE\s+FILEPATH='([^']+)'\s+SEARCHSTRING='([^']+)'\s+TIME=(\d+)s-->\s*```[a-zA-Z]*\s*([\s\S]*?)\s*```[\s\S]*?<!--END:INSERT PLAYLIVECODE-->/g;
  let match;
  while ((match = regex.exec(markdown)) !== null) {
    let file = match[1].trim();
    let searchString = match[2].trim();
    let time = parseInt(match[3], 10);
    let code = match[4].trim();
    commands.push({ file: file, searchString: searchString, time: time, code: code, executed: false });
  }
  return commands;
}

// ===========================================
// NEW: Function to send insert code command via WebSocket
// ===========================================
function sendInsertCode(cmd) {
  const socket = getOrCreateWebSocket();
  const message = {
    type: "insertCode",
    code: cmd.code,
    file: cmd.file,
    searchString: cmd.searchString
  };
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(message));
    displayAlert("Insert code executed successfully!");
  } else {
    // If socket is not open, queue the message (you might want a separate queue for insert commands)
    messageQueue.push(JSON.stringify(message));
  }
}

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

      // NEW: Transform markdown to wrap scroll sections.
      markdownContent = transformScrollMarkers(markdownContent);
      // NEW: Parse auto code execution commands from raw markdown.
      autoExecCommands = parseAutoExecCommands(markdownContent);
      console.log("Auto-exec commands:", autoExecCommands);
      insertCommands = parseInsertCommands(markdownContent);
      console.log("Insert commands:", insertCommands);
    
      // Convert markdown to HTML using marked library (make sure marked is loaded)
      const htmlContent = marked.parse(markdownContent);
      const container = insertReadmeHtml(htmlContent);
          // NEW: Attach a timeupdate listener for auto-scroll if scroll markers exist.
    const contentDiv = document.getElementById('readme-content');
    if (contentDiv && contentDiv.querySelector('.scroll-section')) {
      const videoEl = document.querySelector('video');
      if (videoEl) {
        videoEl.addEventListener('timeupdate', updateAutoScroll);
      }
    }
      enhanceCodeBlocks(container);
    } catch (error) {
      console.error("Error initializing extension:", error);
    }
  }
  console.log("Content script loaded, starting init...");
  // Run the init function after slight delay to ensure page elements load.
  setTimeout(init, 2000);
  