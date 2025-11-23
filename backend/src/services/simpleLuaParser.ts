import fs from 'fs/promises';
import { logger } from '../utils/logger';

export interface AuctionPrice {
  unitPrice: number;
  totalPrice: number;
  quantity: number;
  timestamp: number;
}

export interface AuctionItem {
  prices: AuctionPrice[];
  lastUpdate: number;
}

/**
 * Ultra-simple Lua parser that reads line by line
 * Specifically designed for WoW SavedVariables format
 */
export class SimpleLuaParser {
  async parseWowPriceCheckerFile(filePath: string): Promise<any> {
    try {
      logger.info('Reading file', { filePath });
      const content = await fs.readFile(filePath, 'utf-8');

      const result: any = {
        characterName: '',
        realmName: '',
        timestamp: 0,
        inventory: {},
        auctionData: {
          lastScan: 0,
          realm: '',
          faction: '',
          items: {}
        }
      };

      // Extract simple values with regex
      const charNameMatch = content.match(/\["characterName"\]\s*=\s*"([^"]+)"/);
      if (charNameMatch) result.characterName = charNameMatch[1];

      const realmMatch = content.match(/\["realmName"\]\s*=\s*"([^"]+)"/);
      if (realmMatch) result.realmName = realmMatch[1];

      const timestampMatch = content.match(/\["timestamp"\]\s*=\s*(\d+)/);
      if (timestampMatch) result.timestamp = parseInt(timestampMatch[1]);

      // Extract auctionData simple fields
      const lastScanMatch = content.match(/\["lastScan"\]\s*=\s*(\d+)/);
      if (lastScanMatch) result.auctionData.lastScan = parseInt(lastScanMatch[1]);

      const factionMatch = content.match(/\["faction"\]\s*=\s*"([^"]+)"/);
      if (factionMatch) result.auctionData.faction = factionMatch[1];

      const realmAuctionMatch = content.match(/\["auctionData"\].*?\["realm"\]\s*=\s*"([^"]+)"/s);
      if (realmAuctionMatch) result.auctionData.realm = realmAuctionMatch[1];
      else result.auctionData.realm = result.realmName;

      // Extract auction items - find the items section
      // Match from ["items"] = { to the closing },
      const itemsSectionMatch = content.match(/\["items"\]\s*=\s*\{([\s\S]*?)\},\s*\n\["realm"\]/);

      if (!itemsSectionMatch) {
        logger.warn('No items section found');
        return result;
      }

      logger.info('Parsing items section...');
      const itemsContent = itemsSectionMatch[1];

      // Parse items one by one
      // Pattern: [itemId] = { ... ["prices"] = { ... }, ["lastUpdate"] = timestamp, },
      const itemPattern = /\[(\d+)\]\s*=\s*\{\s*\["prices"\]\s*=\s*\{([\s\S]*?)\},\s*\["lastUpdate"\]\s*=\s*(\d+),\s*\},/g;
      let itemMatch;
      let itemCount = 0;

      while ((itemMatch = itemPattern.exec(itemsContent)) !== null) {
        const itemId = itemMatch[1];
        const pricesContent = itemMatch[2];
        const lastUpdate = parseInt(itemMatch[3]);

        // Extract prices for this item
        // Pattern: { ["unitPrice"] = xxx, ["quantity"] = xxx, ["totalPrice"] = xxx, ["timestamp"] = xxx, },
        const prices: AuctionPrice[] = [];
        const pricePattern = /\{\s*\["unitPrice"\]\s*=\s*(\d+),\s*\["quantity"\]\s*=\s*(\d+),\s*\["totalPrice"\]\s*=\s*(\d+),\s*\["timestamp"\]\s*=\s*(\d+),\s*\},/g;

        let priceMatch;
        while ((priceMatch = pricePattern.exec(pricesContent)) !== null) {
          prices.push({
            unitPrice: parseInt(priceMatch[1]),
            quantity: parseInt(priceMatch[2]),
            totalPrice: parseInt(priceMatch[3]),
            timestamp: parseInt(priceMatch[4])
          });
        }

        if (prices.length > 0) {
          result.auctionData.items[itemId] = {
            prices,
            lastUpdate
          };
          itemCount++;
        }
      }

      logger.info(`Parsed ${itemCount} items`);

      // Parse inventory section
      const inventorySectionMatch = content.match(/\["inventory"\]\s*=\s*\{([\s\S]*?)\},\s*\n\["auctionData"\]/);
      if (inventorySectionMatch) {
        const inventoryContent = inventorySectionMatch[1];
        // Pattern: [itemId] = quantity,
        const inventoryPattern = /\[(\d+)\]\s*=\s*(\d+),/g;
        let invMatch;
        let invCount = 0;

        while ((invMatch = inventoryPattern.exec(inventoryContent)) !== null) {
          const itemId = invMatch[1];
          const quantity = parseInt(invMatch[2]);
          result.inventory[itemId] = quantity;
          invCount++;
        }

        logger.info(`Parsed ${invCount} inventory items`);
      }

      return result;

    } catch (error) {
      logger.error('Failed to parse file', { filePath, error });
      return null;
    }
  }
}

export const simpleLuaParser = new SimpleLuaParser();
