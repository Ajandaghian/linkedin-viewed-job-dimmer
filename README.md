# LinkedIn Viewed Job Remover

Chrome extension that removes viewed jobs from the LinkedIn jobs search list.

## What it does

- Detects job cards in `li[data-occludable-job-id]`
- Removes cards whose footer state says `Viewed`
- Keeps watching the page so newly loaded viewed jobs are removed too
- Adds a small on-page button plus a popup button for manual runs

## Install

1. Open `chrome://extensions`
2. Enable `Developer mode`
3. Click `Load unpacked`
4. Select this folder

## Use

- Open a LinkedIn jobs search page
- Click the extension icon
- Press `Remove viewed jobs`

