// Simple tests for helper functions

// Test extractGitHubLink
function testExtractGitHubLink() {
    const text = "Check out my repo at https://github.com/testuser/testrepo for details.";
    const result = extractGitHubLink(text);
    console.assert(result && result.owner === "testuser" && result.repo === "testrepo", "extractGitHubLink failed");
  }
  
  // Test that sendCode sends proper JSON
  function testSendCode() {
    // Mock WebSocket by replacing the global WebSocket constructor
    let sentMessage = null;
    const originalWebSocket = window.WebSocket;
    window.WebSocket = function(url) {
      this.url = url;
      setTimeout(() => {
        this.onopen && this.onopen();
      }, 0);
      this.send = function(message) {
        sentMessage = message;
      };
      this.close = function() {};
    };
  
    sendCode("console.log('Hello');");
    setTimeout(() => {
      console.assert(sentMessage, "No message was sent");
      const parsed = JSON.parse(sentMessage);
      console.assert(parsed.type === "execute" && parsed.content === "console.log('Hello');", "Message format incorrect");
      // Restore original WebSocket
      window.WebSocket = originalWebSocket;
      console.log("testSendCode passed");
    }, 50);
  }
  
  // Run tests
  testExtractGitHubLink();
  testSendCode();
  