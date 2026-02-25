

# Replace Favicon ICO File

## What's happening
The `public/favicon.ico` still contains the default Lovable icon. The user has now uploaded their custom `.ico` file (`ajantaico.ico`).

## Fix
1. Copy `user-uploads://ajantaico.ico` → `public/favicon.ico`
2. No HTML changes needed — `index.html` already has `<link rel="icon" type="image/x-icon" href="/favicon.ico" />`

Single file copy. No code changes.

