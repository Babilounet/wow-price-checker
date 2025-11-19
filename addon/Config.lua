---@class WPCConfig
WowPriceChecker.Config = {
    -- Enable/disable pixel encoding
    enabled = true,

    -- Pixel encoding settings
    pixelSize = 1,
    pixelX = -200,  -- Off-screen position
    pixelY = -200,

    -- Update frequency (seconds)
    updateInterval = 2,

    -- Max items to encode at once (to avoid performance issues)
    maxItemsPerUpdate = 50,
}
