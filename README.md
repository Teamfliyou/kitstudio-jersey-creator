# KitStudio – Créateur de maillots

Web app (HTML/CSS/JS, sans build) pour créer des maillots de sport et les voir en 3D.

## Fonctionnalités
- **Rendu 3D** (Three.js) : maillot, short et chaussettes en volume, rotation libre, vues Face / 3/4 / Dos / Profil, rotation automatique.
- Plan 2D : face + dos, face, dos, tenue complète.
- Motifs, couleurs, encolure, manches, épaulettes, flocage nom/numéro, écusson.
- **Sponsors** sur 6 emplacements (poitrine, dos, manches, équipementier, short).
- **Bibliothèque de logos** : import de fichiers, de **dossiers entiers** ou glisser-déposer (SVG, PNG, JPG, WebP), recherche, stockage local (IndexedDB).
- Annuler / rétablir (Ctrl+Z / Ctrl+Y), galerie locale, lien de partage.
- Export PNG (1× / 2× / 3×, fond transparent ou uni), SVG vectoriel, rendu 3D en PNG.

## Lancer
Ouvrir `index.html`, ou servir le dossier :

```bash
python -m http.server 8137
```

puis http://localhost:8137.

Three.js (r147, licence MIT) est embarqué dans `vendor/` : aucune connexion n'est nécessaire.

## Structure
- `js/data.js` : données (motifs, polices, préréglages, état par défaut)
- `js/render.js` : rendu SVG 2D (maillot, short, chaussettes, sponsors)
- `js/view3d.js` : moteur 3D (géométrie gonflée à partir des silhouettes + textures SVG)
- `js/library.js` : bibliothèque de logos
- `js/app.js`, `css/app.css` : interface
