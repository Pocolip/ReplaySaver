// This script will run in the page context
(function() {
  // Store the original console methods
  const originalMethods = {
    log: console.log,
    warn: console.warn,
    error: console.error,
    info: console.info,
    debug: console.debug
  };
  
  // Override console methods to catch battle events
  Object.keys(originalMethods).forEach(method => {
    console[method] = function(...args) {
      // Call the original method first
      originalMethods[method].apply(console, args);
      
      // Check for battle start/end events
      const message = args.join(' ');
      
      // Detect battle start - look for battle initialization messages
      if (message.includes('|init|battle') || 
          message.includes('|request|') && message.includes('"active"') ||
          (message.includes('|player|') && message.includes('|p1|')) ||
          message.includes('battle started')) {
        
        // Extract battle ID from current URL or from message
        const battleId = extractBattleId();
        if (battleId) {
          console.log(`[INJECT] Battle started detected: ${battleId}`);
          window.postMessage({
            type: 'BATTLE_STARTED',
            battleId: battleId,
            timestamp: Date.now()
          }, '*');
        }
      }
      
      // Detect battle end events
      if (message.includes('won the battle') || 
          message.includes('forfeited') || 
          message.includes('|win|') ||
          message.includes('battle ended') ||
          message.includes('tie!')) {
        
        const battleId = extractBattleId();
        if (battleId) {
          console.log(`[INJECT] Battle ended detected: ${battleId}`);
          window.postMessage({
            type: 'BATTLE_ENDED',
            battleId: battleId,
            endMessage: message,
            timestamp: Date.now()
          }, '*');
        }
      }
      
      // Create new args with prefix for debugging
      const prefixedArgs = ['EXTENSION -', ...args];
      
      // Call the original method again with prefix
      originalMethods[method].apply(console, prefixedArgs);
    };
  });
  
  // Function to extract battle ID from current context
  function extractBattleId() {
    // Method 1: Get from URL hash
    const hash = window.location.hash;
    const battleMatch = hash.match(/#([^&]*)/);
    if (battleMatch && battleMatch[1].startsWith('battle-')) {
      return battleMatch[1];
    }
    
    // Method 2: Get from active room
    const activeRoom = document.querySelector('.roomtab.cur');
    if (activeRoom) {
      const roomId = activeRoom.getAttribute('data-target');
      if (roomId && roomId.startsWith('battle-')) {
        return roomId;
      }
    }
    
    // Method 3: Get from visible battle room
    const battleRooms = document.querySelectorAll('[id^="room-battle-"]');
    for (const room of battleRooms) {
      if (!room.classList.contains('hidden')) {
        const roomId = room.id.replace('room-', '');
        if (roomId.startsWith('battle-')) {
          return roomId;
        }
      }
    }
    
    return null;
  }
  
  // Monitor for new battles by watching for room changes
  const observer = new MutationObserver(function(mutations) {
    mutations.forEach(function(mutation) {
      mutation.addedNodes.forEach(function(node) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          // Check if a new battle room was added
          if (node.id && node.id.startsWith('room-battle-')) {
            const battleId = node.id.replace('room-', '');
            console.log(`[INJECT] New battle room detected: ${battleId}`);
            
            // Wait a moment for the battle to initialize
            setTimeout(() => {
              // Check if this battle is actually active
              if (!node.classList.contains('hidden')) {
                window.postMessage({
                  type: 'BATTLE_STARTED',
                  battleId: battleId,
                  timestamp: Date.now()
                }, '*');
              }
            }, 1000);
          }
          
          // Check for battle rooms that become visible (switched to)
          if (node.classList && node.classList.contains('roomtab') && 
              node.classList.contains('cur') && 
              node.getAttribute('data-target') && 
              node.getAttribute('data-target').startsWith('battle-')) {
            
            const battleId = node.getAttribute('data-target');
            console.log(`[INJECT] Switched to battle: ${battleId}`);
            
            // Check if this is a new battle that just started
            setTimeout(() => {
              const battleRoom = document.getElementById('room-' + battleId);
              if (battleRoom && !battleRoom.classList.contains('hidden')) {
                // Look for battle initialization indicators
                const battleLog = battleRoom.querySelector('.battle-log');
                if (battleLog && battleLog.textContent.includes('vs.')) {
                  window.postMessage({
                    type: 'BATTLE_STARTED',
                    battleId: battleId,
                    timestamp: Date.now()
                  }, '*');
                }
              }
            }, 500);
          }
        }
      });
    });
  });
  
  // Start observing
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['class']
  });
  
  // Also monitor hash changes for direct battle navigation
  window.addEventListener('hashchange', function() {
    const hash = window.location.hash;
    const battleMatch = hash.match(/#([^&]*)/);
    if (battleMatch && battleMatch[1].startsWith('battle-')) {
      const battleId = battleMatch[1];
      console.log(`[INJECT] Hash change to battle: ${battleId}`);
      
      setTimeout(() => {
        const battleRoom = document.getElementById('room-' + battleId);
        if (battleRoom && !battleRoom.classList.contains('hidden')) {
          window.postMessage({
            type: 'BATTLE_STARTED',
            battleId: battleId,
            timestamp: Date.now()
          }, '*');
        }
      }, 1000);
    }
  });
  
  console.log('[INJECT] Battle monitoring script loaded');
})();