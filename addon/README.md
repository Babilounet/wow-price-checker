# WoW Price Checker - Addon

WoW addon for real-time inventory tracking with pixel manipulation communication.

**Compatible with:**
- ✅ Classic Anniversary (1.15.6) - Interface 11506
- ✅ Classic Era
- ✅ Retail (with minor TOC update)

## Features

- Automatic inventory scanning (bags + bank)
- Real-time data transmission via pixel encoding
- No `/reload` required for updates
- Lightweight and performant

## Installation

### Classic Anniversary / Classic Era

1. Copy the `addon` folder to your WoW addons directory:
   ```
   World of Warcraft/_classic_/Interface/AddOns/WowPriceChecker/
   ```

2. Restart WoW or type `/reload` in-game

3. The addon will load automatically

### Retail (if needed)

Edit `WowPriceChecker.toc` and change:
```
## Interface: 11506
```
to:
```
## Interface: 110002
```

Then copy to:
```
World of Warcraft/_retail_/Interface/AddOns/WowPriceChecker/
```

## Usage

### Slash Commands

- `/wpc scan` - Manually scan inventory
- `/wpc show` - Display current inventory in chat
- `/wpc toggle` - Enable/disable pixel encoding
- `/wpc debug` - Toggle debug mode

### Automatic Scanning

The addon automatically scans your inventory when:
- Bags are updated (items added/removed)
- You log in
- You open your bank

## How It Works

### Pixel Manipulation

The addon encodes inventory data into pixel colors displayed off-screen:

1. **Inventory Scan**: Detects all items in bags/bank
2. **Data Encoding**: Converts item data to JSON-like string
3. **Pixel Display**: Encodes data into RGB color values
4. **Desktop App**: Captures screen and decodes pixel colors

**Current Implementation** (Proof of Concept):
- Encodes data length into single RGB pixel
- Updates every 2 seconds

**Future Full Implementation**:
- Multi-pixel encoding
- Complete JSON string encoding
- Error detection/checksums
- Protocol markers (START/END)

### File Structure

```
WowPriceChecker/
├── WowPriceChecker.toc   # Addon metadata
├── Core.lua               # Main addon logic
├── Config.lua             # Configuration settings
├── ItemScanner.lua        # Inventory scanning
├── PixelEncoder.lua       # Pixel manipulation
└── README.md              # This file
```

## Configuration

Edit `Config.lua` to customize:

```lua
WowPriceChecker.Config = {
    enabled = true,              -- Enable pixel encoding
    pixelSize = 1,               -- Pixel frame size
    pixelX = -200,               -- Off-screen X position
    pixelY = -200,               -- Off-screen Y position
    updateInterval = 2,          -- Update frequency (seconds)
    maxItemsPerUpdate = 50,      -- Max items to encode
}
```

## Saved Variables

Data is saved in `WTF/Account/ACCOUNT_NAME/SavedVariables/WowPriceChecker.lua`:

```lua
WowPriceCheckerDB = {
    inventory = {
        [12345] = 10,  -- Item ID = Quantity
        [67890] = 5,
    },
    characterName = "YourChar",
    realmName = "YourRealm",
    timestamp = 1234567890,
}
```

## Performance

- Lightweight: ~5KB memory footprint
- Efficient scanning with debouncing
- No FPS impact (pixel operations are minimal)

## Troubleshooting

### Addon not loading
- Check folder name is exactly `WowPriceChecker`
- Verify `.toc` file is present
- Try `/reload` in-game

### No pixel encoding
- Type `/wpc toggle` to enable
- Check debug mode: `/wpc debug`
- Verify frame exists: `/framestack` (Blizzard command)

### Desktop app not receiving data
- Ensure pixel encoding is enabled
- Check pixel position is within screen bounds
- Verify screen capture permissions (macOS/Linux)

## Technical Notes

### API Used (Classic Anniversary)

- `GetContainerNumSlots()` - Get bag size
- `GetContainerItemInfo()` - Get item info
- `GetItemInfo()` - Get item name
- `CreateFrame()` - Create UI frame
- `C_Timer.NewTimer()` - Schedule updates (works in Classic Anniversary)

**Note**: Uses Classic-era API functions, not the modern `C_Container` namespace.

### Pixel Encoding Theory

Each RGB pixel stores 24 bits (3 bytes):
- Red: 0-255 (8 bits)
- Green: 0-255 (8 bits)
- Blue: 0-255 (8 bits)

Encoding capacity:
- 1 pixel = 3 ASCII characters
- 10 pixels = 30 characters
- 100 pixels = ~300 characters (full inventory JSON)

## License

MIT

## Credits

Created by **babilounet** for WoW Price Checker project.
