// ═══════════════════════════════════════════════════════════════════════
//  sw.js — Service Worker mínimo do ÓticaMegaVision Pro
//  Objetivo ÚNICO: habilitar o Background Sync (sincronizar sozinho quando
//  a internet voltar, mesmo com a aba fechada).
//
//  ⚠️ DE PROPÓSITO este arquivo NÃO faz cache de nenhum arquivo do sistema
//  (nem index.html, nem imagens, nem nada). Um Service Worker "completo"
//  poderia acelerar o carregamento offline, mas também traz o risco de
//  ficar servindo uma versão ANTIGA do sistema pro usuário, mesmo depois
//  de você publicar atualizações — exatamente o tipo de problema que você
//  pediu pra evitar. Por isso, aqui ele fica só de olho no evento de
//  sincronização e não interfere em mais nada.
// ═══════════════════════════════════════════════════════════════════════

self.addEventListener('install', (event) => {
    // Ativa este SW imediatamente, sem esperar todas as abas fecharem.
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    // Assume o controle das abas já abertas imediatamente.
    event.waitUntil(self.clients.claim());
});

// Não interceptamos 'fetch' — ou seja, toda requisição (HTML, JS, imagens,
// chamadas de API) continua indo direto pra rede/cache normal do navegador,
// exatamente como se não houvesse Service Worker nenhum. Isso é proposital.

// ── Background Sync ───────────────────────────────────────────────────
// Disparado pelo navegador quando a conexão volta, mesmo com a aba fechada
// (a página já chama reg.sync.register('sync-data') quando está offline,
// dentro de LocalFirst._scheduleCloudSync() no index.html).
self.addEventListener('sync', (event) => {
    if (event.tag === 'sync-data') {
        event.waitUntil(
            // Avisa todas as abas abertas (se houver) para rodarem o
            // LocalFirst.sync(). Se não houver nenhuma aba aberta no momento,
            // a sincronização normal acontece assim que o usuário abrir o
            // sistema de novo (comportamento que já existia antes).
            self.clients.matchAll({ includeUncontrolled: true }).then((clientList) => {
                clientList.forEach((client) => {
                    client.postMessage({ type: 'BACKGROUND_SYNC' });
                });
            })
        );
    }
});
