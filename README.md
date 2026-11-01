# Momentum T-Embed — site prêt pour GitHub Pages

Ce dossier contient le site statique, le flasheur USB, les cinq fichiers du firmware Dualboot + IA et le pack SD nettoyé.

## Mise en ligne sans terminal

1. Sur GitHub, crée un nouveau dépôt public (par exemple `momentum-tembed`).
2. Choisis « Add file » puis « Upload files ».
3. Ouvre ce dossier et dépose tout son CONTENU dans GitHub : `index.html`, les fichiers JS/CSS, `.nojekyll`, `assets/`, `firmware/` et ce README. Ne dépose pas seulement l’archive ZIP du site et ne crée pas de dossier supplémentaire autour.
4. Clique sur « Commit changes ».
5. Ouvre « Settings » > « Pages ». Source : « Deploy from a branch ». Branche : `main`. Dossier : `/(root)`. Clique sur « Save ».
6. GitHub affiche le lien après publication : `https://TON-PSEUDO.github.io/NOM-DU-DEPOT/`.

Si `.nojekyll` n’a pas été envoyé, crée un fichier vide de ce nom à la racine du dépôt avec « Add file » > « Create new file ».

Le site fonctionne sans compilation. Le flash USB nécessite Chrome ou Edge sur ordinateur et une connexion HTTPS. Le téléchargement de `sdcard.zip` est proposé après une installation réussie ; sa somme SHA-256 est vérifiée avant d’enregistrer le fichier.

## Pack SD

Le pack conserve les ressources du ZIP fourni, sans le dossier `sdcard` autour ni sa copie imbriquée. Les clés Groq, réglages personnels, données réseau et journaux ont été retirés de la copie distribuée. Le fichier ZIP d’origine est inchangé.

Extrais `firmware/sdcard.zip`, puis copie les dossiers obtenus directement à la racine de la carte microSD. Chaque utilisateur configure sa propre connexion Wi-Fi et sa propre clé Groq.

## Documentation

- GitHub Pages : https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site
- Port Momentum d’origine : https://github.com/Filip1x3/Momentum-Firmware-ESP32-Port
