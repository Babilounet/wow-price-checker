---@class WowPriceChecker
WowPriceChecker = {}
WowPriceChecker.Version = "1.0.0"
WowPriceChecker.Debug = true

-- Global saved variables
WowPriceCheckerDB = WowPriceCheckerDB or {}

-- Local references
local WPC = WowPriceChecker

---Initialize the addon
function WPC:Initialize()
    print("|cff00ff00WoW Price Checker|r v" .. self.Version .. " loaded!")
    print("|cffff9900Commands:|r /wpc scan, /wpc show, /wpc toggle, /wpc ahscan")

    -- Initialize database
    if not WowPriceCheckerDB.inventory then
        WowPriceCheckerDB.inventory = {}
    end

    -- Create pixel encoder frame
    WPC.PixelEncoder:CreateFrame()

    -- Register events
    self:RegisterEvents()
end

---Register addon events
function WPC:RegisterEvents()
    local frame = CreateFrame("Frame")

    -- Scan inventory when bags update
    frame:RegisterEvent("BAG_UPDATE")
    frame:RegisterEvent("PLAYER_ENTERING_WORLD")

    frame:SetScript("OnEvent", function(self, event, ...)
        if event == "BAG_UPDATE" then
            -- Debounce bag updates (scan after 1 second of inactivity)
            if WPC.scanTimer then
                WPC.scanTimer:Cancel()
            end
            WPC.scanTimer = C_Timer.NewTimer(1, function()
                WPC.ItemScanner:ScanAll()
            end)
        elseif event == "PLAYER_ENTERING_WORLD" then
            -- Initial scan on login
            C_Timer.After(2, function()
                WPC.ItemScanner:ScanAll()
            end)
        end
    end)
end

---Debug print
---@param ... any
function WPC:DebugPrint(...)
    if self.Debug then
        print("|cff888888[WPC Debug]|r", ...)
    end
end

-- Slash commands
SLASH_WOWPRICECHECKER1 = "/wpc"
SLASH_WOWPRICECHECKER2 = "/wowpricechecker"

SlashCmdList["WOWPRICECHECKER"] = function(msg)
    local command = string.lower(msg or "")

    if command == "scan" then
        print("|cff00ff00WPC:|r Scanning inventory...")
        WPC.ItemScanner:ScanAll()
    elseif command == "show" then
        print("|cff00ff00WPC:|r Inventory Items:")
        if WowPriceCheckerDB.inventory then
            for itemID, quantity in pairs(WowPriceCheckerDB.inventory) do
                print("  Item " .. itemID .. ": " .. quantity)
            end
        else
            print("  No inventory data")
        end
    elseif command == "toggle" then
        WPC.Config.enabled = not WPC.Config.enabled
        print("|cff00ff00WPC:|r Pixel encoding " .. (WPC.Config.enabled and "enabled" or "disabled"))
        if not WPC.Config.enabled then
            WPC.PixelEncoder:HideFrame()
        else
            WPC.PixelEncoder:ShowFrame()
        end
    elseif command == "debug" then
        WPC.Debug = not WPC.Debug
        print("|cff00ff00WPC:|r Debug mode " .. (WPC.Debug and "enabled" or "disabled"))
    elseif command == "ahscan" then
        WPC.AuctionScanner:StartFullScan()
    elseif command == "ahimport" then
        print("|cff00ff00WPC:|r Importing data from Auctionator...")
        WPC.AuctionScanner:ProcessAuctionatorResults()
    elseif command == "ahstats" then
        if WowPriceCheckerDB.auctionData and WowPriceCheckerDB.auctionData.items then
            local count = WPC.AuctionScanner:TableCount(WowPriceCheckerDB.auctionData.items)
            local lastScan = WowPriceCheckerDB.auctionData.lastScan or 0
            print("|cff00ff00WPC:|r Auction Data Stats:")
            print("  Items tracked: " .. count)
            if lastScan > 0 then
                print("  Last scan: " .. date("%Y-%m-%d %H:%M:%S", lastScan))
            else
                print("  Last scan: Never")
            end
        else
            print("|cff00ff00WPC:|r No auction data yet")
        end
    else
        print("|cff00ff00WoW Price Checker|r")
        print("  /wpc scan - Scan inventory")
        print("  /wpc show - Show current inventory")
        print("  /wpc toggle - Toggle pixel encoding")
        print("  /wpc debug - Toggle debug mode")
        print("  /wpc ahscan - Start full AH scan (must be at AH)")
        print("  /wpc ahimport - Import data from Auctionator")
        print("  /wpc ahstats - Show auction data statistics")
    end
end

-- Initialize on load
local initFrame = CreateFrame("Frame")
initFrame:RegisterEvent("ADDON_LOADED")
initFrame:SetScript("OnEvent", function(self, event, addonName)
    if addonName == "WowPriceChecker" then
        WowPriceChecker:Initialize()
        self:UnregisterEvent("ADDON_LOADED")
    end
end)
