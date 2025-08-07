# Chatty Telly Bot

This repository hosts the source code for **Chatty Telly Bot**, a Telegram bot whose codebase is collaboratively managed with [Lovable](https://lovable.dev) and Codex. The project is synchronized in both directions:

- **Lovable ↔ GitHub** – edits made in Lovable are committed back to this repository and GitHub changes are pulled into Lovable.
- **Codex ↔ GitHub** – Codex keeps the repository in sync with your local development environment.
- **Supabase ↔ Bot** – bot content and settings are stored in Supabase tables and referenced from the Telegram bot via edge functions.

## Project info

**Lovable Project URL**: https://lovable.dev/projects/4e724637-b932-47ad-a2c1-d134b3febb47

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/4e724637-b932-47ad-a2c1-d134b3febb47) and start prompting.

Changes made via Lovable will be committed automatically to this repo. Use Lovable for quick prompts or UI‑driven edits.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable and Codex.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## Bot features

- Content, announcements, and settings are stored in Supabase tables so updates can be made without redeploying code.
- Edge functions (e.g., `telegram-bot`) handle callbacks from Telegram and read/write to Supabase.
- Admins can edit or delete bot content directly from Telegram; changes are persisted to the database.

## Branch protection

The `main` branch contains the core, production-ready code and should be protected. Use the `work` branch for day‑to‑day development and merge through pull requests to avoid accidental overwrites.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS
- Supabase (Database & Edge Functions)

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/4e724637-b932-47ad-a2c1-d134b3febb47) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/tips-tricks/custom-domain#step-by-step-guide)
