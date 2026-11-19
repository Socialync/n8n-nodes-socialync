# Socialync node workflow templates

Eight importable n8n workflows that use the Socialync community node (`n8n-nodes-socialync`).

> **Status: the Socialync API is open on every plan, free included.** Any API key from your account works with the Socialync node in these workflows.

A separate set of Socialync templates uses Socialync's MCP server through n8n's MCP Client node, and every one of them waits for a person to approve each post. These eight use the REST API with the builder's own key. Where a person wrote or chose the post (a sheet, a table, a database, a form, your own video title), the person who builds the automation has decided to post, so the file schedules without an approval step. Where an AI model writes the post, the file only creates a draft. Nothing is scheduled or published until the account owner approves the draft in Socialync, and a draft nobody approves expires after 24 hours. Each overview note says which of the two the file does.

## The files

| File | Trigger | What it does | Other services |
| --- | --- | --- | --- |
| `ai-video-pipeline-to-drafted-posts.json` | Schedule, daily | An AI model writes a video idea. Your video service renders it. Socialync holds the finished video as a draft until you approve it. | OpenAI, a video service of your choice |
| `google-sheets-content-calendar-to-scheduled-posts.json` | Schedule, hourly | First `Ready` row becomes a scheduled post. The sheet shows the post ID or the reason. | Google Sheets |
| `rss-blog-to-drafted-posts.json` | RSS Feed Trigger, every 30 minutes | New article, AI caption with the link, a draft that waits for your approval. | OpenAI |
| `youtube-upload-announced-everywhere.json` | RSS Feed Trigger on a YouTube channel | HD thumbnail, a caption for each platform, Socialync checks the post, passing platforms are scheduled. | None |
| `evergreen-posts-reposted-weekly.json` | Schedule, Mondays | The evergreen record posted longest ago is scheduled again and its date and count are written back. | Airtable |
| `notion-database-to-scheduled-posts.json` | Schedule, hourly | First page with Status `Ready` becomes a scheduled post and the page is updated. | Notion |
| `weekly-analytics-digest-for-every-brand.json` | Schedule, Mondays | Reads each profile's numbers and sends one Slack message. Read only. | Slack |
| `form-submission-to-scheduled-post.json` | Form Trigger with a login | A web form uploads a picture and schedules a post. | None |

## Rules every file follows

- One yellow overview note with How it works, Setup and Customization, and white section notes, as n8n's template rules ask.
- A `Settings` node holds every value to change. Credentials are empty placeholders (`Socialync account`, `OpenAI account`, and so on). IDs and addresses read `REPLACE_WITH_...`.
- Every call that creates a post or a draft sends an Idempotency Key made from the source (a row number, an article address, a video ID), so a retry of the same call within 24 hours does not post or draft again. Socialync returns the first result, or refuses a changed request that reuses the key. The Sheets and Notion files also set the row or page to Scheduling before they call Socialync, so a failed write back cannot send the same item again on the next run.
- Every file that posts schedules and never publishes straight away, so a person can still cancel in Socialync.
- A file with an AI model in it never schedules or publishes. Content written or made by an AI model must be approved by a person before it is scheduled or published, so the two AI files (`ai-video-pipeline-to-drafted-posts.json` and `rss-blog-to-drafted-posts.json`) use Draft Create with the planned time and have no Draft Approve step. Do not add one. You approve the draft on the MCP Draft Approvals page in Socialync before its planned time. A draft nobody approves expires after 24 hours and nothing is posted. A test checks every file in this folder for this.
- Where a file works through a sheet, a table, a database or a feed, a post or a draft that Socialync refuses is written back to the source or shown in the last node, and the next item still runs. In the AI video pipeline and the form, a refusal stops the run and n8n shows the reason.
- Links to Socialync use the tracked links `socialync.io/go/n8n-node` and `socialync.io/go/n8n-node-keys`.

## What these files do not do

- Nothing here reads results for a single post, because Socialync's API has none yet. The evergreen template picks posts by a checkbox in your table.
- TikTok and YouTube need a video. The files that send video (`ai-video-pipeline`, `google-sheets`, `notion`) allow them. The others leave them out.
- The form answers as soon as it is submitted, so if Socialync refuses the post, the person sees the thank you and the reason shows only in n8n's executions. A form that offers Instagram stops a post with no picture before it reaches Socialync, and that reason also shows only in n8n's executions.
- The two AI files do not tell you that a draft is waiting. Their last node shows the draft ID, the planned time and the expiry time. Add a Slack or email node after it if you want a message.
- A draft whose planned time has passed cannot be approved on the MCP Draft Approvals page. The delay in Settings (720 minutes, which is 12 hours, in both files) is the time you have to approve. Keep it under 24 hours, because a draft expires after that.
- The video service in `ai-video-pipeline-to-drafted-posts.json` is a placeholder. Its two HTTP Request nodes are shaped like most render services, and you change them to match yours.
