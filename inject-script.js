// This script will run in the page context to monitor console logs
(function() {
  console.log('[EXTENSION] Inject script loaded for battle detection');
  
  // Store the original console methods
  const originalMethods = {
    log: console.log,
    warn: console.warn,
    error: console.error,
    info: console.info,
    debug: console.debug
  };
  
  // Track which battles we've already detected as ended
  const endedBattles = new Set();
  
  function getCurrentBattleId() {
    // Get current battle ID from URL
    if (window.location.pathname.includes('/battle-')) {
      return window.location.pathname.split('/')[1];
    }
    return null;
  }
  
  function checkForBattleEnd(message) {
    // Only check for the definitive win message
    if (message.includes('|win|')) {
      const battleId = getCurrentBattleId();
      if (battleId && !endedBattles.has(battleId)) {
        console.log(`[EXTENSION] Battle end detected: ${battleId}`);
        endedBattles.add(battleId);
        
        // Send message to content script
        window.postMessage({
          type: 'BATTLE_ENDED',
          battleId: battleId,
          endMessage: message
        }, '*');
        
        return true;
      }
    }
    return false;
  }
  
  // Override console methods to monitor for battle events
  Object.keys(originalMethods).forEach(method => {
    console[method] = function(...args) {
      // Call the original method first
      originalMethods[method].apply(console, args);
      
      // Convert arguments to a string for pattern matching
      const message = args.map(arg => 
        typeof arg === 'string' ? arg : 
        typeof arg === 'object' ? JSON.stringify(arg) : 
        String(arg)
      ).join(' ');
      
      // Check for battle end
      checkForBattleEnd(message);
      
      // Also prefix with 'EXTENSION -' for debugging
      const prefixedArgs = ['EXTENSION -', ...args];
      originalMethods[method].apply(console, prefixedArgs);
    };
  });
  
  // Monitor URL changes to clean up ended battles when leaving
  let currentUrl = window.location.href;
  const urlObserver = new MutationObserver(() => {
    if (window.location.href !== currentUrl) {
      currentUrl = window.location.href;
      console.log(`[EXTENSION] URL changed: ${currentUrl}`);
      
      // If we're no longer in a battle room, clear the ended battles set
      if (!getCurrentBattleId()) {
        endedBattles.clear();
      }
    }
  });
  
  urlObserver.observe(document.body, { 
    childList: true, 
    subtree: true 
  });
  
  console.log('[EXTENSION] Console monitoring initialized for battle detection');
})();