import type { INodeProperties } from 'n8n-workflow';

import { MAX_PAGE_SIZE, PLATFORMS, TIKTOK_PRIVACY_LEVELS } from '../constants';

const PLATFORM_OPTIONS = PLATFORMS.map((p) => ({ name: p.name, value: p.value }));

const IDEMPOTENCY_DESCRIPTION =
	'A value that is the same every time the same post is sent, for example the row number of a spreadsheet. If n8n repeats the call after a retry, Socialync returns the first result instead of posting again. Use 1 to 255 letters, digits, underscores, dots, colons or dashes. It lasts 24 hours.';

type Kind = 'publishNow' | 'schedule' | 'validate' | 'draft';

interface Where {
	resource: 'post' | 'draft';
	operation: string;
}

const WHERE: Record<Kind, Where> = {
	publishNow: { resource: 'post', operation: 'publishNow' },
	schedule: { resource: 'post', operation: 'schedule' },
	validate: { resource: 'post', operation: 'validate' },
	draft: { resource: 'draft', operation: 'create' },
};

const show = (w: Where) => ({ show: { resource: [w.resource], operation: [w.operation] } });

/** The fields that describe one post. Publish Now, Schedule, Validate and Draft Create share their internal names. */
function postFields(kind: Kind): INodeProperties[] {
	const where = show(WHERE[kind]);
	const immediateOnly = kind === 'publishNow';

	const extras: INodeProperties[] = [
		{
			displayName: 'First Comment',
			name: 'firstComment',
			type: 'string',
			default: '',
			description: 'A comment Socialync adds under the post right after it goes out, up to 2200 characters. Put links here when the platform ranks posts with links lower.',
		},
		{
			displayName: 'Platform Specific Settings',
			name: 'platformSpecificSettings',
			type: 'json',
			default: '',
			description: 'Advanced options for single platforms as a JSON object. Leave empty unless the Socialync API reference lists the setting you need.',
		},
	];
	if (!immediateOnly) {
		extras.push(
			{
				displayName: 'Instagram Trial Reel',
				name: 'instagramTrialReel',
				type: 'options',
				options: [
					{
						name: 'Automatic',
						value: 'AUTO',
						description: 'Instagram decides when to show the reel to followers',
					},
					{
						name: 'Manual',
						value: 'MANUAL',
						description: 'You decide in Instagram when to show the reel to followers',
					},
				],
				default: 'AUTO',
				description: 'Share the video as an Instagram trial reel, shown first to people who do not follow you. Only for a scheduled video that goes to Instagram.',
			},
			{
				displayName: 'Title',
				name: 'title',
				type: 'string',
				default: '',
				description:
					'The title of the video. YouTube needs one. Only for scheduled posts, up to 200 characters',
			},
			{
				displayName: 'TikTok Privacy Level',
				name: 'tiktokPrivacyLevel',
				type: 'options',
				options: TIKTOK_PRIVACY_LEVELS,
				default: 'SELF_ONLY',
				description:
					'Who can see the TikTok post. TikTok needs a level you choose. Only for scheduled posts',
			},
		);
	}
	if (kind === 'validate' || kind === 'draft') {
		extras.push({
			displayName: 'Scheduled At',
			name: 'scheduledAt',
			type: 'dateTime',
			default: '',
			description:
				'When to publish. Leave empty for a post that goes out right away. A time a few minutes ahead makes it a scheduled post, which also allows TikTok, YouTube and video',
		});
	}
	if (kind !== 'validate') {
		extras.push({
			displayName: 'Idempotency Key',
			name: 'idempotencyKey',
			type: 'string',
			default: '',
			description: IDEMPOTENCY_DESCRIPTION,
		});
	}
	extras.sort((a, b) => a.displayName.localeCompare(b.displayName));

	const mediaOptions: INodeProperties['options'] = [
		{ name: 'None', value: 'none', description: 'A text post' },
		{
			name: 'Image URLs',
			value: 'imageUrls',
			description: 'Up to 10 images from public https links, shown as a carousel in order',
		},
	];
	if (!immediateOnly) {
		mediaOptions.push({
			name: 'Video URL',
			value: 'videoUrl',
			description: 'One video from a public https link. Scheduled posts only.',
		});
	}
	mediaOptions.push({
		name: 'Uploaded Media',
		value: 'mediaId',
		description: 'Images or a video you uploaded with the Media resource',
	});

	const fields: INodeProperties[] = [
		{
			displayName: 'Profile Name or ID',
			name: 'profileId',
			type: 'options',
			typeOptions: { loadOptionsMethod: 'getProfiles' },
			default: '',
			description: 'The brand or client to post for. Leave on Default Profile to use your default. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
			displayOptions: where,
		},
		{
			displayName: 'Platform Names or IDs',
			name: 'platforms',
			type: 'multiOptions',
			typeOptions: { loadOptionsMethod: 'getConnectedPlatforms', loadOptionsDependsOn: ['profileId'] },
			required: true,
			default: [],
			description: 'The accounts to post to. The list shows the accounts connected to the chosen profile. Choose from the list, or specify IDs using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
			hint: immediateOnly
				? 'A post that goes out now can reach Facebook, Instagram, LinkedIn, X, Threads and Bluesky'
				: 'TikTok and YouTube need a scheduled time',
			displayOptions: where,
		},
		{
			displayName: 'Caption',
			name: 'caption',
			type: 'string',
			typeOptions: { rows: 4 },
			required: true,
			default: '',
			placeholder: 'e.g. Our new store hours start today',
			description: 'The text of the post. Socialync checks the length for each platform, and X allows 280 characters unless the account has X Premium.',
			displayOptions: where,
		},
	];

	if (kind === 'schedule') {
		fields.push({
			displayName: 'Scheduled At',
			name: 'scheduledAt',
			type: 'dateTime',
			required: true,
			default: '',
			description:
				'When to publish. Read in your workflow time zone unless the value carries an offset such as -05:00. It must be a few minutes ahead and inside the scheduling window of your plan',
			displayOptions: where,
		});
	}

	fields.push(
		{
			displayName: 'Media',
			name: 'mediaSource',
			type: 'options',
			options: mediaOptions,
			default: 'none',
			description: 'What to attach to the post. Instagram, TikTok and YouTube need an image or a video.',
			displayOptions: where,
		},
		{
			displayName: 'Image URLs',
			name: 'imageUrls',
			type: 'string',
			typeOptions: { rows: 3 },
			default: '',
			placeholder: 'e.g. https://example.com/image.png',
			description: 'One public https link per line, up to 10. Socialync copies the images into its own storage when the call is made.',
			displayOptions: {
				show: { ...where.show, mediaSource: ['imageUrls'] },
			},
		},
		{
			displayName: 'Video URL',
			name: 'videoUrl',
			type: 'string',
			default: '',
			placeholder: 'e.g. https://example.com/video.mp4',
			description: 'A public https link to one video file. Socialync copies it into its own storage when the call is made.',
			displayOptions: {
				show: { ...where.show, mediaSource: ['videoUrl'] },
			},
		},
		{
			displayName: 'Media ID',
			name: 'mediaId',
			type: 'string',
			default: '',
			placeholder: 'e.g. upload:abc123',
			description: 'The mediaId returned by the Media resource, Upload operation. It begins with the word upload and a colon.',
			displayOptions: {
				show: { ...where.show, mediaSource: ['mediaId'] },
			},
		},
		{
			displayName: 'Additional Fields',
			name: 'additionalFields',
			type: 'collection',
			placeholder: 'Add Field',
			default: {},
			options: extras,
			displayOptions: where,
		},
	);
	return fields;
}

export const postOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['post'] } },
		options: [
			{
				name: 'Delete',
				value: 'delete',
				description: 'Cancel a scheduled post that has not gone out yet',
				action: 'Delete post',
			},
			{
				name: 'Get',
				value: 'get',
				description: 'Retrieve one post and its status',
				action: 'Get post',
			},
			{
				name: 'Get Many',
				value: 'getAll',
				description: 'Retrieve scheduled posts or the post history',
				action: 'Get many posts',
			},
			{
				name: 'Publish Now',
				value: 'publishNow',
				description: 'Publish a post right away to one or more platforms',
				action: 'Publish post now',
			},
			{
				name: 'Schedule',
				value: 'schedule',
				description: 'Queue a post to go out at a set time',
				action: 'Schedule post',
			},
			{
				name: 'Update',
				value: 'update',
				description: 'Change the time, caption or platforms of a scheduled post',
				action: 'Update post',
			},
			{
				name: 'Validate',
				value: 'validate',
				description: 'Check a post for problems without creating it',
				action: 'Validate post',
			},
		],
		default: 'schedule',
	},
];

export const draftOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['draft'] } },
		options: [
			{
				name: 'Approve',
				value: 'approve',
				description: 'Publish or schedule a draft that is waiting',
				action: 'Approve draft',
			},
			{
				name: 'Create',
				value: 'create',
				description: 'Hold a post for approval. Nothing is sent.',
				action: 'Create draft',
			},
			{
				name: 'Get',
				value: 'get',
				description: 'Retrieve a draft and its status',
				action: 'Get draft',
			},
		],
		default: 'create',
	},
];

const idField = (
	resource: 'post' | 'draft',
	operations: string[],
	name: 'postId' | 'draftId',
	displayName: string,
	description: string,
): INodeProperties => ({
	displayName,
	name,
	type: 'string',
	required: true,
	default: '',
	placeholder: 'e.g. abc123',
	description,
	displayOptions: { show: { resource: [resource], operation: operations } },
});

export const postFieldsDescription: INodeProperties[] = [
	idField(
		'post',
		['get', 'update', 'delete'],
		'postId',
		'Post ID',
		'The ID of the post. Use the id from Schedule or Publish Now. A post sent to several platforms has one ID that covers all of them',
	),
	...postFields('publishNow'),
	...postFields('schedule'),
	...postFields('validate'),
	{
		displayName: 'Update Fields',
		name: 'updateFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		description: 'The changes to make. Only posts that have not gone out can change.',
		displayOptions: { show: { resource: ['post'], operation: ['update'] } },
		options: [
			{
				displayName: 'Caption',
				name: 'caption',
				type: 'string',
				typeOptions: { rows: 4 },
				default: '',
				description: 'A new caption for every platform of the post',
			},
			{
				displayName: 'First Comment',
				name: 'firstComment',
				type: 'string',
				default: '',
				description: 'A new first comment, up to 2200 characters. Leave empty to clear it.',
			},
			{
				displayName: 'Platform Captions',
				name: 'platformCaptions',
				type: 'fixedCollection',
				typeOptions: { multipleValues: true },
				placeholder: 'Add Platform Caption',
				default: {},
				description: 'A different caption for single platforms',
				options: [
					{
						displayName: 'Captions',
						name: 'captions',
						values: [
							{
								displayName: 'Platform',
								name: 'platform',
								type: 'options',
								options: PLATFORM_OPTIONS,
								default: 'linkedin',
								description: 'The platform this caption is for',
							},
							{
								displayName: 'Caption',
								name: 'caption',
								type: 'string',
								default: '',
								description: 'The caption for that platform',
							},
						],
					},
				],
			},
			{
				displayName: 'Remove Platforms',
				name: 'removePlatforms',
				type: 'multiOptions',
				options: PLATFORM_OPTIONS,
				default: [],
				description: 'Platforms to drop from the post. Platforms cannot be added to an existing post.',
			},
			{
				displayName: 'Scheduled At',
				name: 'scheduledAt',
				type: 'dateTime',
				default: '',
				description:
					'A new time to publish. Read in your workflow time zone unless the value carries an offset. It must be a few minutes ahead',
			},
			{
				displayName: 'Title',
				name: 'title',
				type: 'string',
				default: '',
				description: 'A new YouTube title, up to 200 characters',
			},
		],
	},
	{
		displayName: 'View',
		name: 'view',
		type: 'options',
		options: [
			{
				name: 'History',
				value: 'history',
				description: 'The latest 100 posts with the result for each platform',
			},
			{
				name: 'Scheduled',
				value: 'scheduled',
				description:
					'Scheduled posts, failures from the last 14 days and posts published in the last 2 days, one row per platform',
			},
		],
		default: 'scheduled',
		description: 'Which list to read',
		displayOptions: { show: { resource: ['post'], operation: ['getAll'] } },
	},
	{
		displayName: 'Return All',
		name: 'returnAll',
		type: 'boolean',
		default: false,
		description: 'Whether to return all results or only up to a given limit',
		displayOptions: { show: { resource: ['post'], operation: ['getAll'] } },
	},
	{
		displayName: 'Limit',
		name: 'limit',
		type: 'number',
		typeOptions: { minValue: 1, maxValue: MAX_PAGE_SIZE },
		default: 50,
		description: 'Max number of results to return',
		displayOptions: { show: { resource: ['post'], operation: ['getAll'], returnAll: [false] } },
	},
	{
		displayName: 'Filters',
		name: 'filters',
		type: 'collection',
		placeholder: 'Add Filter',
		default: {},
		displayOptions: { show: { resource: ['post'], operation: ['getAll'] } },
		options: [
			{
				displayName: 'Profile Name or ID',
				name: 'profileId',
				type: 'options',
				typeOptions: { loadOptionsMethod: 'getProfiles' },
				default: '',
				description: 'Only posts of this profile. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
			},
			{
				displayName: 'Status',
				name: 'status',
				type: 'string',
				default: '',
				placeholder: 'e.g. pending',
				description:
					'Only posts with this status. For the Scheduled view: pending, held, failed or posted. For the History view: pending, partial_success, all_success, all_failed or cancelled',
			},
		],
	},

	// Drafts
	idField(
		'draft',
		['get', 'approve'],
		'draftId',
		'Draft ID',
		'The ID of the draft, from the Draft Create operation. A draft nobody approves expires after 24 hours',
	),
	...postFields('draft'),
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: { resource: ['draft'], operation: ['approve'] } },
		options: [
			{
				displayName: 'Idempotency Key',
				name: 'idempotencyKey',
				type: 'string',
				default: '',
				description: IDEMPOTENCY_DESCRIPTION,
			},
			{
				displayName: 'Scheduled At',
				name: 'scheduledAt',
				type: 'dateTime',
				default: '',
				description: 'A new time for a scheduled draft whose time has passed. Read in your workflow time zone unless the value carries an offset.',
			},
		],
	},
];
