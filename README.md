# FastonMed updated app source

CRM contains the updated app interface. mobile contains Android/iOS projects and the phone preview.

Start the app:

```sh
cd CRM
npm ci
npm run dev -- --webpack --hostname 127.0.0.1 --port 8093
```

In a second terminal, start the phone frame:

```sh
cd mobile
npm run preview
```

Open http://127.0.0.1:8092/. App pages run on http://127.0.0.1:8093/.

Local environment credentials and runtime data are excluded. Configure your own environment before using database features. Dependencies and build outputs are excluded.
