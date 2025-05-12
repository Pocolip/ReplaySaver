(function() {
  console.log('Pokemon Showdown Replay Saver loaded');
  
  // Enable debugging
  const DEBUG = false;
  
  function debugLog(message) {
    if (DEBUG) {
      console.log(`[Replay Saver] ${message}`);
    }
  }
  
  // Track active battles
  const activeBattles = new Set();
  let currentBattleId = null;
  
  // Check if we're currently in a battle room
  function detectCurrentBattle() {
    // Check URL
    if (window.location.pathname.includes('/battle-')) {
      const battleId = window.location.pathname.split('/')[1];
      debugLog(`Battle detected from URL: ${battleId}`);
      return battleId;
    }
    
    // Check for battle room elements in DOM
    const battleRoom = document.querySelector('.ps-room[id^="room-battle-"]');
    if (battleRoom) {
      const battleId = battleRoom.id.replace('room-', '');
      debugLog(`Battle detected from DOM: ${battleId}`);
      return battleId;
    }
    
    return null;
  }
  
  // Monitor battle log for end messages
  function monitorBattleLog(battleId) {
    debugLog(`Starting to monitor battle log for ${battleId}`);
    
    const roomElement = document.getElementById('room-' + battleId);
    if (!roomElement) {
      debugLog(`Room element not found for ${battleId}`);
      return;
    }
    
    let alreadyEnded = false;
    
    // Find battle log element
    const battleLog = roomElement.querySelector('.battle-log') || 
                     roomElement.querySelector('.inner') ||
                     roomElement.querySelector('.message-log');
    
    if (!battleLog) {
      debugLog(`Battle log not found for ${battleId}`);
      return;
    }
    
    debugLog(`Battle log found for ${battleId}, setting up observer`);
    
    // Create observer for battle log
    const observer = new MutationObserver((mutations) => {
      if (alreadyEnded) return;
      
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE || node.nodeType === Node.TEXT_NODE) {
            const element = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
            if (!element) continue;
            
            const content = element.textContent || '';
            
            // Check for various end conditions
            if (content.includes('won the battle') || 
                content.includes('forfeit') ||
                content.includes('tie') ||
                content.includes('lost due to inactivity')) {
              
              alreadyEnded = true;
              debugLog(`BATTLE ENDED - ${battleId}: ${content.trim()}`);
              onBattleEnd(battleId, content);
              observer.disconnect();
              break;
            }
          }
        }
      }
    });
    
    // Start observing
    observer.observe(battleLog, { childList: true, subtree: true });
    
    // Also check existing log messages in case we missed the end
    const existingMessages = battleLog.querySelectorAll('div, p, span');
    for (const message of existingMessages) {
      const content = message.textContent || '';
      if (content.includes('won the battle') || 
          content.includes('forfeit') ||
          content.includes('tie')) {
        debugLog(`BATTLE ALREADY ENDED - ${battleId}: ${content.trim()}`);
        onBattleEnd(battleId, content);
        return;
      }
    }
  }
  
  // Handle when a battle ends
  function onBattleEnd(battleId, endMessage) {
    debugLog(`Battle ended: ${battleId}`);
    activeBattles.delete(battleId);
    
    // Wait a bit before saving to ensure battle is fully ended
    setTimeout(() => {
      saveReplay(battleId);
    }, 1000);
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
  
  // Initialize battle monitoring for current battle
  const currentBattle = detectCurrentBattle();
  if (currentBattle) {
    currentBattleId = currentBattle;
    activeBattles.add(currentBattle);
    monitorBattleLog(currentBattle);
  }
  
  // Watch for new battles
  const roomObserver = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType === Node.ELEMENT_NODE && 
            node.classList && 
            node.classList.contains('ps-room') && 
            node.id && 
            node.id.startsWith('room-battle-')) {
          const battleId = node.id.replace('room-', '');
          
          if (!activeBattles.has(battleId)) {
            debugLog(`New battle room detected: ${battleId}`);
            currentBattleId = battleId;
            activeBattles.add(battleId);
            
            // Wait a bit for the battle to initialize
            setTimeout(() => {
              monitorBattleLog(battleId);
            }, 1000);
          }
        }
      }
    }
  });
  
  // Start observing for new battle rooms
  const appContainer = document.getElementById('ps-frame') || document.body;
  roomObserver.observe(appContainer, { childList: true, subtree: true });
  
  debugLog('Simple battle detection initialized');
})();
