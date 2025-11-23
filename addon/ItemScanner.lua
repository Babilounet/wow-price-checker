---@class WPCItemScanner
WowPriceChecker.ItemScanner = {}
local Scanner = WowPriceChecker.ItemScanner

-- API Compatibility Layer for Classic Anniversary
local function GetContainerNumSlots_Compat(bag)
    if C_Container and C_Container.GetContainerNumSlots then
        return C_Container.GetContainerNumSlots(bag)
    else
        return GetContainerNumSlots(bag)
    end
end

local function GetContainerItemInfo_Compat(bag, slot)
    if C_Container and C_Container.GetContainerItemInfo then
        local info = C_Container.GetContainerItemInfo(bag, slot)
        if info then
            return info.iconFileID, info.stackCount, info.isLocked, info.quality,
                   info.isReadable, info.hasLoot, info.hyperlink, info.isFiltered,
                   info.hasNoValue, info.itemID
        end
        return nil
    else
        return GetContainerItemInfo(bag, slot)
    end
end

---Scan all player bags (Classic Anniversary compatible)
function Scanner:ScanAll()
    local WPC = WowPriceChecker
    local inventory = {}

    -- Scan main bags (0-4)
    -- Bag 0 = backpack, 1-4 = bag slots
    for bag = 0, 4 do
        local numSlots = GetContainerNumSlots_Compat(bag)
        if numSlots and numSlots > 0 then
            for slot = 1, numSlots do
                local _, stackCount, _, _, _, _, itemLink = GetContainerItemInfo_Compat(bag, slot)
                if itemLink then
                    local itemID = self:GetItemIDFromLink(itemLink)
                    if itemID then
                        inventory[itemID] = (inventory[itemID] or 0) + (stackCount or 1)
                        WPC:DebugPrint(string.format("Found item %d x%d in bag %d slot %d",
                            itemID, stackCount or 1, bag, slot))
                    end
                end
            end
        end
    end

    -- Scan bank if opened
    if self:IsBankOpen() then
        self:ScanBank(inventory)
    end

    -- Update saved variables
    WowPriceCheckerDB.inventory = inventory
    WowPriceCheckerDB.characterName = UnitName("player")
    WowPriceCheckerDB.realmName = GetRealmName()
    WowPriceCheckerDB.timestamp = time()

    WPC:DebugPrint("Scanned " .. self:CountItems(inventory) .. " unique items")

    -- Trigger pixel encoding update
    if WPC.Config and WPC.Config.enabled then
        WPC.PixelEncoder:EncodeInventory(inventory)
    end

    return inventory
end

---Scan bank slots (Classic Anniversary compatible)
---@param inventory table
function Scanner:ScanBank(inventory)
    local WPC = WowPriceChecker

    -- Bank bag is bag -1 (BANK_CONTAINER)
    local BANK_CONTAINER = -1
    local numBankSlots = GetContainerNumSlots_Compat(BANK_CONTAINER)

    if numBankSlots and numBankSlots > 0 then
        for slot = 1, numBankSlots do
            local _, stackCount, _, _, _, _, itemLink = GetContainerItemInfo_Compat(BANK_CONTAINER, slot)
            if itemLink then
                local itemID = self:GetItemIDFromLink(itemLink)
                if itemID then
                    inventory[itemID] = (inventory[itemID] or 0) + (stackCount or 1)
                    WPC:DebugPrint(string.format("Found item %d x%d in bank slot %d",
                        itemID, stackCount or 1, slot))
                end
            end
        end
    end

    -- Scan bank bags (5-10 for Classic, bags 5-11 for Retail)
    -- Classic Anniversary has 6 bank bag slots
    for bag = 5, 10 do
        local numSlots = GetContainerNumSlots_Compat(bag)
        if numSlots and numSlots > 0 then
            for slot = 1, numSlots do
                local _, stackCount, _, _, _, _, itemLink = GetContainerItemInfo_Compat(bag, slot)
                if itemLink then
                    local itemID = self:GetItemIDFromLink(itemLink)
                    if itemID then
                        inventory[itemID] = (inventory[itemID] or 0) + (stackCount or 1)
                    end
                end
            end
        end
    end
end

---Extract item ID from item link
---@param itemLink string
---@return number|nil
function Scanner:GetItemIDFromLink(itemLink)
    if not itemLink then return nil end
    local itemID = tonumber(itemLink:match("item:(%d+)"))
    return itemID
end

---Check if bank is open
---@return boolean
function Scanner:IsBankOpen()
    return BankFrame and BankFrame:IsShown()
end

---Count unique items in inventory
---@param inventory table
---@return number
function Scanner:CountItems(inventory)
    local count = 0
    for _ in pairs(inventory) do
        count = count + 1
    end
    return count
end

---Get item name by ID (Classic compatible)
---@param itemID number
---@return string|nil
function Scanner:GetItemName(itemID)
    local itemName = GetItemInfo(itemID)
    return itemName
end
