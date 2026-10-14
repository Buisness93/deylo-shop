"""Importe les montres telechargees sur Sketchfab dans la vitrine.

Usage :  python -I tools/importer.py [dossier_des_zips]   (par defaut : ~/Downloads)

Pour chaque montre du catalogue sans fichier, cherche le zip correspondant
(nom Sketchfab), verifie son contenu, l'extrait sans risque dans models/<id>/,
puis compresse la geometrie en un seul scene.glb (meshopt, via gltf-transform).
"""
import json, os, shutil, subprocess, sys, zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else os.path.expanduser('~/Downloads'))
ALLOWED = ('.gltf', '.bin', '.png', '.jpg', '.jpeg', '.webp', '.ktx2', '.txt')

# nom du zip tel que Sketchfab le propose, par identifiant du catalogue
ZIPS = {
    'rolex-daydate': 'rolex_datejust.zip',
    'ap-royaloak-tourbillon': 'audemars_piguet_royal_oak_tourbillon.zip',
    'rm011': 'richard_mille_rm011_low_poly.zip',
    'patek-calatrava': 'patek_philippe.zip',
    'omega-seamaster300': 'omega_seamaster_300_watch.zip',
    'omega-speedmaster': 'omega_speedmaster_moon_watch.zip',
    'omega-deville': 'omega_de_ville_prestige.zip',
    'hublot-bigbang': 'hublot_watch.zip',
}


def extract(zip_path, out):
    with zipfile.ZipFile(zip_path) as z:
        for info in z.infolist():
            target = os.path.abspath(os.path.join(out, info.filename))
            if not target.startswith(out + os.sep) and target != out:
                raise ValueError('chemin suspect dans l\'archive : ' + info.filename)
            if not info.is_dir() and not info.filename.lower().endswith(ALLOWED):
                raise ValueError('fichier inattendu dans l\'archive : ' + info.filename)
        z.extractall(out)


def main():
    catalog = json.load(open(os.path.join(ROOT, 'models', 'catalog.json'), encoding='utf-8'))
    done = 0
    for w in catalog['watches']:
        glb = os.path.join(ROOT, w['path'])
        if os.path.exists(glb):
            continue
        zip_path = os.path.join(SRC, ZIPS.get(w['id'], ''))
        if not os.path.isfile(zip_path):
            print('-', w['brand'], w['model'], ': zip introuvable (' + ZIPS.get(w['id'], '?') + ')')
            continue
        out = os.path.dirname(glb)
        os.makedirs(out, exist_ok=True)
        extract(zip_path, out)
        gltf = os.path.join(out, 'scene.gltf')
        subprocess.run('npx -y @gltf-transform/cli@4.1.1 optimize "' + gltf + '" "' + glb + '" --compress meshopt --texture-compress false',
                       shell=True, check=True)
        for leftover in ('scene.gltf', 'scene.bin'):
            p = os.path.join(out, leftover)
            if os.path.exists(p):
                os.remove(p)
        shutil.rmtree(os.path.join(out, 'textures'), ignore_errors=True)
        print('+', w['brand'], w['model'], ':', round(os.path.getsize(glb) / 1e6, 1), 'Mo')
        done += 1
    print(done, 'montre(s) importee(s).')


if __name__ == '__main__':
    main()
