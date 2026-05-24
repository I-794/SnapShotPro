# Deploy to Vercel

Vercel detects Vite automatically. There's no config needed beyond what's in `vite.config.js`.

## Prerequisites

```bash
npm install
npm run dev       # works locally at http://localhost:5173
npm run build     # produces dist/ — what gets deployed
```

If `npm run build` fails, fix that first. Vercel will hit the exact same error.

## Option A: GitHub + Vercel (recommended)

This gives you auto-deploy on every push, preview URLs for branches, the works.

1. **Create a GitHub repo and push.**
   ```bash
   git init
   git add .
   git commit -m "Initial Vite scaffold"
   git branch -M main
   git remote add origin https://github.com/YOUR-USERNAME/snapshot-pro.git
   git push -u origin main
   ```

2. **Go to https://vercel.com/new.**

3. **Import the GitHub repo.** Click "Add New..." → "Project" → select the repo.

4. **Confirm settings.** Vercel detects Vite and fills these in:
   - Framework Preset: **Vite**
   - Build Command: **`npm run build`**
   - Output Directory: **`dist`**
   - Install Command: **`npm install`**

   Don't change them.

5. **Click Deploy.** First build takes 30–60 seconds. You get a URL like `snapshot-pro-yourname.vercel.app`.

6. **Done.** Every `git push` to `main` triggers a production deploy. Every push to a non-`main` branch gets its own preview URL.

## Option B: Vercel CLI (no GitHub needed)

```bash
npm install -g vercel
vercel login          # one-time
vercel                # first run: answers wizard, links project
vercel --prod         # push to production
```

The wizard asks:
- Set up and deploy? **Y**
- Which scope? Pick your account
- Link to existing project? **N**
- Project name? `snapshot-pro` (or whatever)
- Code directory? `./` (default)
- Modify settings? **N** (Vite is auto-detected)

After the first deploy, `vercel` alone makes a preview build, `vercel --prod` makes a production build.

## Custom domain (optional)

In the Vercel project dashboard → Settings → Domains → add your domain. Vercel walks you through the DNS records.

## Common issues

- **"Build failed — Cannot find module"**: A file imports something that doesn't exist yet. Check the build log for the missing path and either create the file or comment out the import.
- **"Output Directory `dist` not found"**: `npm run build` didn't finish. Run it locally and read the error.
- **Blank page after deploy, console says 404 on `/src/main.js`**: You opened `index.html` directly instead of going through `npm run dev` or the deployed URL. Vite needs to serve the file for module resolution to work; the production build will inline a hashed bundle URL automatically.
- **Assets 404 in production but work locally**: Make sure all paths in `index.html` start with `/` (e.g. `/src/styles.css`) not `./`. Vite handles the rewrite during build only for absolute paths.

## What you'll get

Production builds are fast (under a second for a project this size), the CDN is global, and the free tier is generous enough that this'll never cost you anything. Preview URLs are great for showing FRC teammates ("hey, try this version") without affecting the main site.
