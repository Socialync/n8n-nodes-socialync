import type {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	Icon,
	INodeProperties,
} from 'n8n-workflow';

import { SOCIALYNC_API_BASE_URL } from '../nodes/Socialync/constants';

export class SocialyncApi implements ICredentialType {
	name = 'socialyncApi';

	displayName = 'Socialync API';

	// The mark sits on its own indigo plate, so one file reads on light and dark themes.
	icon: Icon = {
		light: 'file:../nodes/Socialync/socialync.svg',
		dark: 'file:../nodes/Socialync/socialync.svg',
	};

	documentationUrl = 'https://www.socialync.io/developers/api';

	properties: INodeProperties[] = [
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
			description:
				'Your Socialync API key. Create one on the API Keys page of your Socialync account. It starts with sk_live_ and works for every profile the key is allowed to use.',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				Authorization: '=Bearer {{$credentials.apiKey}}',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: SOCIALYNC_API_BASE_URL,
			url: '/me',
			method: 'GET',
		},
	};
}
