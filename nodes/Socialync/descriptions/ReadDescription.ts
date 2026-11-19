import type { INodeProperties } from 'n8n-workflow';

import { PLATFORMS } from '../constants';

export const accountOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['account'] } },
		options: [
			{
				name: 'Get',
				value: 'get',
				description: 'Retrieve your plan, the posts left this month and the daily limits',
				action: 'Get account',
			},
		],
		default: 'get',
	},
];

export const analyticsOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['analytics'] } },
		options: [
			{
				name: 'Get',
				value: 'get',
				description: 'Retrieve views, likes, comments, shares and saves for a profile',
				action: 'Get analytics',
			},
		],
		default: 'get',
	},
];

export const connectionOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['connection'] } },
		options: [
			{
				name: 'Get Many',
				value: 'getAll',
				description: 'Retrieve the social accounts connected to a profile',
				action: 'Get many connections',
			},
		],
		default: 'getAll',
	},
];

export const profileOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['profile'] } },
		options: [
			{
				name: 'Get Many',
				value: 'getAll',
				description: 'Retrieve the profiles your API key can use',
				action: 'Get many profiles',
			},
		],
		default: 'getAll',
	},
];

export const readFields: INodeProperties[] = [
	{
		displayName: 'Profile Name or ID',
		name: 'profileId',
		type: 'options',
		typeOptions: { loadOptionsMethod: 'getProfiles' },
		default: '',
		description: 'The profile to list connections for. Leave on Default Profile to use your default. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
		displayOptions: { show: { resource: ['connection'], operation: ['getAll'] } },
	},
	{
		displayName: 'Period',
		name: 'period',
		type: 'options',
		options: [
			{ name: 'Last 30 Days', value: 'month', description: '30 days, compared with the 30 days before' },
			{ name: 'Last 7 Days', value: 'week', description: '7 days, compared with the 7 days before' },
		],
		default: 'week',
		description:
			'The window to read. The numbers count what was gained inside the window, with the change against the window before it. Use Days under Options for another length',
		displayOptions: { show: { resource: ['analytics'], operation: ['get'] } },
	},
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: { show: { resource: ['analytics'], operation: ['get'] } },
		options: [
			{
				displayName: 'Breakdown',
				name: 'breakdown',
				type: 'options',
				options: [
					{ name: 'By Platform', value: 'by_platform', description: 'Totals plus numbers for each connected platform' },
					{ name: 'Total', value: 'total', description: 'One set of numbers across platforms' },
				],
				default: 'total',
				description: 'Whether to add numbers for each platform. YouTube appears only in the By Platform view, as YouTube reports it.',
			},
			{
				displayName: 'Days',
				name: 'days',
				type: 'number',
				typeOptions: { minValue: 1, maxValue: 365 },
				default: 7,
				description: 'A window of this many days, from 1 to 365. It replaces Period.',
			},
			{
				displayName: 'Include Daily Numbers',
				name: 'includeTimeseries',
				type: 'boolean',
				default: false,
				description: 'Whether to add a daily snapshot for each platform. Each value is a running total as of that day, so subtract one day from the next to get a gain.',
			},
			{
				displayName: 'Platform',
				name: 'platform',
				type: 'options',
				options: [{ name: 'All', value: 'all' }, ...PLATFORMS.map((p) => ({ name: p.name, value: p.value }))],
				default: 'all',
				description: 'Read one platform or all of them',
			},
			{
				displayName: 'Profile Name or ID',
				name: 'profileId',
				type: 'options',
				typeOptions: { loadOptionsMethod: 'getProfiles' },
				default: '',
				description: 'The profile to read. Leave on Default Profile to use your default. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
			},
		],
	},
];
