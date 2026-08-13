// Service worker для web-push уведомлений задач.
self.addEventListener('push', (event) => {
    let data = {}
    try { data = event.data ? event.data.json() : {} } catch (e) { data = {} }
    const title = data.title || 'Travel System'
    const options = {
        body: data.body || '',
        tag: data.tag || undefined,
        data: { url: data.url || '/admin/tasks' },
    }
    event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
    event.notification.close()
    const url = (event.notification.data && event.notification.data.url) || '/admin/tasks'
    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
            for (const client of list) {
                if ('focus' in client) { client.navigate(url); return client.focus() }
            }
            if (self.clients.openWindow) return self.clients.openWindow(url)
        })
    )
})