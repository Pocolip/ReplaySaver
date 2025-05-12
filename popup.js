document.addEventListener('DOMContentLoaded', function() {
  const replayList = document.getElementById('replayList');
  const clearAllButton = document.getElementById('clearAll');
  
  // Add a status message area
  const statusElement = document.createElement('div');
  statusElement.id = 'statusMessage';
  statusElement.className = 'status-message';
  document.body.insertBefore(statusElement, replayList);
  
  // Debug to console - useful for troubleshooting
  console.log('Pokemon Showdown Replay Saver popup loaded');
  
  // Check if storage is properly accessible
  function checkStorage() {
    chrome.storage.local.get(null, function(items) {
      console.log('All storage items:', items);
    });
  }
  
  // Call this to see what's in storage when popup loads
  checkStorage();
  
  // Show a status message
  function showStatus(message, isError = false) {
    statusElement.textContent = message;
    statusElement.className = isError ? 'status-message error' : 'status-message success';
    statusElement.style.display = 'block';
    
    setTimeout(() => {
      statusElement.style.display = 'none';
    }, 3000);
  }
  
  // Fetch replay winner from log if not already cached
  async function fetchReplayWinner(replay, index) {
    if (replay.winner) {
      return replay.winner;
    }
    
    try {
      const logUrl = replay.url + '.log';
      console.log(`Fetching replay log for missing winner: ${logUrl}`);
      
      const response = await fetch(logUrl);
      const logText = await response.text();
      
      // Parse the log to find the winner
      const lines = logText.split('\n');
      let winner = null;
      
      for (const line of lines) {
        if (line.startsWith('|win|')) {
          winner = line.substring(5);
          break;
        }
      }
      
      if (winner) {
        console.log(`Found winner: ${winner} for replay at index ${index}`);
        
        // Update the stored replay with winner information
        chrome.storage.local.get('replays', (data) => {
          const replays = data.replays || [];
          if (replays[index]) {
            replays[index].winner = winner;
            chrome.storage.local.set({ replays }, () => {
              console.log(`Updated replay ${index} with winner: ${winner}`);
              // Reload replays to show the updated information
              loadReplays();
            });
          }
        });
      }
      
      return winner;
    } catch (error) {
      console.error(`Error fetching replay log: ${error.message}`);
      return null;
    }
  }
  
  // Format player names with winner/loser styling
  function formatPlayers(players, winner) {
    if (!players || players.length === 0) {
      return 'Unknown Players';
    }
    
    if (!winner) {
      // No winner information, show players normally
      return players.join(' vs ');
    }
    
    // Split players and determine who won/lost
    const formattedPlayers = players.map(player => {
      if (player === winner) {
        return `<span class="winner">${player} <small class="result-indicator">W</small></span>`;
      } else {
        return `<span class="loser">${player} <small class="result-indicator">L</small></span>`;
      }
    });
    
    return formattedPlayers.join(' vs ');
  }
  
  // Load saved replays
  function loadReplays() {
    console.log('Loading replays from storage...');
    chrome.storage.local.get('replays', (data) => {
      console.log('Replay data from storage:', data);
      
      const replays = data.replays || [];
      console.log('Found ' + replays.length + ' replays');
      
      if (replays.length === 0) {
        replayList.innerHTML = `
          <div class="empty-state">
            <p>No replays saved yet.</p>
            <p>Replays will automatically be saved when your battles end.</p>
          </div>
        `;
        return;
      }
      
      // Sort by most recent first
      replays.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      
      // Display replays
      replayList.innerHTML = '';
      replays.forEach((replay, index) => {
        const replayDate = new Date(replay.timestamp);
        const formattedDate = replayDate.toLocaleDateString() + ' ' + 
                             replayDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        
        const replayItem = document.createElement('div');
        replayItem.className = 'replay-item';
        
        // Check if we need to fetch winner information
        if (!replay.winner && replay.players && replay.players.length > 0) {
          // Fetch winner in the background
          fetchReplayWinner(replay, index);
        }
        
        replayItem.innerHTML = `
          <div class="replay-meta">
            <div class="replay-format">${replay.format || 'Pokemon Showdown Battle'}</div>
            <div class="replay-players">${formatPlayers(replay.players, replay.winner)}</div>
            <div class="replay-time">${formattedDate}</div>
          </div>
          <div class="replay-actions">
            <button class="open-replay" data-url="${replay.url}">Open</button>
            <button class="copy-replay" data-url="${replay.url}">Copy Link</button>
            <button class="delete-replay" data-index="${index}">Delete</button>
          </div>
        `;
        replayList.appendChild(replayItem);
      });
      
      // Add event listeners for buttons
      document.querySelectorAll('.open-replay').forEach(button => {
        button.addEventListener('click', function() {
          console.log('Opening replay:', this.getAttribute('data-url'));
          chrome.tabs.create({ url: this.getAttribute('data-url') });
        });
      });
      
      document.querySelectorAll('.copy-replay').forEach(button => {
        button.addEventListener('click', function() {
          const url = this.getAttribute('data-url');
          console.log('Copying replay URL:', url);
          navigator.clipboard.writeText(url).then(() => {
            const originalText = this.textContent;
            this.textContent = 'Copied!';
            setTimeout(() => { this.textContent = originalText; }, 1500);
            showStatus('Replay link copied to clipboard!');
          });
        });
      });
      
      document.querySelectorAll('.delete-replay').forEach(button => {
        button.addEventListener('click', function() {
          const index = parseInt(this.getAttribute('data-index'));
          console.log('Deleting replay at index:', index);
          chrome.storage.local.get('replays', (data) => {
            const replays = data.replays || [];
            replays.splice(index, 1);
            chrome.storage.local.set({ replays }, () => {
              loadReplays();
              showStatus('Replay deleted successfully!');
            });
          });
        });
      });
    });
  }
  
  // Clear all replays
  clearAllButton.addEventListener('click', function() {
    console.log('Clear all button clicked');
    if (confirm('Are you sure you want to delete all saved replays?')) {
      console.log('Confirmed clearing all replays');
      chrome.storage.local.set({ replays: [] }, () => {
        loadReplays();
        showStatus('All replays cleared!');
      });
    }
  });
  
  // Add a manual refresh button
  const refreshButton = document.createElement('button');
  refreshButton.textContent = 'Refresh List';
  refreshButton.style.marginLeft = '10px';
  refreshButton.addEventListener('click', () => {
    loadReplays();
    showStatus('Replay list refreshed!');
  });
  document.querySelector('.header').appendChild(refreshButton);
  
  // Add a copy all links button
  const copyAllButton = document.createElement('button');
  copyAllButton.textContent = 'Copy All Links';
  copyAllButton.style.marginLeft = '10px';
  copyAllButton.addEventListener('click', () => {
    chrome.storage.local.get('replays', (data) => {
      const replays = data.replays || [];
      
      if (replays.length === 0) {
        showStatus('No replays to copy!', true);
        return;
      }
      
      // Create a string with all replay URLs, one per line
      const linksText = replays.map(replay => replay.url).join('\n');
      
      navigator.clipboard.writeText(linksText).then(() => {
        showStatus(`Copied ${replays.length} replay links to clipboard!`);
      }).catch(err => {
        console.error('Failed to copy links:', err);
        showStatus('Failed to copy links to clipboard', true);
      });
    });
  });
  document.querySelector('.header').appendChild(copyAllButton);
  
  // Initial load
  loadReplays();
});