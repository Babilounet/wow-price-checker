---@class WPCItemScanner
WowPriceChecker.ItemScanner = {}
local Scanner = WowPriceChecker.ItemScanner

---Scan all player bags
function Scanner:ScanAll()
    local WPC = WowPriceChecker
    local inventory = {}

    -- Scan main bags (0-4)
    for bag = 0, 4 do
        local numSlots = C_Container.GetContainerNumSlots(bag)
        if numSlots and numSlots > 0 then
            for slot = 1, numSlots do
                local itemInfo = C_Container.GetContainerItemInfo(bag, slot)
                if itemInfo then
                    local itemID = itemInfo.itemID
                    local stackCount = itemInfo.stackCount or 1

                    if itemID then
                        inventory[itemID] = (inventory[itemID] or 0) + stackCount
                        WPC:DebugPrint(string.format("Found item %d x%d in bag %d slot %d",
                            itemID, stackCount, bag, slot))
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
    if WPC.Config.enabled then
        WPC.PixelEncoder:EncodeInventory(inventory)
    end

    return inventory
end

---Scan bank slots
---@param inventory table
function Scanner:ScanBank(inventory)
    local WPC = WowPriceChecker

    -- Bank bags are numbered from BANK_CONTAINER (-1) and NUM_BANKBAGSLOTS (7)
    local BANK_CONTAINER = Enum.BagIndex.Bank
    local numBankSlots = C_Container.GetContainerNumSlots(BANK_CONTAINER)

    if numBankSlots and numBankSlots > 0 then
        for slot = 1, numBankSlots do
            local itemInfo = C_Container.GetContainerItemInfo(BANK_CONTAINER, slot)
            if itemInfo then
                local itemID = itemInfo.itemID
                local stackCount = itemInfo.stackCount or 1

                if itemID then
                    inventory[itemID] = (inventory[itemID] or 0) + stackCount
                    WPC:DebugPrint(string.format("Found item %d x%d in bank slot %d",
                        itemID, stackCount, slot))
                end
            end
        end
    end

    -- Scan bank bags (5-11)
    for bag = 5, 11 do
        local numSlots = C_Container.GetContainerNumSlots(bag)
        if numSlots and numSlots > 0 then
            for slot = 1, numSlots do
                local itemInfo = C_Container.GetContainerItemInfo(bag, slot)
                if itemInfo then
                    local itemID = itemInfo.itemID
                    local stackCount = itemInfo.stackCount or 1

                    if itemID then
                        inventory[itemID] = (inventory[itemID] or 0) + stackCount
                    end
                end
            end
        end
    end
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

---Get item name by ID
---@param itemID number
---@return string|nil
function Scanner:GetItemName(itemID)
    local itemName = C_Item.GetItemNameByID(itemID)
    return itemName
end
