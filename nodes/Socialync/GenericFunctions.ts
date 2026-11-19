import { NodeApiError, NodeOperationError } from 'n8n-workflow';
import type {
	IDataObject,
	IExecuteFunctions,
	IHttpRequestMethods,
	IHttpRequestOptions,
	ILoadOptionsFunctions,
	JsonObject,
} from 'n8n-workflow';

import {
	CREDENTIAL_NAME,
	IDEMPOTENCY_KEY_PATTERN,
	IMMEDIATE_PLATFORM_VALUES,
	MAX_IMAGES_PER_POST,
	MAX_PAGE_SIZE,
	PLATFORMS,
	PLATFORM_VALUES,
	SAFE_ID_PATTERN,
	SOCIALYNC_API_BASE_URL,
} from './constants';

type Ctx = IExecuteFunctions | ILoadOptionsFunctions;

export interface RequestOptions {
	body?: IDataObject;
	qs?: IDataObject;
	idempotencyKey?: string;
	itemIndex?: number;
}

// ── errors ──────────────────────────────────────────────────────────────────

interface ApiErrorParts {
	code?: string;
	message?: string;
	docs?: string;
}

/** What n8n hands a catch block, by version. Every field is optional and none is trusted. */
interface ErrorLike {
	message?: unknown;
	httpCode?: unknown;
	statusCode?: unknown;
	body?: unknown;
	response?: { body?: unknown; data?: unknown; status?: unknown; statusCode?: unknown };
	cause?: { response?: { body?: unknown; data?: unknown } };
	context?: { data?: unknown };
}

function asErrorLike(error: unknown): ErrorLike {
	return error !== null && typeof error === 'object' ? (error as ErrorLike) : {};
}

/** The API answers { "error": { "code", "message", "docs" } }. n8n keeps the body in different places by version. */
function readApiError(error: unknown): ApiErrorParts {
	const e = asErrorLike(error);
	const candidates: unknown[] = [
		e.response?.body,
		e.response?.data,
		e.cause?.response?.data,
		e.cause?.response?.body,
		e.context?.data,
		e.body,
	];
	for (let body of candidates) {
		if (typeof body === 'string') {
			try {
				body = JSON.parse(body) as unknown;
			} catch {
				continue;
			}
		}
		if (body === null || typeof body !== 'object') continue;
		const inner = (body as { error?: { code?: unknown; message?: unknown; docs?: unknown } }).error;
		if (inner && typeof inner === 'object' && typeof inner.message === 'string') {
			return {
				code: typeof inner.code === 'string' ? inner.code : undefined,
				message: inner.message,
				docs: typeof inner.docs === 'string' ? inner.docs : undefined,
			};
		}
	}
	return {};
}

function readStatus(error: unknown): number | undefined {
	const e = asErrorLike(error);
	const raw = e.httpCode ?? e.statusCode ?? e.response?.status ?? e.response?.statusCode;
	const n = Number(raw);
	return Number.isFinite(n) && n > 0 ? n : undefined;
}

const HINTS: Record<string, string> = {
	unauthorized:
		'Check the API key in your Socialync credential. You can create a new key on the API Keys page of your Socialync account.',
	rate_limited:
		'Socialync allows 60 requests a minute for each key. Wait a few seconds and run the node again, or add a Wait node between items.',
	direct_publish_disabled:
		'Your Socialync settings ask for confirmation before posts go out, and the API cannot show that dialog. Turn off the publish confirmation in your Socialync settings, or use the Draft resource, which stays allowed.',
	daily_cap_reached:
		'This profile has reached its daily post limit. Schedule the post for another day or use another profile.',
	plan_limit_reached:
		'Your plan has used its posts for this month. Check your plan on the Socialync billing page.',
	profile_not_authorized:
		'This API key cannot use that profile. Use the Profile resource to list the profiles the key can use.',
	idempotency_key_reuse:
		"This Idempotency Key was already used for a different post. Use a new key for each different post, and keep the same key only when you repeat the same post.",
	request_in_flight:
		'The first request with this Idempotency Key is still running. Wait a moment and run the node again with the same key.',
	idempotency_outcome_unknown:
		'Socialync could not record the outcome of the first request with this Idempotency Key. Check the Post resource before trying again, then use a new key.',
	validation_failed:
		'Read the message above, change the field it names, and run the node again.',
	unsupported_for_immediate:
		'Use the Schedule operation with a time a few minutes ahead. TikTok, YouTube, video, titles and Instagram trial reels only work on scheduled posts.',
};

function explain(error: unknown): { message: string; description: string; httpCode?: string } {
	const parts = readApiError(error);
	const status = readStatus(error);
	if (parts.message) {
		const hint = (parts.code && HINTS[parts.code]) || undefined;
		const tail = parts.docs ? ` More detail: ${parts.docs}` : '';
		return {
			message: parts.message,
			description: `${hint ?? 'Change what the message names and run the node again.'}${tail}`,
			httpCode: status ? String(status) : undefined,
		};
	}
	if (status === 404) {
		return {
			message: 'Socialync did not find that address',
			description:
				'Check the post, draft or media ID.',
			httpCode: '404',
		};
	}
	if (status === 401 || status === 403) {
		return {
			message: 'Socialync did not accept the API key',
			description: HINTS.unauthorized,
			httpCode: String(status),
		};
	}
	if (status === 429) {
		return {
			message: 'Socialync asked n8n to slow down',
			description: HINTS.rate_limited,
			httpCode: '429',
		};
	}
	return {
		message: asErrorLike(error).message
			? String(asErrorLike(error).message)
			: 'Socialync could not complete the request',
		description: 'Check the values in the node and try again. If it keeps happening, contact Socialync support.',
		httpCode: status ? String(status) : undefined,
	};
}

// ── requests ────────────────────────────────────────────────────────────────

export async function socialyncRequest(
	this: Ctx,
	method: IHttpRequestMethods,
	path: string,
	opts: RequestOptions = {},
): Promise<IDataObject> {
	const options: IHttpRequestOptions = {
		method,
		url: `${SOCIALYNC_API_BASE_URL}${path}`,
		json: true,
		headers: { Accept: 'application/json' },
	};
	if (opts.body !== undefined) options.body = opts.body;
	if (opts.qs !== undefined && Object.keys(opts.qs).length > 0) options.qs = opts.qs;
	if (opts.idempotencyKey) options.headers = { ...options.headers, 'Idempotency-Key': opts.idempotencyKey };
	try {
		return (await this.helpers.httpRequestWithAuthentication.call(
			this,
			CREDENTIAL_NAME,
			options,
		)) as IDataObject;
	} catch (error) {
		const { message, description, httpCode } = explain(error);
		throw new NodeApiError(this.getNode(), error as JsonObject, {
			message,
			description,
			httpCode,
			itemIndex: opts.itemIndex,
		});
	}
}

// ── small readers ───────────────────────────────────────────────────────────

function fail(ctx: IExecuteFunctions, message: string, description: string, itemIndex: number): never {
	throw new NodeOperationError(ctx.getNode(), message, { description, itemIndex });
}

export function readText(ctx: IExecuteFunctions, name: string, i: number, fallback = ''): string {
	const value = ctx.getNodeParameter(name, i, fallback) as unknown;
	return value === undefined || value === null ? '' : String(value).trim();
}

export function readId(ctx: IExecuteFunctions, name: string, label: string, i: number): string {
	const id = readText(ctx, name, i);
	if (!SAFE_ID_PATTERN.test(id)) {
		fail(
			ctx,
			`The '${label}' is not a valid ID`,
			`An ID has 1 to 128 letters, digits, underscores or dashes. Copy it from the output of an earlier Socialync node.`,
			i,
		);
	}
	return id;
}

export function readIdempotencyKey(ctx: IExecuteFunctions, extras: IDataObject, i: number): string | undefined {
	const key = extras.idempotencyKey === undefined ? '' : String(extras.idempotencyKey).trim();
	if (!key) return undefined;
	if (!IDEMPOTENCY_KEY_PATTERN.test(key)) {
		fail(
			ctx,
			"The 'Idempotency Key' is not valid",
			'Use 1 to 255 characters: letters, digits, underscore, dot, colon or dash. Spaces are not allowed.',
			i,
		);
	}
	return key;
}

/** Platform names from a dropdown, or from an expression that returns a list or a comma separated text. */
export function readPlatforms(
	ctx: IExecuteFunctions,
	raw: unknown,
	i: number,
	allowed: string[] = PLATFORM_VALUES,
	label = 'Platforms',
): string[] {
	const list = (Array.isArray(raw) ? raw : String(raw ?? '').split(','))
		.map((p) => String(p).trim().toLowerCase())
		.filter(Boolean)
		.map((p) => (p === 'x' ? 'twitter' : p));
	if (list.length === 0) {
		fail(ctx, `Choose at least one platform in '${label}'`, 'Pick one or more platforms.', i);
	}
	const unknown = list.filter((p) => !PLATFORM_VALUES.includes(p));
	if (unknown.length > 0) {
		fail(
			ctx,
			`Socialync does not know the platform '${unknown.join("', '")}'`,
			`Use: ${PLATFORM_VALUES.join(', ')}.`,
			i,
		);
	}
	const blocked = list.filter((p) => !allowed.includes(p));
	if (blocked.length > 0) {
		const names = blocked.map((p) => PLATFORMS.find((x) => x.value === p)?.name ?? p).join(', ');
		fail(
			ctx,
			`${names} can only be posted on a schedule`,
			'Set a time a few minutes ahead (the Schedule operation, or Scheduled At under Additional Fields), or remove it from Platforms.',
			i,
		);
	}
	return [...new Set(list)];
}

/** One https URL per line, or a list from an expression. */
export function readUrlList(ctx: IExecuteFunctions, raw: unknown, label: string, i: number): string[] {
	const parts = Array.isArray(raw)
		? raw.map((u) => String(u))
		: String(raw ?? '').split(/[\r\n]+|,\s*(?=https:\/\/)/i);
	const urls = parts.map((u) => u.trim()).filter(Boolean);
	if (urls.length === 0) fail(ctx, `Add at least one link in '${label}'`, 'Use one https link per line.', i);
	if (urls.length > MAX_IMAGES_PER_POST) {
		fail(ctx, `'${label}' has more than ${MAX_IMAGES_PER_POST} links`, 'A post carries at most 10 images.', i);
	}
	for (const url of urls) {
		if (!/^https:\/\//i.test(url) || url.length > 2048) {
			fail(ctx, `'${url.slice(0, 80)}' is not a valid link`, `'${label}' needs public https links.`, i);
		}
	}
	return urls;
}

export function readHttpsUrl(ctx: IExecuteFunctions, raw: unknown, label: string, i: number): string {
	const url = String(raw ?? '').trim();
	if (!/^https:\/\//i.test(url) || url.length > 2048) {
		fail(ctx, `The '${label}' is not a valid link`, 'Use a public https link.', i);
	}
	return url;
}

export function readJsonObject(ctx: IExecuteFunctions, raw: unknown, label: string, i: number): IDataObject {
	let value = raw;
	if (typeof raw === 'string') {
		try {
			value = JSON.parse(raw);
		} catch {
			fail(ctx, `'${label}' is not valid JSON`, 'Write a JSON object, for example {"key": "value"}.', i);
		}
	}
	if (!value || typeof value !== 'object' || Array.isArray(value)) {
		fail(ctx, `'${label}' must be a JSON object`, 'Write a JSON object, for example {"key": "value"}.', i);
	}
	return value as IDataObject;
}

// ── time ────────────────────────────────────────────────────────────────────

/**
 * The API wants an ISO 8601 time with Z or an offset. n8n's date field returns local time with no
 * offset ("2026-11-12T09:30:00"), meant in the workflow time zone. Text with an offset is used as written.
 */
export function toUtcIso(value: unknown, timeZone: string): string | undefined {
	const s = String(value ?? '').trim();
	if (!s) return undefined;
	if (/([zZ]|[+-]\d{2}:?\d{2})$/.test(s)) {
		const d = new Date(s);
		return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
	}
	const m = s.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?/);
	if (!m) return undefined;
	const [y, mo, d, h, mi] = m.slice(1, 6).map(Number);
	const sec = m[6] ? Number(m[6]) : 0;
	const guess = Date.UTC(y, mo - 1, d, h, mi, sec);
	const offsetAt = (t: number): number => {
		const parts = new Intl.DateTimeFormat('en-US', {
			timeZone,
			hourCycle: 'h23',
			year: 'numeric',
			month: '2-digit',
			day: '2-digit',
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit',
		}).formatToParts(new Date(t));
		const v: Record<string, number> = {};
		for (const p of parts) if (p.type !== 'literal') v[p.type] = Number(p.value);
		return Date.UTC(v.year, v.month - 1, v.day, v.hour, v.minute, v.second) - t;
	};
	let utc = guess - offsetAt(guess);
	utc = guess - offsetAt(utc);
	return new Date(utc).toISOString();
}

function readTime(ctx: IExecuteFunctions, raw: unknown, label: string, i: number): string {
	let iso: string | undefined;
	try {
		iso = toUtcIso(raw, ctx.getTimezone());
	} catch {
		iso = undefined;
	}
	if (!iso) {
		fail(
			ctx,
			`The '${label}' is not a valid time`,
			'Use a date and time like 2026-11-12 09:30, or a full ISO time like 2026-11-12T09:30:00-05:00.',
			i,
		);
	}
	return iso;
}

// ── post bodies ─────────────────────────────────────────────────────────────

export type PostBodyKind = 'publishNow' | 'schedule' | 'validate' | 'draft';

/** The JSON body of POST /posts, POST /drafts and POST /posts/validate, built from the node's fields. */
export function buildPostBody(
	ctx: IExecuteFunctions,
	i: number,
	kind: PostBodyKind,
): { body: IDataObject; idempotencyKey?: string } {
	const extras = ctx.getNodeParameter('additionalFields', i, {}) as IDataObject;
	const body: IDataObject = {};

	const profileId = readText(ctx, 'profileId', i);
	if (profileId) {
		if (!SAFE_ID_PATTERN.test(profileId)) {
			fail(ctx, "The 'Profile' is not a valid ID", 'Pick a profile from the list, or copy an ID from the Profile resource.', i);
		}
		body.profileId = profileId;
	}

	const scheduledAtRaw = kind === 'schedule' ? ctx.getNodeParameter('scheduledAt', i, '') : extras.scheduledAt;
	const scheduled = scheduledAtRaw !== undefined && String(scheduledAtRaw).trim() !== '';
	if (kind === 'schedule' && !scheduled) {
		fail(ctx, "Set a time in 'Scheduled At'", 'Scheduled posts need a date and time a few minutes ahead.', i);
	}
	const immediate = kind === 'publishNow' || !scheduled;

	body.platforms = readPlatforms(
		ctx,
		ctx.getNodeParameter('platforms', i, []),
		i,
		immediate ? IMMEDIATE_PLATFORM_VALUES : PLATFORM_VALUES,
	);
	const caption = readText(ctx, 'caption', i);
	if (!caption) fail(ctx, "The 'Caption' is empty", 'Write the text of the post.', i);
	body.caption = caption;
	if (scheduled) body.scheduledAt = readTime(ctx, scheduledAtRaw, 'Scheduled At', i);

	const mediaSource = readText(ctx, 'mediaSource', i, 'none');
	if (mediaSource === 'imageUrls') {
		body.imageUrls = readUrlList(ctx, ctx.getNodeParameter('imageUrls', i, ''), 'Image URLs', i);
	} else if (mediaSource === 'videoUrl') {
		body.videoUrl = readHttpsUrl(ctx, ctx.getNodeParameter('videoUrl', i, ''), 'Video URL', i);
	} else if (mediaSource === 'mediaId') {
		const mediaId = readText(ctx, 'mediaId', i);
		if (!/^upload:[A-Za-z0-9_-]{1,128}$/.test(mediaId)) {
			fail(
				ctx,
				"The 'Media ID' is not valid",
				'Use the mediaId from the Media Upload operation. It looks like upload:abc123.',
				i,
			);
		}
		body.mediaId = mediaId;
	}

	const firstComment = extras.firstComment === undefined ? '' : String(extras.firstComment).trim();
	if (firstComment) body.firstComment = firstComment;
	const title = extras.title === undefined ? '' : String(extras.title).trim();
	if (title) body.title = title;
	if (extras.tiktokPrivacyLevel) body.tiktokPrivacyLevel = String(extras.tiktokPrivacyLevel);
	if (extras.instagramTrialReel) body.instagramTrialReel = String(extras.instagramTrialReel);
	if (extras.platformSpecificSettings !== undefined && String(extras.platformSpecificSettings).trim() !== '') {
		body.platformSpecificSettings = readJsonObject(
			ctx,
			extras.platformSpecificSettings,
			'Platform Specific Settings',
			i,
		);
	}

	const idempotencyKey = kind === 'validate' ? undefined : readIdempotencyKey(ctx, extras, i);
	return { body, idempotencyKey };
}

function buildUpdateBody(ctx: IExecuteFunctions, i: number): IDataObject {
	const fields = ctx.getNodeParameter('updateFields', i, {}) as IDataObject;
	const body: IDataObject = {};
	if (fields.scheduledAt !== undefined && String(fields.scheduledAt).trim() !== '') {
		body.scheduledAt = readTime(ctx, fields.scheduledAt, 'Scheduled At', i);
	}
	if (fields.caption !== undefined && String(fields.caption).trim() !== '') {
		body.caption = String(fields.caption).trim();
	}
	if (fields.title !== undefined && String(fields.title).trim() !== '') body.title = String(fields.title).trim();
	if (fields.firstComment !== undefined) body.firstComment = String(fields.firstComment).trim();
	const captions = (fields.platformCaptions as IDataObject | undefined)?.captions as IDataObject[] | undefined;
	if (Array.isArray(captions) && captions.length > 0) {
		const map: IDataObject = {};
		for (const row of captions) {
			const platform = String(row.platform ?? '').trim().toLowerCase();
			const text = String(row.caption ?? '').trim();
			if (!PLATFORM_VALUES.includes(platform) || !text) {
				fail(ctx, "A row in 'Platform Captions' is incomplete", 'Each row needs a platform and a caption.', i);
			}
			map[platform] = text;
		}
		body.platformCaptions = map;
	}
	if (fields.removePlatforms !== undefined) {
		const remove = readPlatforms(ctx, fields.removePlatforms, i, PLATFORM_VALUES, 'Remove Platforms');
		body.removePlatforms = remove;
	}
	if (Object.keys(body).length === 0) {
		fail(ctx, 'There is nothing to update', "Add at least one field under 'Update Fields'.", i);
	}
	return body;
}

// ── media ───────────────────────────────────────────────────────────────────

const EXTENSION_TYPES: Record<string, string> = {
	jpg: 'image/jpeg',
	jpeg: 'image/jpeg',
	png: 'image/png',
	gif: 'image/gif',
	webp: 'image/webp',
	mp4: 'video/mp4',
	mov: 'video/quicktime',
	m4v: 'video/x-m4v',
	webm: 'video/webm',
};

interface UploadFile {
	fileName: string;
	contentType: string;
	data: Buffer;
}

function typeFromName(name: string): string | undefined {
	const ext = name.split('?')[0].split('.').pop()?.toLowerCase();
	return ext ? EXTENSION_TYPES[ext] : undefined;
}

async function collectUploadFiles(ctx: IExecuteFunctions, i: number): Promise<UploadFile[]> {
	const source = readText(ctx, 'source', i, 'binaryData');
	const files: UploadFile[] = [];
	if (source === 'url') {
		const url = readHttpsUrl(ctx, ctx.getNodeParameter('mediaUrl', i, ''), 'Media URL', i);
		const response = (await ctx.helpers.httpRequest({
			method: 'GET',
			url,
			encoding: 'arraybuffer',
			returnFullResponse: true,
			json: false,
		})) as { body: Buffer | ArrayBuffer; headers?: Record<string, string> };
		const data = Buffer.isBuffer(response.body) ? response.body : Buffer.from(response.body as ArrayBuffer);
		const header = String(response.headers?.['content-type'] ?? '').split(';')[0].trim().toLowerCase();
		const path = new URL(url).pathname;
		const fileName = decodeURIComponent(path.split('/').pop() || '') || 'media';
		const contentType = /^(image|video)\//.test(header) ? header : typeFromName(fileName) ?? header;
		files.push({ fileName, contentType, data });
	} else {
		const names = readText(ctx, 'binaryPropertyName', i, 'data')
			.split(',')
			.map((n) => n.trim())
			.filter(Boolean);
		if (names.length === 0) {
			fail(ctx, "Set 'Input Binary Field'", 'Use the name of the binary field that holds the file, usually data.', i);
		}
		for (const name of names) {
			const binary = ctx.helpers.assertBinaryData(i, name);
			const data = await ctx.helpers.getBinaryDataBuffer(i, name);
			const ext = binary.fileExtension ? `.${binary.fileExtension}` : '';
			const fileName = binary.fileName || `${name}${ext}`;
			files.push({ fileName, contentType: binary.mimeType || typeFromName(fileName) || '', data });
		}
	}
	if (files.length === 0 || files.length > MAX_IMAGES_PER_POST) {
		fail(ctx, 'Upload between 1 and 10 files at a time', 'One upload is up to 10 images (a carousel) or one video.', i);
	}
	for (const f of files) {
		if (!/^(image|video)\//.test(f.contentType)) {
			fail(
				ctx,
				`Socialync cannot use '${f.fileName}'`,
				`Its file type is '${f.contentType || 'unknown'}'. Upload images (jpg, png, gif, webp) or one video (mp4, mov).`,
				i,
			);
		}
	}
	return files;
}

/** The three step upload: ask for URLs, PUT the bytes, finalize. Returns the mediaId to use on a post. */
async function uploadMedia(ctx: IExecuteFunctions, i: number): Promise<IDataObject> {
	const files = await collectUploadFiles(ctx, i);
	const created = (await socialyncRequest.call(ctx, 'POST', '/media', {
		body: {
			files: files.map((f) => ({ fileName: f.fileName, contentType: f.contentType, sizeBytes: f.data.length })),
		},
		itemIndex: i,
	})) as { id: string; files: Array<{ index: number; uploadUrl: string; contentType: string }> };

	for (const target of created.files) {
		const file = files[target.index];
		if (!file) continue;
		try {
			// The storage URL is signed. It takes the bytes with the exact Content-Type and no Authorization header.
			await ctx.helpers.httpRequest({
				method: 'PUT',
				url: target.uploadUrl,
				headers: { 'Content-Type': target.contentType },
				body: file.data,
				json: false,
			});
		} catch (error) {
			throw new NodeApiError(ctx.getNode(), error as JsonObject, {
				message: `Socialync's storage did not accept '${file.fileName}'`,
				description:
					'The upload link lasts one hour. Run the node again to get a new one. Check that the file is a supported image or video.',
				itemIndex: i,
			});
		}
	}

	return (await socialyncRequest.call(ctx, 'POST', `/media/${encodeURIComponent(created.id)}/finalize`, {
		itemIndex: i,
	})) as IDataObject;
}

// ── operations ──────────────────────────────────────────────────────────────

type Output = IDataObject | IDataObject[];

async function listPosts(ctx: IExecuteFunctions, i: number): Promise<IDataObject[]> {
	const returnAll = ctx.getNodeParameter('returnAll', i, false) as boolean;
	const limit = returnAll ? MAX_PAGE_SIZE : Math.min(MAX_PAGE_SIZE, Number(ctx.getNodeParameter('limit', i, 50)) || 50);
	const filters = ctx.getNodeParameter('filters', i, {}) as IDataObject;
	const qs: IDataObject = { view: readText(ctx, 'view', i, 'scheduled'), limit };
	const profileId = filters.profileId ? String(filters.profileId).trim() : '';
	if (profileId) qs.profileId = profileId;
	const status = filters.status ? String(filters.status).trim() : '';
	if (status) qs.status = status;

	const rows: IDataObject[] = [];
	let cursor: string | undefined;
	for (let page = 0; page < 1000; page++) {
		const res = (await socialyncRequest.call(ctx, 'GET', '/posts', {
			qs: cursor ? { ...qs, cursor } : qs,
			itemIndex: i,
		})) as { data?: IDataObject[]; hasMore?: boolean; nextCursor?: string | null };
		rows.push(...(res.data ?? []));
		if (!returnAll || !res.hasMore || !res.nextCursor) break;
		cursor = res.nextCursor;
	}
	return returnAll ? rows : rows.slice(0, limit);
}

export async function runOperation(
	ctx: IExecuteFunctions,
	resource: string,
	operation: string,
	i: number,
): Promise<Output> {
	switch (`${resource}:${operation}`) {
		case 'account:get':
			return await socialyncRequest.call(ctx, 'GET', '/me', { itemIndex: i });

		case 'analytics:get': {
			const options = ctx.getNodeParameter('options', i, {}) as IDataObject;
			const qs: IDataObject = {
				period: readText(ctx, 'period', i, 'week'),
				platform: options.platform ? String(options.platform) : 'all',
				breakdown: options.breakdown ? String(options.breakdown) : 'total',
			};
			if (options.days !== undefined && Number(options.days) > 0) qs.days = Number(options.days);
			if (options.includeTimeseries === true) qs.includeTimeseries = 'true';
			const profileId = options.profileId ? String(options.profileId).trim() : '';
			if (profileId) qs.profileId = profileId;
			return await socialyncRequest.call(ctx, 'GET', '/analytics', { qs, itemIndex: i });
		}

		case 'connection:getAll': {
			const profileId = readText(ctx, 'profileId', i);
			const res = (await socialyncRequest.call(ctx, 'GET', '/connections', {
				qs: profileId ? { profileId } : {},
				itemIndex: i,
			})) as { data?: IDataObject[] };
			return res.data ?? [];
		}

		case 'draft:approve': {
			const extras = ctx.getNodeParameter('additionalFields', i, {}) as IDataObject;
			const id = readId(ctx, 'draftId', 'Draft ID', i);
			const body: IDataObject = {};
			if (extras.scheduledAt !== undefined && String(extras.scheduledAt).trim() !== '') {
				body.scheduledAt = readTime(ctx, extras.scheduledAt, 'Scheduled At', i);
			}
			return await socialyncRequest.call(ctx, 'POST', `/drafts/${encodeURIComponent(id)}/approve`, {
				body,
				idempotencyKey: readIdempotencyKey(ctx, extras, i),
				itemIndex: i,
			});
		}

		case 'draft:create': {
			const { body, idempotencyKey } = buildPostBody(ctx, i, 'draft');
			return await socialyncRequest.call(ctx, 'POST', '/drafts', { body, idempotencyKey, itemIndex: i });
		}

		case 'draft:get': {
			const id = readId(ctx, 'draftId', 'Draft ID', i);
			return await socialyncRequest.call(ctx, 'GET', `/drafts/${encodeURIComponent(id)}`, { itemIndex: i });
		}

		case 'media:upload':
			return await uploadMedia(ctx, i);

		case 'post:delete': {
			const id = readId(ctx, 'postId', 'Post ID', i);
			const res = (await socialyncRequest.call(ctx, 'DELETE', `/posts/${encodeURIComponent(id)}`, {
				itemIndex: i,
			})) as IDataObject;
			const cancelled = res.cancelledCount === undefined ? 1 : Number(res.cancelledCount);
			return { deleted: cancelled > 0, ...res };
		}

		case 'post:get': {
			const id = readId(ctx, 'postId', 'Post ID', i);
			return await socialyncRequest.call(ctx, 'GET', `/posts/${encodeURIComponent(id)}`, { itemIndex: i });
		}

		case 'post:getAll':
			return await listPosts(ctx, i);

		case 'post:publishNow': {
			const { body, idempotencyKey } = buildPostBody(ctx, i, 'publishNow');
			return await socialyncRequest.call(ctx, 'POST', '/posts', { body, idempotencyKey, itemIndex: i });
		}

		case 'post:schedule': {
			const { body, idempotencyKey } = buildPostBody(ctx, i, 'schedule');
			return await socialyncRequest.call(ctx, 'POST', '/posts', { body, idempotencyKey, itemIndex: i });
		}

		case 'post:update': {
			const id = readId(ctx, 'postId', 'Post ID', i);
			return await socialyncRequest.call(ctx, 'PATCH', `/posts/${encodeURIComponent(id)}`, {
				body: buildUpdateBody(ctx, i),
				itemIndex: i,
			});
		}

		case 'post:validate': {
			const { body } = buildPostBody(ctx, i, 'validate');
			return await socialyncRequest.call(ctx, 'POST', '/posts/validate', { body, itemIndex: i });
		}

		case 'profile:getAll': {
			const res = (await socialyncRequest.call(ctx, 'GET', '/profiles', { itemIndex: i })) as {
				data?: IDataObject[];
			};
			return res.data ?? [];
		}

		default:
			fail(
				ctx,
				`The operation '${operation}' is not available for '${resource}'`,
				'Pick an operation from the list.',
				i,
			);
	}
}
