# n8n-nodes-socialync

This is an n8n community node for [Socialync](https://socialync.io/go/n8n-node). It lets a workflow publish and schedule posts to Facebook, Instagram, LinkedIn, X, Threads, Bluesky, TikTok and YouTube, upload images and video, and read analytics, through the Socialync REST API.

> **Status: the Socialync API is open on every plan, free included.** Any API key from your account works with this node.

[n8n](https://n8n.io/) is a [fair-code licensed](https://docs.n8n.io/n8n-community-license) workflow automation platform.

[Installation](#installation) · [Credentials](#credentials) · [Operations](#operations) · [Examples](#examples) · [Limits](#limits-and-things-worth-knowing) · [Templates](#workflow-templates) · [Compatibility](#compatibility)

## Installation

Follow the [community node installation guide](https://docs.n8n.io/integrations/community-nodes/installation-and-management) and install `n8n-nodes-socialync`.

## Credentials

1. Create an API key on the [API Keys page](https://socialync.io/go/n8n-node-keys) of your Socialync account. It starts with `sk_live_`.
2. In n8n, add a **Socialync API** credential and paste the key.
3. Save. n8n tests the key with `GET /v1/me`.

The key can use the profiles you gave it. Use the Profile resource to list them.

## Operations

Every field has a description in n8n, so the AI builder and the Tools Agent can read it too. The node works as an AI tool.

| Resource | Operation | What it does |
| --- | --- | --- |
| Post | Publish Now | Publishes right away to Facebook, Instagram, LinkedIn, X, Threads and Bluesky. Text and up to 10 images. |
| Post | Schedule | Queues a post for a set time. This is also how TikTok, YouTube and video go out. |
| Post | Validate | Runs the checks a publish runs and creates nothing. |
| Post | Get, Get Many | Reads one post, or the scheduled list and the history. Get Many can return everything. |
| Post | Update | Changes the time, caption, YouTube title or first comment of a scheduled post, or drops platforms. |
| Post | Delete | Cancels a scheduled post that has not gone out. |
| Draft | Create, Get, Approve | Holds a post for a person to approve, reads it, publishes or schedules it. |
| Media | Upload | Uploads images or one video from binary data or a link, and returns a media ID. |
| Connection | Get Many | Lists the accounts connected to a profile. |
| Profile | Get Many | Lists the profiles the key can use. |
| Account | Get | Reads your plan, the posts left this month and the daily limits. |
| Analytics | Get | Views, likes, comments, shares and saves gained in a window, with the change from the window before. |

The Profile and Platforms dropdowns load from your account. Platforms shows the accounts connected to the chosen profile and marks the ones that need a reconnect.

## Examples

**Schedule a post with a video from a link.** Add the Socialync node, choose Post, then Schedule. Pick the platforms, write the caption, set Scheduled At, set Media to Video URL and paste the link. Socialync copies the video into its own storage when the call is made.

**Post a picture a person uploaded.** Add a Form Trigger with a file field. Add the Socialync node with Media, Upload and the name of the binary field. Then add a second Socialync node with Post, Schedule, Media set to Uploaded Media and the media ID from the first node.

**Stop a retry from posting twice.** Open Additional Fields on Publish Now, Schedule, Draft Create or Draft Approve and set Idempotency Key to something that is the same every time the same post is sent, such as a spreadsheet row number. If n8n repeats the same call within 24 hours, Socialync returns the first result. A changed request that reuses the key is refused.

## Limits and things worth knowing

- Requests are limited to 60 a minute for each key. When a 429 answer comes back, the error tells you to wait a few seconds and run the node again.
- A post that goes out now reaches Facebook, Instagram, LinkedIn, X, Threads and Bluesky, with text and up to 10 images. TikTok, YouTube, video, titles and Instagram trial reels need Schedule.
- Scheduled times need to be a few minutes ahead and inside your plan's scheduling window. A time with no offset is read in the workflow time zone.
- Your plan's monthly allowance, the daily post cap for each profile and each platform's own rules apply, as in the app.
- If your Socialync settings ask for confirmation before posts go out, Publish Now and Draft Approve are refused with `direct_publish_disabled`. The API cannot show that dialog. Draft Create still works.
- Browsers cannot call the API. Keep the key in an n8n credential.
- TikTok needs a privacy level that you choose. YouTube needs a title.
- Publish Now, Schedule, Draft Create and Draft Approve send whatever you set without asking a person. Use Draft Create when someone should approve first.

## Workflow templates

Eight importable workflows that use this node are in the [templates folder](./templates): an AI video pipeline, a Google Sheets content calendar, blog posts from RSS, YouTube uploads announced everywhere, evergreen posts reposted every week, a Notion database, a weekly analytics digest for every brand, and a web form that schedules posts. The two with an AI model in them (the AI video pipeline and blog posts from RSS) hold each post as a draft that you approve in Socialync. Each has setup notes inside the workflow. Read [templates/README.md](./templates/README.md) before you import them.

## Compatibility

Written against the n8n community node API version 1 and `n8n-workflow` 2.x. It has no run time dependencies. The Socialync API reference is [here](https://socialync.io/go/n8n-node).

## Support

Write to support@socialync.io.

## License

[MIT](./LICENSE.md)
