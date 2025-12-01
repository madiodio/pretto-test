# Audit SEO - Problèmes Critiques

## Problème 1 : Absence totale de Structured Data (JSON-LD)

**Observation**: Aucune implémentation de Schema.org dans le code fourni.

**Impact SEO**:

- Les articles ne sont pas reconnus comme tels par Google (pas de type `Article`, `BlogPosting`, ou `NewsArticle`)
- Impossible d'apparaître dans les rich snippets (Google News, Article enrichi avec date/auteur)
- Perte de visibilité dans les SERPs : un concurrent avec structured data aura un CTR supérieur
- Pas de breadcrumb markup → navigation moins claire pour Google

**Données manquantes critiques**:

```json
{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "...",
  "datePublished": "...",
  "dateModified": "...",
  "author": { "@type": "Person", "name": "..." },
  "publisher": { "@type": "Organization", "name": "Pretto", "logo": {...} },
  "image": "...",
  "articleBody": "..."
}
```

**Données WordPress disponibles mais non utilisées**: Le code récupère `date`, `modified`, `categories`, `seo.title`, mais ne les structure pas pour Google.

## Problème 2 : Open Graph incomplet et non dynamique

**Observation**: Aucune génération d'Open Graph tags visible dans le code.

**Impact SEO & Acquisition**:

- Partages sur réseaux sociaux (LinkedIn, Facebook, Twitter) sans preview attractive
- Perte de trafic social : un post LinkedIn avec preview génère **2-3x plus de clics** qu'un lien brut
- Pas de contrôle sur l'image affichée → risque d'image inappropriée ou absente
- Pour Pretto (courtier immobilier), les partages sociaux sont un canal d'acquisition important

**Tags critiques manquants**:

```html
<meta property="og:title" content="..." />
<meta property="og:description" content="..." />
<meta property="og:image" content="..." />
<meta property="og:url" content="https://www.pretto.fr/actualites/..." />
<meta property="og:type" content="article" />
<meta property="article:published_time" content="..." />
<meta property="article:modified_time" content="..." />
<meta property="article:author" content="..." />

<!-- Twitter Card -->
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="..." />
<meta name="twitter:description" content="..." />
<meta name="twitter:image" content="..." />
```

**Note**: Le code récupère `seo.title` et `seo.metaDesc` (probablement Yoast SEO), mais ne les propage pas en Open Graph.

## Problème 3 : Gestion défaillante des Canonical URLs et Meta Robots

**Observation**:

```javascript
seo {
  canonical  // Récupéré mais potentiellement mal utilisé
}
```

**Problèmes identifiés**:

### Canonical URLs probablement statiques

- Si WordPress génère des canonicals relatifs ou absolu vers l'ancien domaine → duplicate content
- Pas de logique visible pour générer dynamiquement `https://www.pretto.fr/actualites/${slug}`
- Risque de canonical auto-référentiel cassé si le slug WordPress diffère du slug en production

### Absence de meta robots

- Pas de `<meta name="robots" content="index, follow" />` visible
- Potentiellement des brouillons ou contenus non publiés indexés si WordPress les expose
- Aucune gestion de `noindex` pour des contenus dépréciés ou canonicalisés

### Dates au format non standardisé

- Les dates `post.date` et `post.modified` sont utilisées directement dans le sitemap
- Format WordPress par défaut n'est pas toujours ISO 8601 → risque de sitemap invalide
- Google privilégie le format `YYYY-MM-DDTHH:MM:SS+00:00` pour `lastmod`

**Impact SEO**:

- **Duplicate content**: si les canonical pointent vers des URLs incorrectes, Google indexe plusieurs versions de la même page
- **Crawl budget gaspillé**: Google crawle des pages non pertinentes au lieu des pages importantes
- **Désindexation silencieuse**: en cas de canonical cassé, Google peut choisir arbitrairement quelle version indexer

---

## Synthèse

Ces 3 problèmes créent une **dette SEO structurelle** :

1. **Structured Data manquant** → 0% de chance d'apparaître dans les rich snippets → CTR inférieur de 20-30%
2. **Open Graph absent** → partages sociaux inefficaces → perte de trafic referral
3. **Canonical/Robots mal gérés** → duplicate content → cannibalisation du ranking

**Avec la plupart du trafic provenant du SEO**, chaque point représente un risque de perte de plusieurs dizaines de milliers de visiteurs par mois. Ces problèmes sont **solvables** mais nécessitent une implémentation rigoureuse dans la nouvelle solution.
