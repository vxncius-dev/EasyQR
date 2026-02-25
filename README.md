# EaseQR

EaseQR generates QR codes for text/links and uploads files to `tmpfiles.org`.

<img width="1920" height="1080" alt="image" src="https://github.com/user-attachments/assets/df70d065-50d2-431c-9646-834d7a4e9e94" />

## File flow

1. Select or drag a file (up to 10MB).
2. App sends `POST https://tmpfiles.org/api/v1/upload`.
3. API returns a public URL.
4. QR is generated using that returned URL.

## Notes

- Files on `tmpfiles.org` are temporary (according to their API docs).
- Use the app from a local server (`http://localhost`) when possible.

## Stack

- ZXing
- Vanilla JavaScript
