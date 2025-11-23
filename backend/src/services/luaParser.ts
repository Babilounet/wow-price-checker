import fs from 'fs/promises';
import { logger } from '../utils/logger';

/**
 * Simple line-by-line Lua parser for WoW SavedVariables
 * More robust than regex-based parsing for large files
 */
export class LuaParser {
  /**
   * Parse a Lua SavedVariables file line by line
   */
  async parseFile(filePath: string): Promise<any> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return this.parse(content);
    } catch (error) {
      logger.error('Failed to read file', { filePath, error });
      return null;
    }
  }

  /**
   * Parse Lua table content
   */
  parse(content: string): any {
    const lines = content.split('\n');
    const result: any = {};

    let currentPath: string[] = [];
    let currentObject: any = result;
    let stack: any[] = [result];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Skip empty lines and comments
      if (!line || line.startsWith('--')) continue;

      // Match key = value or key = {
      const keyValueMatch = line.match(/^\[?"?([^"\]]+)"?\]?\s*=\s*(.+)$/);

      if (keyValueMatch) {
        const key = keyValueMatch[1];
        const value = keyValueMatch[2].trim();

        if (value === '{') {
          // Start of new table
          const newObj: any = {};
          currentObject[key] = newObj;
          stack.push(currentObject);
          currentObject = newObj;
          currentPath.push(key);
        } else if (value.endsWith(',')) {
          // Simple value with comma
          currentObject[key] = this.parseValue(value.slice(0, -1));
        } else if (value.endsWith('{')) {
          // Inline table start
          const newObj: any = {};
          currentObject[key] = newObj;
          stack.push(currentObject);
          currentObject = newObj;
          currentPath.push(key);
        } else {
          // Simple value
          currentObject[key] = this.parseValue(value);
        }
      } else if (line === '},') {
        // End of table
        if (stack.length > 1) {
          currentObject = stack.pop();
          currentPath.pop();
        }
      } else if (line === '}') {
        // End of table (last one)
        if (stack.length > 1) {
          currentObject = stack.pop();
          currentPath.pop();
        }
      } else if (line === '{') {
        // Array element start
        if (!Array.isArray(currentObject)) {
          // Convert current object to hold array
          const arr: any[] = [];
          const lastKey = currentPath[currentPath.length - 1];
          if (lastKey && stack.length > 0) {
            const parent = stack[stack.length - 1];
            parent[lastKey] = arr;
            currentObject = {};
            arr.push(currentObject);
          }
        } else {
          const newObj: any = {};
          currentObject.push(newObj);
          stack.push(currentObject);
          currentObject = newObj;
        }
      }
    }

    return result;
  }

  /**
   * Parse a Lua value
   */
  private parseValue(value: string): any {
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
      return value.slice(1, -1);
    }

    return value;
  }

  /**
   * Extract auction data from parsed result
   */
  extractAuctionData(parsed: any): any {
    const db = parsed.WowPriceCheckerDB;
    if (!db) return null;

    return {
      characterName: db.characterName,
      realmName: db.realmName,
      timestamp: db.timestamp,
      inventory: db.inventory || {},
      auctionData: db.auctionData || {
        lastScan: 0,
        realm: db.realmName || '',
        faction: '',
        items: {}
      }
    };
  }
}

export const luaParser = new LuaParser();
