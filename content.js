// Function to inject the script
function injectScript() {
  const script = document.createElement('script');
  script.src = chrome.runtime.getURL('inject-script.js');
  script.onload = function() {
    this.remove();
  };
  
  // Try to append to document.head first, fallback to document.documentElement
  if (document.head) {
    document.head.appendChild(script);
  } else if (document.documentElement) {
    document.documentElement.appendChild(script);
  } else {
    // If neither is available, wait for DOM ready
    document.addEventListener('DOMContentLoaded', () => {
      document.head.appendChild(script);
    });
  }
}

// If the document is already loading or loaded, inject immediately
if (document.readyState !== 'loading') {
  injectScript();
} else {
  // Otherwise, wait for the DOM to be ready
  document.addEventListener('DOMContentLoaded', injectScript);
}

// Listen for messages from the injected script
window.addEventListener('message', function(event) {
  // Only accept messages from the same origin
  if (event.origin !== window.location.origin) return;
  
  // Only process messages from our injected script
  if (event.source !== window || !event.data.type) return;
  
  if (event.data.type === 'BATTLE_ENDED') {
    console.log('[EXTENSION] Battle ended:', event.data);
    onBattleEnd(event.data.battleId, event.data.endMessage);
  }
}, false);

// Track active battles
const activeBattles = new Set();

// Enable debugging
const DEBUG = true;

function debugLog(message) {
  if (DEBUG) {
    console.log(`[Replay Saver] ${message}`);
  }
}

// Handle when a battle ends
function onBattleEnd(battleId, endMessage) {
  debugLog(`Battle ended: ${battleId}`);
  activeBattles.delete(battleId);
  
  // Wait a bit before saving to ensure battle is fully ended
  setTimeout(() => {
    saveReplay(battleId);
  }, 100);
}

// Send the /savereplay command
function saveReplay(battleId) {
  debugLog(`Attempting to save replay for ${battleId}`);
  
  // Find the chat form for this battle
  const roomElement = document.getElementById('room-' + battleId);
  if (!roomElement) {
    debugLog(`Room element not found for ${battleId}`);
    return;
  }
  
  const chatForm = roomElement.querySelector('.battle-log-add form.chatbox');
  const chatInput = roomElement.querySelector('.battle-log-add form.chatbox textarea.textbox:not([aria-hidden="true"])');
  
  if (!chatForm || !chatInput) {
    debugLog(`Chat form or input not found for ${battleId}`);
    debugLog(`Form found: ${!!chatForm}, Input found: ${!!chatInput}`);
    return;
  }
  
  debugLog(`Found chat form and input for ${battleId}`);
  
  try {
    // Clear any existing value
    chatInput.value = '';
    
    // Set focus to the input
    chatInput.focus();
    
    // Type the command
    chatInput.value = '/savereplay silent';
    
    // Trigger input events to ensure the form recognizes the change
    chatInput.dispatchEvent(new Event('input', { bubbles: true }));
    chatInput.dispatchEvent(new Event('change', { bubbles: true }));
    
    // Submit the form
    const submitEvent = new Event('submit', { 
      bubbles: true, 
      cancelable: true 
    });
    
    const submitted = chatForm.dispatchEvent(submitEvent);
    debugLog(`Form submit event dispatched: ${submitted}`);
    
    // Alternative: Simulate Enter key press
    const enterEvent = new KeyboardEvent('keydown', {
      bubbles: true,
      key: 'Enter',
      keyCode: 13,
      which: 13
    });
    
    chatInput.dispatchEvent(enterEvent);
    debugLog(`Enter key event dispatched`);
    
    // Wait a bit then construct and save the replay URL
    setTimeout(() => {
      const replayUrl = constructReplayUrl(battleId);
      saveReplayToStorage(replayUrl, battleId);
    }, 2000);
    
  } catch (error) {
    debugLog(`Error sending command: ${error.message}`);
  }
}

// Construct the replay URL from battle ID
function constructReplayUrl(battleId) {
  // Remove 'battle-' prefix to get the replay ID
  const replayId = battleId.replace('battle-', '');
  const replayUrl = `https://replay.pokemonshowdown.com/${replayId}`;
  debugLog(`Constructed replay URL: ${replayUrl}`);
  return replayUrl;
}

// Save the replay to extension storage
function saveReplayToStorage(replayUrl, battleId) {
  const replayId = replayUrl.split('/').pop();
  const timestamp = new Date().toISOString();
  
  // First, check if this replay already exists
  chrome.storage.local.get('replays', (data) => {
    const replays = data.replays || [];
    
    // Check for duplicates by URL
    const existingReplay = replays.find(replay => replay.url === replayUrl);
    if (existingReplay) {
      debugLog(`Replay already exists, skipping: ${replayUrl}`);
      debugLog(`Existing replay from: ${existingReplay.timestamp}`);
      
      // Show a different notification for duplicates
      showDuplicateNotification(battleId, replayUrl);
      return;
    }
    
    // Extract battle information
    let format = 'Unknown Format';
    let players = [];
    
    try {
      const battleRoom = document.getElementById('room-' + battleId);
      if (battleRoom) {
        // Extract format from battle ID
        const formatMatch = battleId.match(/battle-([^-]+)-/);
        if (formatMatch) {
          format = formatMatch[1].replace(/([a-z])([A-Z])/g, '$1 $2');
          format = format.charAt(0).toUpperCase() + format.slice(1);
        }
        
        // Try to get player names from various sources
        const leftTrainer = battleRoom.querySelector('.battle .leftbar .trainer');
        const rightTrainer = battleRoom.querySelector('.battle .rightbar .trainer');
        
        if (leftTrainer && rightTrainer) {
          players = [leftTrainer.textContent.trim(), rightTrainer.textContent.trim()];
        } else {
          // Fallback: try to extract from battle log
          const battleLog = battleRoom.querySelector('.battle-log');
          if (battleLog) {
            const initMessage = battleLog.textContent;
            const playerMatch = initMessage.match(/(\w+) vs\. (\w+)/);
            if (playerMatch) {
              players = [playerMatch[1], playerMatch[2]];
            }
          }
        }
      }
    } catch (error) {
      debugLog(`Error extracting battle info: ${error.message}`);
    }
    
    // Save new replay to storage
    const replayData = {
      url: replayUrl,
      id: replayId,
      timestamp: timestamp,
      format: format,
      players: players
    };
    
    replays.push(replayData);
    
    chrome.storage.local.set({ replays }, () => {
      debugLog(`Replay saved successfully: ${replayUrl}`);
      debugLog(`Format: ${format}, Players: ${players.join(' vs ')}`);
      
      // Fetch replay log to determine winner
      fetchReplayWinner(replayUrl, replays.length - 1);
      
      // Show success notification
      showNotification(battleId, replayUrl, format, players);
    });
  });
}

// Fetch replay log to determine the winner
function fetchReplayWinner(replayUrl, replayIndex) {
  const logUrl = replayUrl + '.log';
  debugLog(`Fetching replay log: ${logUrl}`);
  
  fetch(logUrl)
    .then(response => response.text())
    .then(logText => {
      debugLog(`Got replay log for ${replayUrl}`);
      const winner = parseReplayLog(logText);
      
      if (winner) {
        debugLog(`Winner identified: ${winner}`);
        
        // Update the stored replay with winner information
        chrome.storage.local.get('replays', (data) => {
          const replays = data.replays || [];
          if (replays[replayIndex]) {
            replays[replayIndex].winner = winner;
            chrome.storage.local.set({ replays }, () => {
              debugLog(`Replay updated with winner: ${winner}`);
            });
          }
        });
      }
    })
    .catch(error => {
      debugLog(`Error fetching replay log: ${error.message}`);
    });
}

// Parse replay log to find the winner
function parseReplayLog(logText) {
  const lines = logText.split('\n');
  
  // Find the |win| line
  for (const line of lines) {
    if (line.startsWith('|win|')) {
      // Extract winner name from |win|PlayernameHere format
      const winner = line.substring(5); // Remove "|win|" prefix
      debugLog(`Parsed winner from log: ${winner}`);
      return winner;
    }
  }
  
  debugLog(`No winner found in replay log`);
  return null;
}

// Show a notification for duplicate replays
function showDuplicateNotification(battleId, replayUrl) {
  const notification = document.createElement('div');
  notification.style.position = 'fixed';
  notification.style.bottom = '20px';
  notification.style.right = '20px';
  notification.style.backgroundColor = 'rgba(255, 165, 0, 0.9)'; // Orange for duplicates
  notification.style.color = 'white';
  notification.style.padding = '12px 16px';
  notification.style.borderRadius = '8px';
  notification.style.zIndex = '10000';
  notification.style.fontFamily = 'inherit';
  notification.style.fontSize = '14px';
  notification.style.maxWidth = '300px';
  
  let message = 'Replay already saved!';
  message += `<br><small style="opacity:0.8">This battle was already saved</small>`;
  
  message += `<br><button id="copy-link-${Date.now()}" style="margin-top: 8px; padding: 4px 8px; cursor: pointer; background-color: #cc7a00; border: none; color: white; border-radius: 4px; font-size: 12px;">Copy Link</button>`;
  
  notification.innerHTML = message;
  document.body.appendChild(notification);
  
  // Set up copy button
  const copyButton = notification.querySelector('button');
  if (copyButton) {
    copyButton.addEventListener('click', function() {
      navigator.clipboard.writeText(replayUrl).then(() => {
        copyButton.textContent = 'Copied!';
        setTimeout(() => {
          copyButton.textContent = 'Copy Link';
        }, 1500);
      });
    });
  }
  
  // Auto-fade notification
  setTimeout(() => {
    notification.style.opacity = '0';
    notification.style.transition = 'opacity 0.5s';
    setTimeout(() => notification.remove(), 500);
  }, 3000); // Shorter duration for duplicate notifications
}

// Show a notification that the replay was saved
function showNotification(battleId, replayUrl, format, players) {
  const notification = document.createElement('div');
  notification.style.position = 'fixed';
  notification.style.bottom = '20px';
  notification.style.right = '20px';
  notification.style.backgroundColor = 'rgba(0, 0, 0, 0.9)';
  notification.style.color = 'white';
  notification.style.padding = '12px 16px';
  notification.style.borderRadius = '8px';
  notification.style.zIndex = '10000';
  notification.style.fontFamily = 'inherit';
  notification.style.fontSize = '14px';
  notification.style.maxWidth = '300px';
  
  let message = 'Replay saved automatically!';
  if (format && format !== 'Unknown Format') {
    message += `<br><small style="opacity:0.8">${format}</small>`;
  }
  if (players && players.length > 0) {
    message += `<br><small style="opacity:0.8">${players.join(' vs ')}</small>`;
  }
  
  message += `<br><button id="copy-link-${Date.now()}" style="margin-top: 8px; padding: 4px 8px; cursor: pointer; background-color: #444; border: none; color: white; border-radius: 4px; font-size: 12px;">Copy Link</button>`;
  
  notification.innerHTML = message;
  document.body.appendChild(notification);
  
  // Set up copy button
  const copyButton = notification.querySelector('button');
  if (copyButton) {
    copyButton.addEventListener('click', function() {
      navigator.clipboard.writeText(replayUrl).then(() => {
        copyButton.textContent = 'Copied!';
        setTimeout(() => {
          copyButton.textContent = 'Copy Link';
        }, 1500);
      });
    });
  }
  
  // Auto-fade notification
  setTimeout(() => {
    notification.style.opacity = '0';
    notification.style.transition = 'opacity 0.5s';
    setTimeout(() => notification.remove(), 500);
  }, 4000);
}

debugLog('Pokemon Showdown Replay Saver loaded (console log approach)');