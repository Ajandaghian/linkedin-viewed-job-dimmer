# LinkedIn Viewed Job Dimmer

## Short Description
Dim viewed LinkedIn job cards in place and highlight saved keyword groups in the main JD.

## Long Description
LinkedIn Viewed Job Dimmer keeps your LinkedIn jobs search cleaner by dimming cards you have already viewed instead of removing them from the list, while also highlighting saved keyword groups in the main job description.

Use `Always run` for automatic dimming on every LinkedIn jobs page, or leave it on `Only when selected` and trigger it manually when you want to clean up the list. Add one or more keyword groups in the popup, then pick a preset color for each group to highlight matches in the JD.

What it does:

- Detects viewed job cards in LinkedIn job search results
- Keeps viewed cards visible, but mutes them to a dark gray disabled style
- Highlights saved keyword groups in the main job description with preset colors
- Lets you edit multiple keyword sets directly in the popup
- Watches for newly loaded results and dims them automatically when enabled
- Saves your chosen mode and keyword groups in the extension so it survives popup closes and tab changes
- Runs locally in your browser

## Suggested Store Keywords
LinkedIn jobs, job search, productivity, recruiting, job board, browser extension, viewed jobs, candidate search, workflow, cleanup

## Suggested Category
Productivity

## Listing Assets

- Icon: `assets/icons/icon-128.png`
- Screenshot 1: `assets/store/linkedin-viewed-job-dimmer-promo-1.png`
- Screenshot 2: `assets/store/linkedin-viewed-job-dimmer-promo-2.png`

## Screenshot Captions

1. `Viewed jobs dimmed in the results list`
2. `Always run or manual mode from the popup`

## Permissions Justification

- `activeTab`: lets the extension act on the current LinkedIn jobs tab when you click the popup button
- `scripting`: injects the content script into the active tab when needed
- `tabs`: reads the active tab so the popup knows whether LinkedIn is open
- `storage`: saves the run mode locally so it persists between sessions

## Privacy Summary

LinkedIn Viewed Job Dimmer does not send LinkedIn data to a server. The extension works locally in your browser and stores only the selected run mode and keyword groups.
