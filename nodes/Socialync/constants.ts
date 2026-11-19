/**
 * Values the node shares between its files. Nothing here reads the environment.
 *
 * SOCIALYNC_API_BASE_URL is the production address of the Socialync REST API.
 * The API is open on every plan.
 */
export const SOCIALYNC_API_BASE_URL = 'https://mcp.socialync.io/v1';

export const CREDENTIAL_NAME = 'socialyncApi';

/** Platform values the API accepts, with the names people see in each platform's own app. */
export const PLATFORMS: Array<{ name: string; value: string }> = [
	{ name: 'Bluesky', value: 'bluesky' },
	{ name: 'Facebook', value: 'facebook' },
	{ name: 'Instagram', value: 'instagram' },
	{ name: 'LinkedIn', value: 'linkedin' },
	{ name: 'Threads', value: 'threads' },
	{ name: 'TikTok', value: 'tiktok' },
	{ name: 'X', value: 'twitter' },
	{ name: 'YouTube', value: 'youtube' },
];

export const PLATFORM_VALUES = PLATFORMS.map((p) => p.value);

/** Platforms an immediate post can reach. TikTok and YouTube publish through scheduling only. */
export const IMMEDIATE_PLATFORM_VALUES = [
	'facebook',
	'instagram',
	'linkedin',
	'twitter',
	'threads',
	'bluesky',
];

export const TIKTOK_PRIVACY_LEVELS: Array<{ name: string; value: string }> = [
	{ name: 'Followers of the Creator', value: 'FOLLOWER_OF_CREATOR' },
	{ name: 'Mutual Follow Friends', value: 'MUTUAL_FOLLOW_FRIENDS' },
	{ name: 'Only Me', value: 'SELF_ONLY' },
	{ name: 'Public to Everyone', value: 'PUBLIC_TO_EVERYONE' },
];

export const MAX_IMAGES_PER_POST = 10;
export const MAX_PAGE_SIZE = 100;

/** Ids the API accepts in a path. */
export const SAFE_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;
export const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9_.:-]{1,255}$/;
