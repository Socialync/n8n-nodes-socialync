import type { INodeProperties } from 'n8n-workflow';

const show = { show: { resource: ['media'], operation: ['upload'] } };

export const mediaOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['media'] } },
		options: [
			{
				name: 'Upload',
				value: 'upload',
				description: 'Upload images or one video from binary data or a link and get a media ID',
				action: 'Upload media',
			},
		],
		default: 'upload',
	},
];

export const mediaFields: INodeProperties[] = [
	{
		displayName: 'Source',
		name: 'source',
		type: 'options',
		options: [
			{
				name: 'Binary Data',
				value: 'binaryData',
				description: 'A file from an earlier node, such as a form upload or a file download',
			},
			{
				name: 'URL',
				value: 'url',
				description: 'A public https link that n8n downloads and uploads for you',
			},
		],
		default: 'binaryData',
		description: 'Where the file comes from. A video that is already at a public link can skip this step: put the link in Video URL on a scheduled post instead.',
		displayOptions: show,
	},
	{
		displayName: 'Input Binary Field',
		name: 'binaryPropertyName',
		type: 'string',
		default: 'data',
		required: true,
		placeholder: 'e.g. data',
		description:
			'The name of the binary field that holds the file. For a carousel of up to 10 images, list several names separated by commas. One video per upload',
		displayOptions: { show: { ...show.show, source: ['binaryData'] } },
	},
	{
		displayName: 'Media URL',
		name: 'mediaUrl',
		type: 'string',
		default: '',
		required: true,
		placeholder: 'e.g. https://example.com/image.png',
		description: 'A public https link to one image or one video file',
		displayOptions: { show: { ...show.show, source: ['url'] } },
	},
];
