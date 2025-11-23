---@class AuctionScanner
WowPriceChecker.AuctionScanner = {}
local Scanner = WowPriceChecker.AuctionScanner

-- Constants
local THROTTLE_DELAY = 0.5  -- Seconds between queries
local MAX_RESULTS_PER_PAGE = 50

-- State
Scanner.isScanning = false
Scanner.currentPage = 0
Scanner.scanResults = {}
Scanner.hasAuctionator = false

---Initialize the auction scanner
function Scanner:Initialize()
    -- Check if Auctionator is loaded
    self.hasAuctionator = IsAddOnLoaded("Auctionator")

    if self.hasAuctionator then
        WowPriceChecker:DebugPrint("Auctionator detected, hooking into its scans")
        self:HookAuctionator()
    else
        WowPriceChecker:DebugPrint("Auctionator not found, using built-in scanner")
    end

    -- Initialize saved data structure
    if not WowPriceCheckerDB.auctionData then
        WowPriceCheckerDB.auctionData = {
            lastScan = 0,
            realm = GetRealmName(),
            faction = UnitFactionGroup("player"),
            items = {}
        }
    end

    -- Register AH events
    self:RegisterEvents()
end

---Hook into Auctionator scan results
function Scanner:HookAuctionator()
    -- Hook into Auctionator's event bus if available
    if Auctionator and Auctionator.EventBus then
        Auctionator.EventBus:RegisterSource(self, "WPC_AuctionScanner")
        Auctionator.EventBus:Register(self, {
            "AUCTIONATOR_SCAN_COMPLETE"
        })
    end
end

---Receive events from Auctionator
function Scanner:ReceiveEvent(eventName, ...)
    if eventName == "AUCTIONATOR_SCAN_COMPLETE" then
        WowPriceChecker:DebugPrint("Auctionator scan complete, processing results")
        self:ProcessAuctionatorResults()
    end
end

---Process Auctionator scan results
function Scanner:ProcessAuctionatorResults()
    -- Auctionator stores its data in AUCTIONATOR_PRICE_DATABASE
    -- We'll extract the data we need
    if AUCTIONATOR_POSTING_HISTORY then
        local processedItems = {}

        for key, history in pairs(AUCTIONATOR_POSTING_HISTORY) do
            -- Extract item ID from key (can be "12345" or "gr:12345:suffix")
            local itemId = tonumber(key:match("^(%d+)$") or key:match(":(%d+):"))

            if itemId and #history > 0 then
                -- Get the most recent price
                local mostRecent = history[1]
                for _, entry in ipairs(history) do
                    if entry.time > mostRecent.time then
                        mostRecent = entry
                    end
                end

                processedItems[itemId] = {
                    price = mostRecent.price,
                    quantity = mostRecent.quantity,
                    timestamp = mostRecent.time,
                    unitPrice = mostRecent.price / mostRecent.quantity
                }
            end
        end

        -- Save to our database
        for itemId, data in pairs(processedItems) do
            self:SaveAuctionData(itemId, data.price, data.quantity, data.unitPrice)
        end

        print("|cff00ff00WPC:|r Imported " .. self:TableCount(processedItems) .. " items from Auctionator")
    end
end

---Register auction house events
function Scanner:RegisterEvents()
    local frame = CreateFrame("Frame")

    -- Register for auction house events
    frame:RegisterEvent("AUCTION_HOUSE_SHOW")
    frame:RegisterEvent("AUCTION_HOUSE_CLOSED")
    frame:RegisterEvent("AUCTION_ITEM_LIST_UPDATE")

    frame:SetScript("OnEvent", function(self, event, ...)
        if event == "AUCTION_HOUSE_SHOW" then
            Scanner:OnAuctionHouseOpened()
        elseif event == "AUCTION_HOUSE_CLOSED" then
            Scanner:OnAuctionHouseClosed()
        elseif event == "AUCTION_ITEM_LIST_UPDATE" then
            Scanner:OnAuctionItemListUpdate()
        end
    end)

    self.eventFrame = frame
end

---Called when auction house is opened
function Scanner:OnAuctionHouseOpened()
    WowPriceChecker:DebugPrint("Auction House opened")
end

---Called when auction house is closed
function Scanner:OnAuctionHouseClosed()
    WowPriceChecker:DebugPrint("Auction House closed")
    if self.isScanning then
        self:StopScan()
    end
end

---Called when auction items are updated
function Scanner:OnAuctionItemListUpdate()
    if not self.isScanning then
        return
    end

    -- Get all items from current page
    local numItems = GetNumAuctionItems("list")

    WowPriceChecker:DebugPrint("Processing page " .. self.currentPage .. " (" .. numItems .. " items)")

    for i = 1, numItems do
        local name, _, count, _, _, _, _, minBid, minIncrement, buyout, bid, isHighBidder, _, owner, ownerFull, saleStatus, itemId = GetAuctionItemInfo("list", i)

        if itemId and buyout > 0 then
            local unitPrice = buyout / count
            self:SaveAuctionData(itemId, buyout, count, unitPrice)
        end
    end

    -- Continue to next page if we got ANY items (not just when >= 50)
    -- Only stop when we get a completely empty page
    if numItems > 0 then
        self.currentPage = self.currentPage + 1
        -- Schedule next query with throttle delay
        C_Timer.After(THROTTLE_DELAY, function()
            self:QueryNextPage()
        end)
    else
        -- Scan complete - got an empty page
        self:StopScan()
        local itemCount = self:TableCount(WowPriceCheckerDB.auctionData.items)
        print("|cff00ff00WPC:|r Auction scan complete! Scanned " .. itemCount .. " unique items across " .. self.currentPage .. " pages")
    end
end

---Start a full auction house scan
function Scanner:StartFullScan()
    if self.isScanning then
        print("|cffff0000WPC:|r Scan already in progress")
        return
    end

    if not AuctionFrame or not AuctionFrame:IsShown() then
        print("|cffff0000WPC:|r You must be at the auction house to scan")
        return
    end

    print("|cff00ff00WPC:|r Starting auction house scan...")

    self.isScanning = true
    self.currentPage = 0
    self.scanResults = {}

    -- Clear old data
    WowPriceCheckerDB.auctionData.items = {}

    -- Start scanning from page 0
    self:QueryNextPage()
end

---Query the next page of auction results
function Scanner:QueryNextPage()
    if not self.isScanning then
        return
    end

    WowPriceChecker:DebugPrint("Querying page " .. self.currentPage)

    -- Query all items without sorting to get all auctions
    -- Sorting can cause pagination issues where some items are skipped
    QueryAuctionItems("", nil, nil, self.currentPage, nil, nil, false, false, nil)
end

---Stop the current scan
function Scanner:StopScan()
    self.isScanning = false
    WowPriceCheckerDB.auctionData.lastScan = time()
    WowPriceChecker:DebugPrint("Scan stopped")
end

---Save auction data for an item
---@param itemId number
---@param price number Total price
---@param quantity number Stack size
---@param unitPrice number Price per unit
function Scanner:SaveAuctionData(itemId, price, quantity, unitPrice)
    if not WowPriceCheckerDB.auctionData.items[itemId] then
        WowPriceCheckerDB.auctionData.items[itemId] = {
            prices = {},
            lastUpdate = 0
        }
    end

    local itemData = WowPriceCheckerDB.auctionData.items[itemId]

    -- Add price to list (keep last 500 prices per item for better analysis)
    table.insert(itemData.prices, {
        unitPrice = unitPrice,
        totalPrice = price,
        quantity = quantity,
        timestamp = time()
    })

    -- Keep only last 500 entries to avoid SavedVariables bloat
    if #itemData.prices > 500 then
        table.remove(itemData.prices, 1)
    end

    itemData.lastUpdate = time()
end

---Get auction data for an item
---@param itemId number
---@return table|nil
function Scanner:GetItemData(itemId)
    if not WowPriceCheckerDB.auctionData.items[itemId] then
        return nil
    end

    local itemData = WowPriceCheckerDB.auctionData.items[itemId]
    local prices = {}

    for _, entry in ipairs(itemData.prices) do
        table.insert(prices, entry.unitPrice)
    end

    if #prices == 0 then
        return nil
    end

    -- Calculate stats
    table.sort(prices)
    local min = prices[1]
    local max = prices[#prices]
    local median = prices[math.ceil(#prices / 2)]

    local sum = 0
    for _, price in ipairs(prices) do
        sum = sum + price
    end
    local mean = sum / #prices

    return {
        min = min,
        max = max,
        median = median,
        mean = mean,
        count = #prices,
        lastUpdate = itemData.lastUpdate
    }
end

---Count table elements
function Scanner:TableCount(t)
    local count = 0
    for _ in pairs(t) do
        count = count + 1
    end
    return count
end

-- Initialize when loaded
Scanner:Initialize()
