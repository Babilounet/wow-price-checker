import axios from 'axios';
import { blizzardAuthService } from '../auth/blizzardAuth';
import { config } from '../config';

async function testBlizzardIconAPI() {
  const token = await blizzardAuthService.getAccessToken();
  const itemId = 2589; // Linen Cloth

  const namespaces = [
    'static-classic-eu',
    'static-classic1x-eu',
    'static-eu',
    'static-classic-era-eu'
  ];

  console.log(`Testing Blizzard Icon API for item ${itemId}...\n`);

  for (const ns of namespaces) {
    try {
      const response = await axios.get(
        `https://eu.api.blizzard.com/data/wow/media/item/${itemId}`,
        {
          params: { namespace: ns, locale: 'fr_FR' },
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      console.log(`✓ ${ns}: SUCCESS`);
      console.log(`  Icon URL: ${response.data.assets[0].value}\n`);
      return; // Found working namespace
    } catch (e: any) {
      console.log(`✗ ${ns}: ${e.response?.status || e.message}`);
    }
  }

  console.log('\nNo working namespace found for Classic Anniversary icons.');
}

testBlizzardIconAPI().catch(console.error);
