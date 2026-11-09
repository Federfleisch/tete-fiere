# Tête Fière : contexte du projet

Ce fichier donne le contexte nécessaire pour travailler sur ce repo. Il ne contient que des faits vérifiés ; ce qui est incertain est listé en fin de fichier.

## Le projet

Site web de **Tête Fière**, marque de **boucles d'oreilles artisanales en résine**, créées à la main. Le domaine est **tetefiere.be**. Pauline dirige la marque, Denis réalise le site.

- Instagram : https://www.instagram.com/tetefiere
- Facebook : https://www.facebook.com/profile.php?id=61594998808551
- Email de contact : savoiapauline.creation@gmail.com
- Premier point de vente : **Rose, Concept Store**, Grand Place 24, Huy (Facebook : https://www.facebook.com/roseconceptstorehuy)
- Localisation indiquée sur la page Facebook : Namur (5000)

## Hébergement et déploiement

- **GitHub Pages**, publié depuis la branche **`main`**, dossier racine. Le fichier `CNAME` contient `tetefiere.be`.
- Tout ce qui est fusionné dans `main` est publié. Passer par une **pull request**, ne pas pousser directement sur `main`.
- Le DNS est géré chez **OVH** : 4 enregistrements A et 4 AAAA vers GitHub Pages sur `@`, un CNAME `www` vers `federfleisch.github.io.`. Ne jamais toucher aux MX, SPF, NS et enregistrements de messagerie OVH.
- Site statique : HTML et CSS écrits à la main, sans framework ni dépendance externe.

## Structure du repo

| Chemin | Rôle |
|---|---|
| `index.html` | Page publique actuelle : « Notre site arrive bientôt. » |
| `apercu-ezx76smzgd/index.html` | **Aperçu privé** de la future page d'accueil, accessible sur `tetefiere.be/apercu-ezx76smzgd/` |
| `assets/` | Logos, fond identitaire |
| `assets/photos/` | Photos produits optimisées (170 à 320 Ko chacune) |
| `CNAME` | Domaine personnalisé GitHub Pages |

### Aperçu privé
- Ce n'est **pas** de la sécurité, seulement un lien difficile à deviner. La page contient `noindex, nofollow, noarchive`.
- Ne jamais mentionner ce dossier dans `robots.txt`, ni le lier depuis la page publique.
- Au lancement : déplacer le contenu à la racine et supprimer le dossier d'aperçu.

## Identité visuelle

- **Logo** `assets/logo.svg` : version normale, bleu nuit `#110F39`, pour fond clair.
- **Logo outlined** `assets/logo-outlined.svg` : avec contour blanc, à utiliser **sur un fond** (image, couleur).
- **Fond identitaire** `assets/main-background.jpg` : 3840x2160, fluide rose et bleu. Il s'affiche en `cover`, **centré**. Le logo outlined se pose au centre, à environ 50 % de la largeur de l'image affichée (voir la maquette `logo-situation.png` dans Dropbox).
- Couleurs utilisées sur la page : bleu nuit `#110F39`, rose `#fde9f2`, bleu clair `#e9f0ff`, crème `#fffaf6`.
- **Typographie : polices système.** La police `Billion Dreams` (Dropbox, `_BASE/03-fonts`) est fournie en version `PERSONAL` : ne pas l'utiliser tant que la licence n'est pas vérifiée pour un usage commercial.

## Ton de voix

Tiré des publications de Pauline sur Facebook et Instagram :
- Première personne (« je », « mes petites créations ») et **vouvoiement** (« je vous partage », « vous pouvez retrouver »).
- Chaleureux, simple, phrases courtes et concrètes.
- Peu d'emojis, toujours les mêmes : 🌸 ✨ 🤍 🥰 📍.
- Valorise le local : « créateurs de chez nous », « Made in Belgium ».
- Exemples de ses formules : « Petites nouveautés bientôt disponibles ! », « La petite touche de couleur pour sublimer vos tenues ».
- Bio Instagram : « Boucles artisanales, créées à la main, avec cœur. Des petites pièces qui font toute la différence ».
- **Baseline retenue : « Créées avec le cœur, portées avec fierté. »**

### Règles d'écriture
- **Ne rien inventer** : pas de prix, de noms de produits, de matières ou d'horaires qui ne viennent pas de Pauline.
- Pas de tiret cadratin (—).
- Écrire « cœur » avec le œ.
- Éviter les formulations typiques d'un texte généré.

## Sources des contenus

Dossier Dropbox : `/Web/03-Perso/Pauline/02_Tête Fière/`

- `_BASE/01-Logo/v2/` : logos SVG et PNG (version courante).
- `_BASE/02-images/main-background.jpg` : **attention**, la version actuelle contient déjà le logo (c'est la composition `logo-situation`). Ne pas l'utiliser telle quelle. Le fond du repo a été recompressé à partir de l'original propre (6000x4000).
- `01-Images/02-Publications/` et `01-Images/01-Packshots/02-Réels/` : vraies photos de produits, issues des publications de Pauline.
- `01-Images/01-Packshots/01-IA/` : images générées par IA. **Ne pas les présenter comme de vrais produits.**
- `04-Réseaux sociaux/00-screenshots/` : captures de Facebook et Instagram, source du ton de voix.
- `_BASE/01-Logo/_trash/` : ne pas toucher, ne pas réutiliser.

**Ne jamais supprimer, déplacer ou modifier de fichiers dans Dropbox** : lecture seule.

## Notes techniques pour une session Claude

- Le téléchargement de fichiers Dropbox passe par des sous-domaines aléatoires de `dropboxusercontent.com` : il faut que `*.dropboxusercontent.com` soit autorisé dans l'environnement réseau.
- Instagram et Facebook affichent un mur de connexion aux visiteurs : on ne peut pas lire les posts directement. Passer par des captures ou des fichiers déposés dans Dropbox.
- Vérifier chaque page en local avec des captures desktop (1440 px) et mobile (390 px), sans défilement horizontal.
- Branche de travail : `claude/sharp-brahmagupta-3fumt6`, recréée à partir de `main` après chaque fusion de PR.

## Décisions prises

- La racine reste sur la page « bientôt » tant que le site n'est pas validé ; le travail se fait dans l'aperçu privé.
- Pas de boutique en ligne dans la première version : présentation, points de vente, contact.
- Photos réelles uniquement, tirées des publications de Pauline.

## À valider ou à décider

- Les textes du site avec Pauline, notamment « en résine » (catégorie de sa page Facebook) et « Made in Belgium » (son post sur Rose).
- L'affichage public de l'adresse email.
- Les droits d'usage de la police `Billion Dreams`.
- Où afficher clairement ce que vend la marque (« boucles d'oreilles artisanales »), maintenant que le hero ne montre que la baseline.
- Boutique en ligne : projet, outil et calendrier à définir.
- Prix, noms de produits, mentions légales : informations à obtenir auprès de Pauline.
