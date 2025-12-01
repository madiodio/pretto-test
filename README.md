# Test Technique Pretto - Senior Software Engineer - Website

> ### Tester la Solution en 30 Secondes
>
> ```bash
> cd remix-solution
> npm install
> npm run dev
> ```
>
> Puis visiter : **http://localhost:5173/actualites/wordpress-6-9-release-candidate-3**. On pourra voir:
>
> - le contenu de l'article (Titre, contenu, date de publication/modification, Catégories, Image featured, Auteur)
>   la gestion du SEO au complet:
>   - **Structured Data (JSON-LD)** : `<script type="application/ld+json">`
>   - **Open Graph** : `<meta property="og:title">`, `og:description`, `og:image`, etc.
>   - **Twitter Cards** : `<meta name="twitter:card">`
>   - **Canonical URL** : `<link rel="canonical">`
>   - **Meta Robots** : `<meta name="robots" content="index, follow">`
> - les autres URLs
>   - **Sitemap** : http://localhost:5173/sitemap.xml (50 articles)
>   - **RSS** : http://localhost:5173/rss.xml (20 derniers articles)
>
> ### Slugs d'Articles Valides
>
> On peut tester avec n'importe quel article de WordPress.org News :
>
> - `wordpress-6-9-release-candidate-3`
> - `wordpress-6-9-release-candidate-2`
> - `wordpress-6-9-beta-2`
> - `wordpress-6-9-beta-1`
>   (Liste complète sur https://wordpress.org/news/)
>
> ### Documentation Complète
>
> - **[README.md](./README.md)** : Vue d'ensemble du projet
> - **[remix-solution/README.md](./remix-solution/README.md)** : Justifications techniques détaillées
> - **[analyse.md](./analyse.md)** : Analyse critique Gatsby
> - **[audit-seo.md](./audit-seo.md)** : Audit SEO
> - **[remix-solution/preview-solution.md](./remix-solution/preview-solution.md)** : Solution preview WordPress

## Structure complète du Projet

```
pretto-test/
├── analyse.md              # Partie 1 : Analyse critique du code Gatsby
├── audit-seo.md            # Partie 3A : Identification des problèmes SEO
├── remix-solution/         # Partie 2 & 3B : Solution Remix complète
│   ├── README.md          # Instructions d'Installation de la solution Remix
│   ├── preview-solution.md # Partie 4 (Bonus) : Solution preview WordPress
│   ├── app/
│   │   ├── lib/           # Utilitaires (WordPress client, SEO, types)
│   │   ├── routes/        # Routes Remix (articles, sitemap, RSS)
│   │   └── root.tsx       # Layout principal
│   ├── package.json
│   ├── tsconfig.json
│   └── vite.config.ts
└── README.md
```

## Choix de Stack : Pourquoi Remix ?

### Adoption incrémentale entre SSG, SSR et client-side

Remix offre une **flexibilité architecturale** que je trouve particulièrement adaptée à un contexte comme Pretto :

- **Mix SSG + SSR** : Contrairement à Gatsby qui force du full-SSG ou Next.js qui pousse vers un modèle all-or-nothing, Remix permet de choisir route par route. Pour un site avec 1500 pages WordPress + des pages dynamiques (simulateurs, dashboards utilisateurs), cette granularité est importante.

- **Data loading au niveau route** : Les `loader` functions permettent de gérer la data au plus proche de là où elle est utilisée. Si demain on veut ajouter des données de taux en temps réel sur certaines pages, on peut le faire sans refactorer toute l'architecture.

- **Pas de GraphQL imposé** : Gatsby force GraphQL même pour des cas simples. Ici, un simple `fetch` vers l'API WordPress suffit. Moins de couches = moins de complexité.

### Pourquoi pas Next.js ?

J'ai délibérément évité Next.js pour plusieurs raisons pragmatiques :

1. **Lock-in Vercel** : Next.js fonctionne ailleurs qu'on Vercel, mais soyons honnêtes, l'expérience optimale (Edge Runtime, ISR, Middleware) est clairement pensée pour leur plateforme. Pour une boîte qui gère 500k visiteurs/mois et qui peut avoir des besoins spécifiques de hosting (compliance, coûts), c'est un risque de dépendance. Vercel reste cher à l'échelle.

2. **Dépendances environnementales "all or nothing"** : L'App Router de Next.js pousse vers un modèle où tu dois adopter leurs conventions en bloc. Si tu veux utiliser certaines features (Server Actions, streaming), tu rentres dans un écosystème où c'est difficile de revenir en arrière ou d'hybrider avec d'autres approches.

3. **Complexité du système de cache** : Le caching dans Next.js 14+ (avec `fetch` automatique, revalidation tags, etc.) est puissant mais parfois opaque. Pour une équipe qui doit maintenir le système sur le long terme, la simplicité de Remix (headers HTTP standards) me semble plus maintenable.

### Forces de Remix pour ce use-case

- **Web Standards** : Remix s'appuie massivement sur les standards HTTP (`Cache-Control`, `stale-while-revalidate`). Pas de magie noire, juste du HTTP bien fait.
- **Progressive Enhancement** : Le site fonctionne même sans JS (bon, avec WordPress HTML, c'est déjà une bonne base).
- **Nested routing** : Pratique pour structurer les layouts (header/footer communs, sidebar par section, etc.).
- **Déployable partout** : Node.js, Deno, Cloudflare Workers, Fly.io... Pas de lock-in.

## Stratégie de Rendering

### Approche hybride : SSG statique + invalidation "douce"

Pour les 1500 articles WordPress :

1. **Build initial** : Génération statique des pages les plus consultées (top 100-200 articles) via `remix-flat-routes` ou scripts de pre-build.

2. **On-demand generation** : Les articles moins fréquents sont générés à la première visite puis mis en cache CDN.

3. **Pas de SSR pur** : Les articles sont servis depuis le cache CDN (Cloudflare, Fastly, etc.) avec une stratégie `stale-while-revalidate` :

   ```
   Cache-Control: public, max-age=300, s-maxage=300, stale-while-revalidate=3600
   ```

   - Les visiteurs reçoivent la version cachée (rapide)
   - En arrière-plan, le cache se revalide si les données ont changé dans WordPress

4. **Invalidation ciblée** : Webhook WordPress → purge CDN du cache de l'article modifié uniquement (pas de rebuild complet).

### Avantages sur Gatsby

- **Pas de rebuild de 15min** : seul l'article modifié est invalidé
- **Preview instantané** : on peut avoir une route `/preview` qui bypass le cache et fetch direct depuis WordPress
- **Résilience** : si WordPress est down, le cache CDN sert la dernière version connue

## Stratégie de Caching

### Couches de cache

```
Visiteur → CDN (Cloudflare) → Remix App → In-Memory Cache → WordPress API
```

1. **CDN Edge Cache** (Cloudflare/Fastly)

   - TTL: 5 minutes
   - Stale-while-revalidate: 1 heure
   - 95% des requêtes sont servies depuis l'edge
   - Coût serveur minimal

2. **In-Memory Cache Applicatif** (`wordpress.server.ts`)

   - TTL: 5 minutes
   - Protège contre les pics de trafic si CDN rate
   - Pattern stale-while-revalidate : si WordPress est down, on sert le cache même périmé
   - En production, remplacer par Redis/Memcached

3. **Fallback sur erreur**
   - Si WordPress timeout ou 500 → on sert le cache (même stale)
   - On log l'erreur mais on ne crash pas le build/runtime
   - Build/déploiement découplé de la disponibilité WordPress

### Invalidation sélective

Via webhook WordPress (plugin à développer) :

```typescript
// POST /api/invalidate
{
  "type": "post",
  "slug": "article-modifie",
  "action": "updated"
}
```

→ Purge uniquement :

- `/actualites/article-modifie`
- `/sitemap.xml` (si nécessaire)
- `/rss.xml` (si dans les 20 derniers articles)

Pas besoin de rebuild des 1500 autres pages.

## SEO Implementation

### Structured Data (JSON-LD)

Implémenté via `app/lib/seo.ts` :

- Type `BlogPosting` (Schema.org)
- Données complètes : auteur, dates (ISO 8601), publisher avec logo
- Injecté dans le `<head>` de chaque article

**Bénéfice** : éligibilité aux rich snippets Google (carousel articles, dates d'actualité, etc.)

### Open Graph & Twitter Cards

Génération automatique pour chaque article :

- `og:title`, `og:description`, `og:image`, `og:url`
- `og:type="article"` avec `article:published_time` et `article:modified_time`
- Twitter Card avec `summary_large_image`

**Bénéfice** : partages sociaux optimisés = trafic referral amélioré

### Canonical URLs

Validation stricte :

- Si le canonical WordPress pointe vers un autre domaine → on le remplace par notre URL
- Format : `https://www.pretto.fr/actualites/${slug}`
- Évite le duplicate content

### Meta Robots

- Par défaut : `index, follow`
- Pages 404 : `noindex, nofollow`
- Facilement extensible pour ajouter des règles (ex: `noindex` sur des brouillons)

### Sitemap & RSS

- **Sitemap dynamique** (`/sitemap.xml`) : généré à la demande, caché 1h
- **Échappement XML correct** : `escapeXML()` pour éviter les bugs avec `&`, `<`, etc.
- **RSS Feed** (`/rss.xml`) : 20 derniers articles, format standard RSS 2.0

## Évolutions Possibles

1. **Redis cache** : remplacer in-memory par cache partagé
2. **Edge rendering** : Cloudflare Workers pour cache ultra-proche
3. **Image optimization** : Cloudinary/Imgix
4. **A/B testing** : edge-side rendering
5. **Multi-régions** : déploiement global (Fly.io)

## Installation et Test

```bash
cd remix-solution
npm install
npm run dev
```

Puis visiter : `http://localhost:5173/actualites/wordpress-6-9-release-candidate-3`

**Le projet est pré-configuré avec l'API publique de WordPress.org News** pour permettre d'effectuer les tests sans accès à l'API Pretto.

Voir [`remix-solution/README.md`](./remix-solution/README.md) pour le guide complet de test.
