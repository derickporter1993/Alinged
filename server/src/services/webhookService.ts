import db from '../db.js';

interface WebhookRow {
  id: number;
  name: string;
  url: string;
  events: string;
  secret: string | null;
  enabled: number;
}

export function fireWebhooks(event: string, payload: Record<string, unknown>): void {
  const webhooks = db.prepare(
    `SELECT * FROM webhooks WHERE enabled = 1`
  ).all() as WebhookRow[];

  // Filter to webhooks whose events list contains this event
  const matching = webhooks.filter((wh) => {
    const events = wh.events.split(',').map((e) => e.trim());
    return events.includes(event) || events.includes('*');
  });

  for (const wh of matching) {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (wh.secret) {
      headers['X-Webhook-Secret'] = wh.secret;
    }

    // Fire-and-forget
    fetch(wh.url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ event, payload, timestamp: new Date().toISOString() }),
    }).catch((err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[Webhook] Failed to fire webhook "${wh.name}" to ${wh.url}: ${message}`);
    });

    // Log activity
    db.prepare(`INSERT INTO activity (type, message, metadata) VALUES (?, ?, ?)`)
      .run(
        'webhook_fired',
        `Webhook "${wh.name}" fired for event "${event}"`,
        JSON.stringify({ webhook_id: wh.id, event, url: wh.url })
      );
  }
}
