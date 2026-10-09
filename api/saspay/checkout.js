// api/saspay/checkout.js
// Vercel Edge Function pour l'initiation sécurisée de sessions SasPay

export const config = {
  runtime: 'edge',
};

export default async function handler(request) {
  // 1. Autoriser uniquement les requêtes POST
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // 2. Récupération sécurisée de la clé secrète SasPay
  const secretKey =
    process.env.SASPAY_SECRET_KEY ||
    process.env.VITE_SASPAY_SECRET_KEY ||
    process.env.SASPAY_API_KEY ||
    '';

  if (!secretKey) {
    return new Response(
      JSON.stringify({
        success: false,
        error:
          'Clé SASPAY_SECRET_KEY introuvable sur Vercel. Veuillez vérifier dans Vercel > Settings > Environment Variables que la clé est bien ajoutée pour Production et Preview.',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  try {
    const body = await request.json().catch(() => ({}));
    const amount = Number(body.amount);

    // Validation stricte des montants des forfaits LocaTrust (500, 2 000, 5 000, 10 000 FCFA)
    const validTiers = [500, 2000, 5000, 10000];
    if (!validTiers.includes(amount)) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Montant d’abonnement non autorisé. Paliers valides : 500, 2 000, 5 000 ou 10 000 FCFA.',
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const customerEmail = (body.customer_email || 'contact@locatrust.ci').toString().trim();
    const customerName = (body.customer_name || 'Bailleur LocaTrust').toString().trim();
    const customerPhone = (body.customer_phone || '+2250700000000').toString().trim();
    const description = (body.description || 'Abonnement SaaS LocaTrust').toString().trim();
    const returnUrl = (body.return_url || '').toString().trim();

    // 3. Appel de l'API officielle SasPay
    const saspayResponse = await fetch('https://api.saspay.me/api/v1/checkout-sessions/', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secretKey.trim()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: amount,
        currency: 'XOF',
        customer_email: customerEmail,
        customer_name: customerName,
        customer_phone: customerPhone,
        description: description,
        return_url: returnUrl,
      }),
    });

    const responseText = await saspayResponse.text();
    let data;
    try {
      data = JSON.parse(responseText);
    } catch {
      data = { raw: responseText };
    }

    if (!saspayResponse.ok) {
      return new Response(
        JSON.stringify({
          success: false,
          error:
            data.message ||
            data.error ||
            data.detail ||
            `Erreur API SasPay (${saspayResponse.status}): ${responseText.substring(0, 150)}`,
        }),
        {
          status: saspayResponse.status,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({
        success: false,
        error: `Erreur interne lors de l'appel SasPay : ${err.message}`,
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
