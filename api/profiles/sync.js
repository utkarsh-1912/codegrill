import { fetchPlatformProfile } from '../../server/plugins/profiles.mjs';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  const platform = String(req.query?.platform || '').trim();
  const handle = String(req.query?.handle || '').trim();
  if (!platform || !handle) {
    return res.status(400).json({ ok: false, error: 'Missing platform or handle parameter' });
  }

  try {
    const result = await fetchPlatformProfile(platform, handle, 9000);
    return res.status(200).json(result);
  } catch (error) {
    return res.status(200).json({
      ok: false,
      platform,
      handle,
      note: error?.message || 'Live sync failed',
    });
  }
}
