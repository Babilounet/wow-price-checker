import fs from 'fs/promises';
import path from 'path';
import { logger } from '../utils/logger';

export interface AuctionDataItem {
  prices: Array<{
    unitPrice: number;
    totalPrice: number;
    quantity: number;
    timestamp: number;
  }>;
  lastUpdate: number;
}

export interface AuctionData {
  lastScan: number;
  realm: string;
  faction: string;
  items: Record<string, AuctionDataItem>;
}

export interface WowPriceCheckerDB {
  inventory: Record<string, number>;
  auctionData: AuctionData;
}

/**
 * Parse WoW SavedVariables Lua file
 * This parser handles the simple Lua table format used by WoW SavedVariables
 */
export class SavedVariablesParser {
  /**
   * Parse a WoW SavedVariables file
   * @param filePath Path to the .lua file
   */
  async parseFile(filePath: string): Promise<WowPriceCheckerDB | null> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return this.parse(content);
    } catch (error) {
      logger.error('Failed to read SavedVariables file', { filePath, error });
      return null;
    }
  }

  /**
   * Parse SavedVariables Lua content
   * @param content Lua file content
   */
  parse(content: string): WowPriceCheckerDB | null {
    try {
      // Extract WowPriceCheckerDB table
      const dbMatch = content.match(/WowPriceCheckerDB\s*=\s*({[\s\S]*})\s*$/m);
      if (!dbMatch) {
        logger.warn('WowPriceCheckerDB not found in file');
        return null;
      }

      const luaTable = dbMatch[1];
      const db = this.parseLuaTable(luaTable);

      return db as WowPriceCheckerDB;
    } catch (error) {
      logger.error('Failed to parse SavedVariables content', { error });
      return null;
    }
  }

  /**
   * Parse a Lua table string into a JavaScript object
   * This is a simple parser for the Lua table format used by WoW SavedVariables
   */
  private parseLuaTable(luaCode: string): any {
    // Remove comments
    luaCode = luaCode.replace(/--.*$/gm, '');

    // Simple regex-based parser for Lua tables
    const parseValue = (value: string): any => {
      value = value.trim();

      // Boolean
      if (value === 'true') return true;
      if (value === 'false') return false;

      // Nil
      if (value === 'nil') return null;

      // Number
      if (/^-?\d+(\.\d+)?$/.test(value)) {
        return parseFloat(value);
      }

      // String
      if (value.startsWith('"') && value.endsWith('"')) {
        return value.slice(1, -1).replace(/\\"/g, '"');
      }

      // Table
      if (value.startsWith('{')) {
        return this.parseLuaTable(value);
      }

      return value;
    };

    // Determine if this is an array or object
    const isArray = /^\s*{[^=]*}/.test(luaCode);

    if (isArray) {
      // Parse as array
      const items: any[] = [];
      // Match array elements (comma-separated values or tables)
      const arrayPattern = /{([^{}]*(?:{[^{}]*}[^{}]*)*)}/g;
      const matches = luaCode.matchAll(arrayPattern);

      for (const match of matches) {
        const innerContent = match[1];
        const elements = this.splitLuaElements(innerContent);
        elements.forEach((el) => items.push(parseValue(el)));
      }

      return items.length > 0 ? items : this.parseArrayFallback(luaCode);
    } else {
      // Parse as object
      const obj: any = {};

      // Match key-value pairs: ["key"] = value or key = value
      const kvPattern = /\[["']?([^\]"']+)["']?\]\s*=\s*([^,}\n]+(?:{[^}]*})?)|(\w+)\s*=\s*([^,}\n]+(?:{[^}]*})?)/g;
      const matches = luaCode.matchAll(kvPattern);

      for (const match of matches) {
        const key = match[1] || match[3];
        const value = match[2] || match[4];

        if (key && value) {
          obj[key.trim()] = parseValue(value.trim().replace(/,\s*$/, ''));
        }
      }

      return obj;
    }
  }

  /**
   * Fallback array parser for simpler formats
   */
  private parseArrayFallback(luaCode: string): any[] {
    const items: any[] = [];
    const content = luaCode.replace(/^{\s*/, '').replace(/\s*}$/, '');
    const elements = this.splitLuaElements(content);

    elements.forEach((el) => {
      el = el.trim();
      if (!el) return;

      // Parse the value
      if (el === 'true') items.push(true);
      else if (el === 'false') items.push(false);
      else if (el === 'nil') items.push(null);
      else if (/^-?\d+(\.\d+)?$/.test(el)) items.push(parseFloat(el));
      else if (el.startsWith('"')) items.push(el.slice(1, -1));
      else if (el.startsWith('{')) items.push(this.parseLuaTable(el));
      else items.push(el);
    });

    return items;
  }

  /**
   * Split Lua elements by comma, respecting nested tables
   */
  private splitLuaElements(str: string): string[] {
    const elements: string[] = [];
    let current = '';
    let depth = 0;
    let inString = false;
    let stringChar = '';

    for (let i = 0; i < str.length; i++) {
      const char = str[i];
      const prevChar = i > 0 ? str[i - 1] : '';

      // Handle string quotes
      if ((char === '"' || char === "'") && prevChar !== '\\') {
        if (!inString) {
          inString = true;
          stringChar = char;
        } else if (char === stringChar) {
          inString = false;
        }
      }

      // Track table depth
      if (!inString) {
        if (char === '{') depth++;
        if (char === '}') depth--;

        // Split on comma at depth 0
        if (char === ',' && depth === 0) {
          elements.push(current.trim());
          current = '';
          continue;
        }
      }

      current += char;
    }

    if (current.trim()) {
      elements.push(current.trim());
    }

    return elements;
  }

  /**
   * Calculate statistics for an item
   */
  calculateItemStats(itemData: AuctionDataItem): {
    min: number;
    max: number;
    median: number;
    mean: number;
    count: number;
  } {
    const prices = itemData.prices.map((p) => p.unitPrice).sort((a, b) => a - b);

    if (prices.length === 0) {
      return { min: 0, max: 0, median: 0, mean: 0, count: 0 };
    }

    const min = prices[0];
    const max = prices[prices.length - 1];
    const median = prices[Math.floor(prices.length / 2)];
    const mean = prices.reduce((a, b) => a + b, 0) / prices.length;

    return { min, max, median, mean, count: prices.length };
  }
}

export const savedVariablesParser = new SavedVariablesParser();
