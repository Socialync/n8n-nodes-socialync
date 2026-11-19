import { NodeApiError, NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';
import type {
	IDataObject,
	IExecuteFunctions,
	ILoadOptionsFunctions,
	INodeExecutionData,
	INodePropertyOptions,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';

import { PLATFORMS } from './constants';
import { runOperation, socialyncRequest } from './GenericFunctions';
import { mediaFields, mediaOperations } from './descriptions/MediaDescription';
import { draftOperations, postFieldsDescription, postOperations } from './descriptions/PostDescription';
import {
	accountOperations,
	analyticsOperations,
	connectionOperations,
	profileOperations,
	readFields,
} from './descriptions/ReadDescription';

export class Socialync implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Socialync',
		name: 'socialync',
		// The mark sits on its own indigo plate, so one file reads on light and dark themes.
		icon: { light: 'file:socialync.svg', dark: 'file:socialync.svg' },
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description:
			'Publish and schedule posts to Facebook, Instagram, LinkedIn, X, Threads, Bluesky, TikTok and YouTube, upload media and read analytics with the Socialync API',
		defaults: { name: 'Socialync' },
		usableAsTool: true,
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [{ name: 'socialyncApi', required: true }],
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Account',
						value: 'account',
						description: 'Your plan, the posts left this month and the daily limits',
					},
					{
						name: 'Analytics',
						value: 'analytics',
						description: 'Views, likes, comments, shares and saves for a profile',
					},
					{
						name: 'Connection',
						value: 'connection',
						description: 'The social accounts connected to a profile',
					},
					{
						name: 'Draft',
						value: 'draft',
						description: 'A post held for approval before anything is sent',
					},
					{
						name: 'Media',
						value: 'media',
						description: 'Images and videos uploaded to Socialync',
					},
					{
						name: 'Post',
						value: 'post',
						description: 'A post that goes out now or at a scheduled time',
					},
					{
						name: 'Profile',
						value: 'profile',
						description: 'A brand or client with its own connected accounts',
					},
				],
				default: 'post',
			},
			...accountOperations,
			...analyticsOperations,
			...connectionOperations,
			...draftOperations,
			...mediaOperations,
			...postOperations,
			...profileOperations,
			...readFields,
			...mediaFields,
			...postFieldsDescription,
		],
	};

	methods = {
		loadOptions: {
			/** Profiles the API key can use, for every Profile dropdown. */
			async getProfiles(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const res = (await socialyncRequest.call(this, 'GET', '/profiles')) as {
					data?: Array<{ id: string; name: string; isDefault?: boolean; connectedPlatformCount?: number }>;
				};
				const options: INodePropertyOptions[] = [
					{
						name: 'Default Profile',
						value: '',
						description: 'The profile Socialync uses when none is chosen',
					},
				];
				for (const profile of res.data ?? []) {
					const count = profile.connectedPlatformCount;
					options.push({
						name: profile.isDefault ? `${profile.name} (Default)` : profile.name,
						value: profile.id,
						description:
							typeof count === 'number' ? `${count} connected ${count === 1 ? 'account' : 'accounts'}` : undefined,
					});
				}
				return options;
			},

			/** Platforms with a connected account on the chosen profile. */
			async getConnectedPlatforms(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const chosen = this.getCurrentNodeParameter('profileId');
				const profileId = typeof chosen === 'string' && chosen && !chosen.startsWith('=') ? chosen : '';
				const res = (await socialyncRequest.call(this, 'GET', '/connections', {
					qs: profileId ? { profileId } : {},
				})) as {
					data?: Array<{
						platform: string;
						profileName?: string;
						status?: string;
						reason?: string;
					}>;
				};
				const names = new Map(PLATFORMS.map((p) => [p.value, p.name]));
				const options: INodePropertyOptions[] = [];
				for (const c of res.data ?? []) {
					const label = names.get(c.platform) ?? c.platform;
					const needsReconnect = c.status === 'needs_reconnect';
					options.push({
						name: needsReconnect ? `${label} (Needs Reconnect)` : label,
						value: c.platform,
						description: needsReconnect
							? c.reason || 'Reconnect this account in Socialync before posting to it'
							: c.profileName
								? `Connected as ${c.profileName}`
								: undefined,
					});
				}
				return options.sort((a, b) => a.name.localeCompare(b.name));
			},
		},
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let i = 0; i < items.length; i++) {
			try {
				const resource = this.getNodeParameter('resource', i) as string;
				const operation = this.getNodeParameter('operation', i) as string;
				const output = await runOperation(this, resource, operation, i);
				const rows = (Array.isArray(output) ? output : [output]) as IDataObject[];
				returnData.push(
					...this.helpers.constructExecutionMetaData(this.helpers.returnJsonArray(rows), {
						itemData: { item: i },
					}),
				);
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({
						json: { error: error instanceof Error ? error.message : String(error) },
						pairedItem: { item: i },
					});
					continue;
				}
				// The request helper and the field readers already raise n8n's own error types
				// with the item index. Anything else gets wrapped so n8n can show it on the item.
				const shown =
					error instanceof NodeApiError || error instanceof NodeOperationError
						? error
						: new NodeOperationError(this.getNode(), error as Error, { itemIndex: i });
				throw shown;
			}
		}
		return [returnData];
	}
}
