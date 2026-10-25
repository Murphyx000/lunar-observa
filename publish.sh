#!/usr/bin/env bash
# Creates a public repository only when no origin exists, then enables Pages.
set -euo pipefail
cd -- "$(dirname -- "${BASH_SOURCE[0]}")"
command -v gh >/dev/null || { echo 'Instala GitHub CLI (gh) para publicar.' >&2; exit 1; }
account=$(gh api user --jq .login)
account_id=$(gh api user --jq .id)
repo="$account/lunar-observa"
if [[ ! -d .git ]]; then git init -b main; fi
if git remote get-url origin >/dev/null 2>&1; then
  origin=$(git remote get-url origin)
  if [[ "$origin" != "https://github.com/$repo.git" && "$origin" != "https://github.com/$repo" && "$origin" != "git@github.com:$repo.git" ]]; then
    echo "El remoto origin no corresponde a $repo. Revisa el repositorio antes de publicar." >&2; exit 1
  fi
else
  # gh fails safely if a repository with this name already exists.
  gh repo create "$repo" --public --description 'Luma: contorno editable y observación visual de lunares. Prototipo no diagnóstico con procesamiento local.' --source=. --remote=origin
fi
git add index.html app.js engine.js style.css icon.svg package.json README.md .gitignore .github/workflows/pages.yml tests/engine-tests.js tests/run.mjs tests/run_engine.py tests/browser_check.py publish.sh
if ! git diff --cached --quiet; then
  git -c user.name="$account" -c user.email="$account_id+$account@users.noreply.github.com" commit -m 'Build local mole observation tool with editable contour and descriptive measurements'
fi
if gh api "repos/$repo/pages" >/dev/null 2>&1; then
  gh api --method PUT "repos/$repo/pages" -f build_type=workflow >/dev/null
else
  gh api --method POST "repos/$repo/pages" -f build_type=workflow >/dev/null
fi
previous_head=$(git rev-parse --verify refs/remotes/origin/main 2>/dev/null || true)
current_head=$(git rev-parse HEAD)
git -c credential.helper= -c 'credential.helper=!gh auth git-credential' push -u origin main
# A changed push triggers Actions; retries of unchanged source need dispatch.
if [[ "$previous_head" == "$current_head" ]]; then
  gh workflow run pages.yml --repo "$repo" --ref main
fi
printf '\nPublicación solicitada. Consulta el resultado de GitHub Actions:\n'
gh run list --repo "$repo" --workflow pages.yml --limit 1
printf '\nURL prevista (disponible cuando termine el despliegue): https://%s.github.io/lunar-observa/\n' "$account"
