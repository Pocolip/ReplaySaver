# Pokemon Showdown Replay Saver

> **Note**: This extension was vibe coded with Claude! 🤖  
> Perfect for collecting multiple replay links to later import into the PASRS (Pokemon Analytics Showdown Replay System) spreadsheet.

A simple Chrome extension that automatically saves replay links from your Pokemon Showdown battles.

## Features

- 🎥 **Automatic Replay Saving**: Detects when battles end and automatically saves the replay link
- 💾 **Local Storage**: All replays are stored locally in your browser
- 📋 **Easy Management**: View, copy, and delete saved replays from the popup
- 🔗 **Quick Actions**: Copy individual replay links or all links at once
- 📊 **Battle Details**: Saves format, players, and timestamp for each replay

## Installation

### Method 1: Load as Unpacked Extension (Developer Mode)

1. Download or clone this repository to your computer
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" by clicking the toggle in the top-right corner
4. Click the "Load unpacked" button
5. Select the folder containing the extension files (the folder with `manifest.json`)
6. The extension should now appear in your Chrome toolbar

### Method 2: Install from Chrome Web Store
*This extension is not currently available on the Chrome Web Store*

## How It Works

1. **Automatic Detection**: The extension monitors your Pokemon Showdown battles
2. **Battle End Recognition**: When a battle ends (win, loss, forfeit, tie), it's automatically detected (relies on the chat so keep your battle open!)
3. **Replay Generation**: The extension sends the `/savereplay` command to Pokemon Showdown
4. **Link Extraction**: It constructs the replay URL and saves it locally
5. **Storage**: All replay data is stored in your browser's local storage

## Usage

1. Play battles on [Pokemon Showdown](https://play.pokemonshowdown.com/)
2. When battles end, replays are automatically saved
3. Click the extension icon to view your saved replays
4. Use the popup to:
   - View all saved replays with format and player information
   - Copy replay links to your clipboard
   - Open replays in new tabs
   - Delete individual replays or clear all

## Files

- `manifest.json` - Extension configuration
- `content.js` - Main script that monitors battles and saves replays
- `popup.html` - Extension popup interface
- `popup.js` - Popup functionality and UI logic

## Browser Compatibility

- Chrome (Manifest V3)
- Other Chromium-based browsers (Edge, Brave, etc.)

## Permissions

The extension requires the following permissions:
- `storage` - To save replay data locally
- `tabs` - To open replay links in new tabs
- `clipboardWrite` - To copy replay links to clipboard
- `host_permissions` - Access to play.pokemonshowdown.com for battle monitoring

## Privacy

This extension:
- ✅ Stores all data locally in your browser
- ✅ Does not send any data to external servers
- ✅ Only accesses Pokemon Showdown pages
- ✅ Does not collect personal information

## Troubleshooting

### Extension not detecting battles:
- Make sure you're on play.pokemonshowdown.com
- Try refreshing the page after installing the extension
- Check that the extension is enabled in chrome://extensions/

### Replays not saving:
- Ensure the battle has completely ended
- Check if JavaScript is enabled
- Don't exit out of the battle before the replay is saved!
- Look for error messages in the browser console (F12)

### Can't see saved replays:
- Click the extension icon in the toolbar
- Try the "Refresh List" button in the popup

## Development

To modify the extension:

1. Make your changes to the source files
2. Go to `chrome://extensions/`
3. Click the refresh icon on the extension card
4. Test your changes on Pokemon Showdown

## Contributing

Feel free to submit issues and pull requests!

## License

This project is open source and available under the MIT License.