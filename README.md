# LinkedIn Viewed Job Dimmer

Chrome extension that dims viewed jobs in the LinkedIn jobs search list instead of removing them.

## What it does

- Detects job cards in `li[data-occludable-job-id]`
- Detects cards whose footer state says `Viewed`
- Keeps watching the page so newly loaded viewed jobs stay dimmed too
- Offers a popup switch for `Always run` or `Only when selected`
- Adds a small on-page button plus a popup switch and button for manual runs

## Install

1. Open `chrome://extensions`
2. Enable `Developer mode`
3. Click `Load unpacked`
4. Select this folder

## Use

- Open a LinkedIn jobs search page
- Click the extension icon
- Use the switch if you want `Always run`
- Press `Dim viewed jobs`
