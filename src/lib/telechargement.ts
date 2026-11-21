// Browser-only: called from click handlers, never during render.
export function telecharger(nom: string, contenu: string, type: string) {
  const url = URL.createObjectURL(new Blob([contenu], { type }));
  const lien = document.createElement("a");
  lien.href = url;
  lien.download = nom;
  document.body.appendChild(lien);
  lien.click();
  lien.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function nomFichier(artiste: string, objet: string, extension: string, now: Date) {
  const slug = artiste
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `zikinde_${slug}_${objet}_${now.toISOString().slice(0, 10)}.${extension}`;
}
export const TYPE_JSON = "application/json;charset=utf-8";
export const TYPE_CSV = "text/csv;charset=utf-8";
