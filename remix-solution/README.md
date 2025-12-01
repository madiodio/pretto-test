## Instructions d'Installation

### Prérequis

- Node.js 20+
- npm ou pnpm

### Installation

```bash
cd remix-solution
npm install
```

### Configuration

Le projet est pré-configuré avec l'API publique de **WordPress.org News** pour les tests.

Le fichier `.env` contient déjà :

```env
WORDPRESS_API_URL=https://wordpress.org/news/wp-json/wp/v2
```

Pour utiliser une autre API WordPress, modifie cette variable.

### Développement

```bash
npm run dev
```

Le site sera accessible sur `http://localhost:5173`

**URLs de test** :

- Article : `http://localhost:5173/actualites/wordpress-6-9-release-candidate-3`
- Sitemap : `http://localhost:5173/sitemap.xml`
- RSS : `http://localhost:5173/rss.xml`

### Build

```bash
npm run build
npm start
```

### Typecheck

```bash
npm run typecheck
```

## Structure du Code

```
remix-solution/
├── app/
│   ├── routes/
│   │   ├── actualites.$slug.tsx    # Page article avec SEO complet
│   │   ├── sitemap[.]xml.tsx       # Génération sitemap dynamique
│   │   └── rss[.]xml.tsx           # Flux RSS
│   ├── lib/
│   │   ├── wordpress.server.ts     # Client WordPress avec résilience
│   │   ├── seo.ts                  # Utilitaires SEO
│   │   └── types.ts                # Types TypeScript
│   └── root.tsx                    # Layout principal
├── package.json
├── tsconfig.json
└── vite.config.ts
```
