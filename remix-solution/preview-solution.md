# Solution Preview WordPress

## Objectif

Permettre aux éditeurs de prévisualiser leurs articles WordPress **instantanément** (sans attendre 15min de build), tout en conservant la même apparence que sur le site de production.

## Architecture

### Flux utilisateur

```
Éditeur WordPress → Clic "Aperçu" → Remix Preview Route → Affichage temps réel
```

### Composants nécessaires

1. **Plugin WordPress** : génère l'URL de preview avec token sécurisé
2. **Route Remix `/preview`** : bypass le cache et fetch direct depuis WordPress
3. **Authentification** : validation du token pour éviter les abus

## Implémentation

### 1. Plugin WordPress (PHP)

```php
<?php
/**
 * Plugin Name: Pretto Preview Integration
 * Description: Génère des URLs de preview sécurisées pour Remix
 */

add_filter('preview_post_link', 'pretto_preview_link', 10, 2);

function pretto_preview_link($preview_link, $post) {
    if ($post->post_type !== 'post') {
        return $preview_link;
    }

    // Générer un token JWT signé (valide 1h)
    $secret = get_option('pretto_preview_secret');
    $payload = [
        'post_id' => $post->ID,
        'exp' => time() + 3600, // Expire dans 1h
    ];

    $token = generate_jwt($payload, $secret);

    // URL vers Remix
    $remix_url = get_option('pretto_remix_url', 'https://www.pretto.fr');
    return $remix_url . '/preview?token=' . $token . '&post_id=' . $post->ID;
}

function generate_jwt($payload, $secret) {
    $header = json_encode(['typ' => 'JWT', 'alg' => 'HS256']);
    $payload = json_encode($payload);

    $base64UrlHeader = str_replace(['+', '/', '='], ['-', '_', ''], base64_encode($header));
    $base64UrlPayload = str_replace(['+', '/', '='], ['-', '_', ''], base64_encode($payload));

    $signature = hash_hmac('sha256', $base64UrlHeader . "." . $base64UrlPayload, $secret, true);
    $base64UrlSignature = str_replace(['+', '/', '='], ['-', '_', ''], base64_encode($signature));

    return $base64UrlHeader . "." . $base64UrlPayload . "." . $base64UrlSignature;
}

...
```

### 2. Route Remix Preview

```typescript
// app/routes/preview.tsx
import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { fetchWordPressPostById } from "~/lib/wordpress.server";
import { generateArticleSEO } from "~/lib/seo";
import { verifyPreviewToken } from "~/lib/preview.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  const postId = url.searchParams.get("post_id");

  if (!token || !postId) {
    throw new Response("Missing token or post_id", { status: 400 });
  }

  // Verify JWT token
  const payload = verifyPreviewToken(token);
  if (!payload || payload.post_id !== postId) {
    throw new Response("Invalid or expired token", { status: 403 });
  }

  // Fetch directly from WordPress (bypass cache)
  const post = await fetchWordPressPostById(postId, { bypassCache: true });

  if (!post) {
    throw new Response("Post not found", { status: 404 });
  }

  const seoMetadata = generateArticleSEO(post);

  return json(
    { post, seoMetadata, isPreview: true },
    {
      headers: {
        // NO caching for preview
        "Cache-Control": "private, no-cache, no-store, must-revalidate",
        // Banner pour indiquer que c'est un preview
        "X-Pretto-Preview": "true",
      },
    }
  );
};

export default function PreviewPage() {
  const { post, seoMetadata, isPreview } = useLoaderData<typeof loader>();

  return (
    <>
      {/* Banner de preview */}
      {isPreview && (
        <div
          style={{
            position: "sticky",
            top: 0,
            background: "orange",
            color: "white",
            padding: "12px",
            textAlign: "center",
            fontWeight: "bold",
            zIndex: 9999,
          }}
        >
          MODE APERÇU - Cette page n'est pas publiée
        </div>
      )}

      {/* Même contenu que actualites.$slug.tsx */}
      <article>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(seoMetadata.structuredData),
          }}
        />

        <header>
          <h1>{post.title}</h1>
          {/* ... reste identique ... */}
        </header>

        <div dangerouslySetInnerHTML={{ __html: post.content }} />
      </article>
    </>
  );
}
```

### 3. Utilitaire de vérification JWT

```typescript
// app/lib/preview.server.ts
import { createHmac } from "crypto";

const PREVIEW_SECRET = process.env.PREVIEW_SECRET || "change-me-in-production";

interface PreviewPayload {
  post_id: string;
  exp: number;
}

export function verifyPreviewToken(token: string): PreviewPayload | null {
  try {
    const [headerB64, payloadB64, signatureB64] = token.split(".");

    if (!headerB64 || !payloadB64 || !signatureB64) {
      return null;
    }

    // Verify signature
    const expectedSignature = createHmac("sha256", PREVIEW_SECRET)
      .update(`${headerB64}.${payloadB64}`)
      .digest("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=/g, "");

    if (signatureB64 !== expectedSignature) {
      console.warn("Invalid preview token signature");
      return null;
    }

    // Decode payload
    const payload = JSON.parse(
      Buffer.from(
        payloadB64.replace(/-/g, "+").replace(/_/g, "/"),
        "base64"
      ).toString()
    ) as PreviewPayload;

    // Check expiration
    if (payload.exp < Math.floor(Date.now() / 1000)) {
      console.warn("Preview token expired");
      return null;
    }

    return payload;
  } catch (error) {
    console.error("Error verifying preview token:", error);
    return null;
  }
}
```

### 4. Extension du client WordPress

```typescript
// app/lib/wordpress.server.ts (ajout)

interface FetchOptions {
  bypassCache?: boolean;
}

export async function fetchWordPressPostById(
  id: string,
  options: FetchOptions = {}
): Promise<WordPressPost | null> {
  const { bypassCache = false } = options;

  // Si preview, on ne veut PAS le cache
  if (!bypassCache) {
    const cached = getCached<WordPressPost>(`wordpress:post:id:${id}`);
    if (cached) return cached;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    // Fetch avec statut "any" pour voir les brouillons/preview
    const response = await fetch(
      `${WORDPRESS_API_URL}/posts/${id}?_embed&status=any`,
      {
        signal: controller.signal,
        headers: {
          Accept: "application/json",
          // Auth si nécessaire pour les brouillons
          ...(process.env.WORDPRESS_PREVIEW_TOKEN && {
            Authorization: `Bearer ${process.env.WORDPRESS_PREVIEW_TOKEN}`,
          }),
        },
      }
    );

    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`WordPress API returned ${response.status}`);
    }

    const data = await response.json();
    const posts = transformWordPressData([data]);
    const post = posts[0];

    // Cache uniquement si pas en mode preview
    if (!bypassCache) {
      setCache(`wordpress:post:id:${id}`, post);
    }

    return post;
  } catch (error) {
    console.error(`WordPress fetch failed for post ${id}:`, error);
    return null;
  }
}

...
```

## Sécurité

### Token JWT

- **Signature HMAC-SHA256** : impossible de forger sans le secret partagé
- **Expiration 1h** : le lien de preview n'est valide que temporairement
- **Validation stricte** : on vérifie que `post_id` dans le token correspond au paramètre

### Variables d'environnement

```env
# .env (côté Remix)
PREVIEW_SECRET=un-secret-tres-long-et-aleatoire-partage-avec-wordpress
WORDPRESS_PREVIEW_TOKEN=token-wordpress-application-password
```

### Protection contre les abus

- Rate limiting sur `/preview` (ex: max 100 requêtes/min par IP)
- Logs des accès preview pour audit
- Token single-use (optionnel, avec Redis pour tracking)

## Expérience Utilisateur

### Côté Éditeur

1. Éditeur modifie un article dans WordPress
2. Clic sur "Aperçu" (bouton standard WordPress)
3. Nouvelle tab → `https://www.pretto.fr/preview?token=...&post_id=123`
4. **Affichage instantané** (0-2 secondes selon cache WordPress)
5. Banner orange "MODE APERÇU" pour rappeler que c'est non publié

### Avantages

- **Zéro délai** : pas de rebuild
- **Apparence fidèle** : même template que prod
- **Sécurisé** : token signé, non devinable
- **Expérience native** : depuis WordPress, workflow habituel

## Workflow de Publication

```
1. Éditeur écrit un brouillon
   ↓
2. Clic "Aperçu" → Remix /preview (bypass cache)
   ↓
3. Validation éditoriale
   ↓
4. Clic "Publier" dans WordPress
   ↓
5. Webhook WordPress → Purge cache Remix pour cet article
   ↓
6. Article accessible sur /actualites/:slug (avec cache)
```

## Performances

- **Preview** : ~500ms (fetch direct WordPress)
- **Production** : ~50ms (cache CDN)
- **Impact serveur** : minimal (preview limité aux éditeurs autorisés)

## Améliorations Possibles

1. **Preview de modifications non sauvegardées** :
   - POST depuis WordPress vers `/preview` avec le HTML brut
   - Stockage temporaire (Redis, TTL 5min)
2. **Preview multi-device** :
   - QR code dans WordPress → scan mobile
   - Même token fonctionne sur desktop/mobile
3. **Diff visuel** :

   - Afficher côte-à-côte l'ancienne et la nouvelle version
   - Highlight des changements

4. **Preview de catégories/taxonomies** :
   - Étendre le système aux pages de listing
   - Token avec `type=category&id=...`

## Tests

### Test de sécurité

```bash
# Token invalide → 403
curl https://www.pretto.fr/preview?token=invalid&post_id=123

# Token expiré → 403
curl https://www.pretto.fr/preview?token=<expired-token>&post_id=123

# Token valide → 200
curl https://www.pretto.fr/preview?token=<valid-token>&post_id=123
```

### Test de fraîcheur

1. Modifier un article dans WordPress (titre: "TEST PREVIEW")
2. Sans publier, cliquer sur "Aperçu"
3. Vérifier que le nouveau titre apparaît
4. Modifier à nouveau (titre: "TEST PREVIEW 2")
5. Rafraîchir le preview → nouveau titre visible

---

## Résumé

Cette solution offre un **preview instantané** sans compromis sur la sécurité ni les performances du site public. L'éditeur peut itérer rapidement sur son contenu (feedback loop de quelques secondes au lieu de 15 minutes), tout en conservant la robustesse du cache CDN pour les visiteurs.
