export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const secretKey = process.env.SASPAY_SECRET_KEY;
  if (!secretKey) {
    return res.status(500).json({
      success: false,
      error: 'Configuration SASPAY_SECRET_KEY manquante sur le serveur Vercel'
    });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const response = await fetch('https://api.saspay.me/api/v1/checkout-sessions/', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${secretKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        amount: body.amount || 500,
        currency: 'XOF',
        customer_email: body.customer_email || 'contact@locatrust.ci',
        customer_name: body.customer_name || 'Bailleur LocaTrust',
        customer_phone: body.customer_phone || '+2250700000000',
        description: body.description || 'Abonnement SaaS LocaTrust',
        return_url: body.return_url || ''
      })
    });

    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (e: any) {
    return res.status(500).json({
      success: false,
      error: e.message || 'Erreur interne de communication SasPay'
    });
  }
}
