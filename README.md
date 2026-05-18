# JobShade

![JobShade promo](assets/store/jobshade-promo-1.png)

JobShade dims viewed LinkedIn job cards in place instead of removing them.

## What it does

- Detects job cards in `li[data-occludable-job-id]`
- Finds cards whose footer state says `Viewed`
- Keeps the cards visible, but mutes them into a dark gray disabled style
- Watches the page so newly loaded viewed jobs stay dimmed
- Supports `Always run` and `Only when selected`
- Saves your mode locally so it survives popup closes and page reloads

## Screenshots

![JobShade popup](assets/store/jobshade-promo-2.png)

## Install

1. Open `chrome://extensions`
2. Enable `Developer mode`
3. Click `Load unpacked`
4. Select this folder
5. Reload the LinkedIn jobs tab after installing

## Use

- Open a live LinkedIn jobs search page
- Click the JobShade extension icon
- Choose `Always run` if you want automatic dimming
- Otherwise leave `Only when selected` on and click `Dim viewed jobs` when needed

## Publishing Kit

- Store listing copy: [`docs/chrome-web-store-listing.md`](docs/chrome-web-store-listing.md)
- Privacy policy: [`docs/privacy-policy.md`](docs/privacy-policy.md)
- Icon: [`assets/icons/icon-128.png`](assets/icons/icon-128.png)
- Promo image 1: [`assets/store/jobshade-promo-1.png`](assets/store/jobshade-promo-1.png)
- Promo image 2: [`assets/store/jobshade-promo-2.png`](assets/store/jobshade-promo-2.png)

## Notes

- The extension runs on live LinkedIn jobs pages, not on saved HTML snapshots opened from disk
- If LinkedIn opens as `linkedin.com` instead of `www.linkedin.com`, the extension still matches it
- The extension stores only the run mode locally in Chrome extension storage
