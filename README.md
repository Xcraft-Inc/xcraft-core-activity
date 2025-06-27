# 📘 xcraft-core-activity

## Aperçu

Le module `xcraft-core-activity` est un gestionnaire d'activités pour le framework Xcraft qui fonctionne comme un ordonnanceur intelligent. Il gère l'exécution des commandes en les plaçant dans des listes d'attente ou d'exécution selon des règles de concurrence spécifiques, permettant de contrôler finement l'ordre d'exécution et la parallélisation des activités dans l'écosystème Xcraft.

## Sommaire

- [Structure du module](#structure-du-module)
- [Fonctionnement global](#fonctionnement-global)
- [Exemples d'utilisation](#exemples-dutilisation)
- [Interactions avec d'autres modules](#interactions-avec-dautres-modules)
- [Détails des sources](#détails-des-sources)

## Structure du module

Le module est composé de trois fichiers principaux :

- **`lib/activity.js`** : Classe principale `Activities` qui implémente l'ordonnanceur
- **`lib/index.js`** : Point d'entrée qui exporte l'instance singleton
- **`activity.js`** : Commandes Xcraft exposées sur le bus de communication

Le module expose une instance singleton de la classe `Activities` qui hérite d'`EventEmitter` pour gérer les événements internes d'orchestration.

## Fonctionnement global

Le gestionnaire d'activités fonctionne selon un système d'ordonnancement événementiel basé sur des règles de concurrence strictes :

### Architecture événementielle

Le système utilise un modèle événementiel interne pour orchestrer le flux d'exécution :

- **`wait`** : Déclenché pour évaluer toutes les activités en attente
- **`run`** : Déclenché pour démarrer l'exécution d'une activité
- **Événements de fin** : `finished` ou `error` pour marquer la fin d'une activité

### Règles d'exécution

Une activité peut être exécutée uniquement si toutes ces conditions sont respectées :

1. **Unicité par ORC** : La même commande avec le même nom d'ORC n'est pas déjà en cours d'exécution
2. **Gestion de la parallélisation** :
   - L'activité est marquée comme parallèle (`parallel: true`), OU
   - Seules des activités parallèles sont actuellement en cours d'exécution

### Cycle de vie d'une activité

1. **Ajout** : L'activité est ajoutée à la liste d'attente via `execute()`
2. **Génération d'ID** : Un identifiant unique est généré avec FlakeId
3. **Évaluation** : Le système vérifie si l'activité peut être exécutée immédiatement
4. **Exécution** : Si les conditions sont remplies, l'activité passe en liste d'exécution
5. **Surveillance** : Le système s'abonne aux événements de fin d'activité
6. **Finalisation** : L'activité se termine et déclenche l'évaluation des activités en attente

### Gestion de la concurrence

Le système distingue deux types d'activités :

- **Activités exclusives** (`parallel: false`) : Une seule peut s'exécuter à la fois
- **Activités parallèles** (`parallel: true`) : Peuvent s'exécuter simultanément

## Exemples d'utilisation

### Exécution d'une activité exclusive

```javascript
const activity = require('xcraft-core-activity');

// Exécution d'une commande exclusive
activity.execute(
  'database.migrate',
  {id: 'msg-123', orcName: 'main-orc'},
  (cmd, msg) => {
    // Cette commande ne peut pas s'exécuter en parallèle
    console.log(`Executing exclusive ${cmd} for ${msg.orcName}`);
    // Logique de migration de base de données
  },
  false // Activité exclusive
);
```

### Exécution d'une activité parallèle

```javascript
// Exécution d'une commande parallèle (lecture de données)
activity.execute(
  'data.fetch',
  {id: 'msg-456', orcName: 'worker-orc'},
  (cmd, msg) => {
    // Cette commande peut s'exécuter en parallèle avec d'autres
    console.log(`Parallel execution of ${cmd}`);
    // Logique de récupération de données
  },
  true // Activité parallèle
);
```

### Consultation du statut via commande bus

```javascript
// Via le système de commandes Xcraft
const busClient = require('xcraft-core-busclient').getGlobal();

// Envoyer la commande de statut
busClient.command.send('activity.status', {});

// Écouter la réponse
busClient.events.subscribe('activity.status', (status) => {
  console.log('Activités en cours :', status.running);
  console.log('Activités en attente :', status.waiting);
});
```

### Utilisation directe de l'API

```javascript
// Accès direct à l'instance singleton
const activity = require('xcraft-core-activity');

// Obtenir le statut de toutes les activités
const status = activity.status();
console.log('État actuel :', status);
```

## Interactions avec d'autres modules

Le module interagit étroitement avec plusieurs composants de l'écosystème Xcraft :

- **[xcraft-core-busclient]** : Utilise le client bus global pour s'abonner aux événements de fin d'activité et gérer le cycle de vie
- **[xcraft-core-log]** : Système de logging intégré pour tracer l'exécution et le débogage des activités
- **[xcraft-core-server]** : Le serveur charge automatiquement les commandes exposées par ce module
- **flake-idgen** : Génération d'identifiants uniques distribués pour chaque activité
- **biguint-format** : Formatage des identifiants FlakeId en représentation hexadécimale

## Détails des sources

### `lib/activity.js`

Classe principale `Activities` qui implémente le gestionnaire d'activités. Elle maintient l'état complet du système via deux collections principales :

- **`_waiting`** : Map des activités en attente d'exécution avec leurs métadonnées
- **`_running`** : Map des activités en cours d'exécution
- **`_flakeIdGen`** : Générateur d'identifiants uniques pour les activités

#### Méthodes publiques

- **`execute(cmd, msg, action, parallel)`** — Ajoute une nouvelle activité à la liste d'attente. L'activité sera automatiquement exécutée dès que les conditions de concurrence le permettent.
- **`status()`** — Retourne un objet détaillé contenant l'état actuel de toutes les activités, organisé en sections `running` et `waiting`.
- **`pause(id)`** — Méthode réservée pour la mise en pause d'une activité (non implémentée).
- **`resume(id)`** — Méthode réservée pour la reprise d'une activité (non implémentée).
- **`kill(id)`** — Méthode réservée pour l'arrêt forcé d'une activité (non implémentée).

#### Méthodes privées

- **`_canExecute(activity)`** — Algorithme central qui détermine si une activité peut être exécutée selon les règles de concurrence établies.
- **`_run(activity)`** — Lance l'exécution effective d'une activité, gère l'abonnement aux événements de fin et maintient l'état du système.
- **`_isRunning(activity)`** — Vérifie si une activité identique (même commande et même ORC) est déjà en cours d'exécution.
- **`_isParallel(activity)`** — Détermine si une activité est marquée comme parallèle.
- **`_haveOnlyParallels()`** — Vérifie si toutes les activités en cours sont parallèles, permettant l'exécution d'activités exclusives.
- **`_getActivityName(activity)`** — Génère un nom unique pour l'activité au format `orcName::command`.

### `lib/index.js`

Point d'entrée minimaliste qui exporte l'instance singleton de la classe `Activities`, garantissant un état global cohérent dans toute l'application.

### `activity.js`

Module d'exposition des commandes Xcraft qui permet l'interaction avec le gestionnaire d'activités via le bus de communication.

#### Commandes disponibles

- **`status`** — Commande parallèle qui interroge le gestionnaire et publie le statut de toutes les activités via l'événement `activity.status`. Cette commande peut s'exécuter en parallèle car elle est en lecture seule.

---

_Document mis à jour_

[xcraft-core-busclient]: https://github.com/Xcraft-Inc/xcraft-core-busclient
[xcraft-core-log]: https://github.com/Xcraft-Inc/xcraft-core-log
[xcraft-core-server]: https://github.com/Xcraft-Inc/xcraft-core-server