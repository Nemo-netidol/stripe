const express = require("express");
const app = express();
const mysql = require("mysql2/promise");
const stripe = require("stripe")("sk_test_0QcpU1z0LTkqnbM2xwSgkV9500o3nNRTSO");
const { v4: uuidv4 } = require("uuid");
require('dotenv').config();

const port = 8000;

const endpointSecret = process.env.endpointSecret;

const initMySQL = async () => {
  conn = await mysql.createPool({
    host: "db",
    user: "root",
    password: "root",
    database: "tutorial",
  });
};

app.get("/test", (req, res) => {
  res.json({
    message: "test",
  });
});

app.post("/api/checkout", express.json(), async (req, res) => {
  try {
    const { user, product } = req.body;
    const orderId = uuidv4();

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "thb",
            product_data: {
              name: product.name,
            },
            unit_amount: product.price * 100,
          },
          quantity: product.quantity,
        },
      ],
      mode: "payment",
      success_url: `http://localhost:8888/success.html?id=${orderId}`,
      cancel_url: `http://localhost:8888/cancel.html`,
    });

    const orderData = {
      name: user.name,
      address: user.address,
      order_id: orderId,
      session_id: session.id,
      status: session.status,
    };

    console.log(session);

    const [result] = await conn.query("INSERT INTO orders SET ?", orderData);

    res.json({
      user,
      product,
      order: result,
    });
  } catch (error) {
    console.log(error);
    res.status(400).json({
      message: "something wrong",
      error,
    });
  }
});

app.get("/api/order/:id", async (req, res) => {
  const orderId = req.params.id;
  try {
    const [result] = await conn.query(
      "SELECT * FROM orders where order_id = ?",
      orderId
    );
    const orderResult = result[0];
    res.json({
      order: orderResult,
    });
  } catch (error) {
    console.log(error);
    res.json({
      message: "something wrong",
      error,
    });
  }
});

app.post('/webhook', express.raw({type: 'application/json'}), async (request, response) => {
    const sig = request.headers['stripe-signature'];
  
    let event;
  
    try {
      event = stripe.webhooks.constructEvent(request.body, sig, endpointSecret);
    }
    catch (err) {
      response.status(400).send(`Webhook Error: ${err.message}`);
    }
  
    // Handle the event
    switch (event.type) {
      case 'checkout.session.completed':
        const paymentData = event.data.object;
        console.log('paymentData', paymentData);
        const sessionId = paymentData.id

        const data = {
            status: paymentData.status
        }
        // หา order จาก session id

        // update status กลับเข้าไปใน Database
        const [result] = await conn.query('UPDATE orders SET ? WHERE session_id = ?',
            [data, sessionId]
        )

        console.log('== update result', result);

        break;
      case 'payment_method.attached':
        const paymentMethod = event.data.object;
        console.log('PaymentMethod was attached to a Customer!');
        break;
      // ... handle other event types
      default:
        console.log(`Unhandled event type ${event.type}`);
    }
  
    // Return a response to acknowledge receipt of the event
    response.json({received: true});
  });

app.listen(port, async () => {
  await initMySQL();
  console.log(`Server running at http://localhost:${port}/`);
});
