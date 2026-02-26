# Push each business folder to its own GitHub repo

## 1) Push one folder

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\push-folder-to-repo.ps1 -Folder "bab-industries-hq" -RepoUrl "https://github.com/<USER>/<REPO>.git" -Branch main -ForcePush
```

Use `-ForcePush` if the target repo already has an initial commit (README).

## 2) Push many folders from CSV

1. Copy and edit:

```text
scripts\repo-map.example.csv
```

1. Run:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\push-folders-from-map.ps1 -MapFile ".\scripts\repo-map.example.csv" -ForcePush
```

## Notes

- These scripts push each folder with its own history split from this monorepo.
- Run commands from the repository root.
- Folder names are relative to repo root.
