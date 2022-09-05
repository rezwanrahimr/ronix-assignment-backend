const express = require("express");
const app = express();
const MongoClient = require("mongodb").MongoClient;
const ObjectID = require("mongodb").ObjectID;
const cors = require("cors");
const Stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
require("dotenv").config();
const port = process.env.PORT || 8080;

app.use(
  cors({
    origin: "*",
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
    preflightContinue: false,
    optionsSuccessStatus: 204,
  })
);
app.use(express.json());

app.get("/", (req, res) => {
res.send("Hello World");
});

// MongoDB Connection
const uri = process.env.MONGODB_URL;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});
client.connect((err) => {
  console.log(
    `${!!err ? "Database Connection Failed" : "Database Connection Successful"}`
  );
  const productsCollection = client.db("Ronix").collection("products");
  const ordersCollection = client.db("Ronix").collection("orders");
  const toolsCollection = client.db("Ronix").collection("tools");
  const reviewsCollection = client.db("Ronix").collection("review");
  const profileCollection = client.db("Ronix").collection("profile");
  const usersCollection = client.db('Ronix').collection('users')
  
  // Store Profile Data.
  app.post("/api/update-profile", async (req, res) => {
    profileCollection.insertOne(req.body, (err, result) => {
      if (err) {
        res.status(500).send({
          status: 0,
          message: "Error Occured",
        });
      } else {
        res.status(201).send({
          status: 1,
          message: "Product Added Successfully",
        });
      }
    });
  });

  // Get Profile Data.
  app.get("/api/profile", async (req, res) => {
    const profile = await profileCollection.find().toArray();
    res.status(200).send({
      status: 1,
      message: "Profile Found",
      profile,
    });
  });

// Get all users.
app.get('/user',async(req,res) =>{
  const users = await usersCollection.find().toArray();
  res.send(users);
})

  // Create a new account
  app.post("/api/create-account", async (req, res) => {
    const { email, role, profile_picture } = req.body;
    const user = await usersCollection.findOne({ email });
    if (!user) {
      usersCollection.insertOne(
        {
          email: email,
          role: !role ? "user" : role,
          profile_picture,
        },
        (err, result) => {
          if (err) {
            res.status(500).send({
              status: 0,
              message: "Error Occured",
            });
          } else {
            res.status(201).send({
              status: 1,
              message: "Account Created Successfully",
            });
          }
        }
      );
    } else {
      res.status(400).send({
        status: 0,
        message: "Account Already Exists",
      });
    }
  });

  // Make Admin
 app.put('/user/:email',async(req,res) =>{
   const email = req.params.email;
   const filter = {email: email};
   const updateDoc = {
     $set: {role: 'admin'},
   };
   const result = await usersCollection.updateOne(filter,updateDoc);
   res.send(result);
 })

/*   app.post("/api/promote-user", (req, res) => {
    const { email, role } = req.body;
    usersCollection.updateOne(
      { email },
      { $set: { role: !role ? "admin" : role } },
      (err, result) => {
        if (err) {
          res.status(500).send({
            status: 0,
            message: "Error Occured",
          });
        } else {
          res.status(201).send({
            status: 1,
            message: "User Promoted Successfully",
          });
        }
      }
    );
  }); */


  //  Get Single Product
  app.get("/api/product/:id", async (req, res) => {
    const { id } = req.params;
    const product = await productsCollection.findOne({ _id: ObjectID(id) });
    if (product) {
      res.status(200).send({
        status: 1,
        message: "Product Found",
        product,
      });
    } else {
      res.status(404).send({
        status: 0,
        message: "Product Not Found",
      });
    }
  });


  // Get All Products
  app.get("/api/products", async (req, res) => {
    const products = await productsCollection.find().toArray();
    res.status(200).send({
      status: 1,
      message: "Products Found",
      products,
    });
  });


  // Store Product
  app.post("/api/add-product", async (req, res) => {
    productsCollection.insertOne(req.body, (err, result) => {
      if (err) {
        res.status(500).send({
          status: 0,
          message: "Error Occured",
        });
      } else {
        res.status(201).send({
          status: 1,
          message: "Product Added Successfully",
        });
      }
    });
  });


  // Update Product
  app.post("/api/update-product", async (req, res) => {
    const { id } = req.query;
    const product = await productsCollection.findOne({ _id: ObjectID(id) });
    if (product) {
      productsCollection.updateOne(
        { _id: ObjectID(id) },
        { $set: req.body },
        (err, result) => {
          if (err) {
            res.status(500).send({
              status: 0,
              message: "Error Occured",
            });
          } else {
            res.status(201).send({
              status: 1,
              message: "Product Updated Successfully",
            });
          }
        }
      );
    } else {
      res.status(404).send({
        status: 0,
        message: "Product Not Found",
      });
    }
  });


  // Delete Product
  app.post("/api/delete-product", async (req, res) => {
    const { id } = req.query;
    productsCollection.deleteOne({ _id: ObjectID(id) }, (err, result) => {
      if (err) {
        res.status(500).send({
          status: 0,
          message: "Error Occured",
        });
      } else {
        res.status(201).send({
          status: 1,
          message: "Product Deleted Successfully",
        });
      }
    });
  });



  // Process Order
  app.post("/api/process-order", async (req, res) => {

    try {

      const { total } = req.body;
      const storedOrders = await ordersCollection.insertOne({
        ...req.body,
        status: "pending",
      });
      if (storedOrders) {
        const payment = await Stripe.paymentIntents.create({
          amount: total * 100,
          currency: "usd",
          payment_method_types: ["card"],
        });
        if (payment.client_secret) {
          res.status(201).send({
            status: 1,
            message: "Order Placed Successfully",
            client_secret: payment.client_secret,
            created: payment.created,
            amount: payment.amount,
            currency: payment.currency,
            orderId: storedOrders.insertedId,
          });

        } else {
          res.status(500).send({
            status: 0,
            message: "Error Occured",
          });
        }
      } else {
        res.status(500).send({
          status: 0,
          message: "Error Occured",
        });
      }
    } catch (error) {

      res.status(500).send({
        status: 0,
        message: "Error Occured",
      });

    }

  });


  app.post("/api/re-payment", async (req, res) => {
    const { total, id } = req.body;

    try {
      const payment = await Stripe.paymentIntents.create({
        amount: total * 100,
        currency: "usd",
        payment_method_types: ["card"],
      });
      if (payment.client_secret) {

        res.status(201).send({
          status: 1,
          message: "Secret Generated Successfully",
          client_secret: payment.client_secret,
          created: payment.created,
          amount: payment.amount,
          currency: payment.currency,
          orderId: id,
        });
      } else {
        res.status(500).send({
          status: 0,
          message: "Error Occured",
        });
      }

    } catch (error) {
      res.status(500).send({
        status: 0,
        message: "Error Occured",
      });

    }
  });


  // Update Order Status
  app.post("/api/update-order-status", async (req, res) => {
    const { email, status, id } = req.query;
    const updatedOrder = await ordersCollection.updateOne(
      { email, _id: ObjectID(id) },
      { $set: { status } }
    );
    if (updatedOrder) {
      res.status(201).send({
        status: 1,
        message: "Order Status Updated Successfully",
      });
    } else {
      res.status(500).send({
        status: 0,
        message: "Error Occured",
      });
    }
  });


  // Get All Orders
  app.get("/api/orders", async (req, res) => {
    const orders = await ordersCollection.find().toArray();
    res.status(200).send({
      status: 1,
      message: "Orders Found",
      orders,
    });
  });


  // Get Single Order
  app.get("/api/get-order", async (req, res) => {
    const { email } = req.query;
    const order = await ordersCollection.find({ email }).toArray();
    if (order) {
      res.status(200).send({
        status: 1,
        message: "Order Found",
        order,
      });
    } else {
      res.status(404).send({
        status: 0,
        message: "Order Not Found",
      });
    }
  });


  // Delete Order
  app.post("/api/delete-order", async (req, res) => {
    const { id } = req.query;
    const order = await ordersCollection.findOne({ _id: ObjectID(id) });

    if (order.status === "paid") {
      res.status(400).send({
        status: 0,
        message: "Order Already Paid",
      });
    } else {
      const deletedOrder = await ordersCollection.deleteOne({
        _id: ObjectID(id),
      });
      if (deletedOrder) {
        res.status(201).send({
          status: 1,
          message: "Order Deleted Successfully",
        });
      } else {
        res.status(500).send({
          status: 0,
          message: "Error Occured",
        });
      }
    }
  });


  // get all tools items.
  app.get("/tools", async (req, res) => {
    const quarry = {};
    const cursor = toolsCollection.find(quarry);
    const tools = await cursor.toArray();
    res.send(tools);
  })


  // add a new tools
  app.post("/tools", async (req, res) => {
    const addNewItem = req.body;
    const result = await toolsCollection.insertOne(addNewItem);
    res.send(result);
  });


  // Avilabe Quantity decrease.
  app.post("/available/:id", async (req, res) => {
    if (Number(req.body.availableQuantity < 0)) {
      res.send({ status: 0, message: 'Oops! Stock out' });
      return;
    }
    const id = req.params.id;
    const quarry = { _id: ObjectId(id) };
    const result = await toolsCollection.updateOne(quarry, {
      $set: { availableQuantity: req.body.availableQuantity }
    });
    if (result.modifiedCount > 0) {
      res.send({ status: 1, message: "Order place successfully" });
    }
    else {
      res.send({ status: 0, message: "order place Faild" })
    }

  });


  // increase Quantity.
  app.post("/increase/:id", async (req, res) => {
    if (Number(req.body.availableQuantity < 0)) {
      res.send({ status: 0, message: "Oops! Restock Faild" });
      return;
    }
    const { availableQuantity, stock } = req.body;
    const id = req.params.id;
    const quarry = { _id: ObjectId(id) };
    const result = await toolsCollection.updateOne(quarry, {
      $set: { availableQuantity: Number(availableQuantity) + Number(stock) },
    });
    if (result.modifiedCount > 0) {
      res.send({ status: 1, message: "restock successfully" });
    }
    else {
      res.send({ status: 0, message: "restock faild" });
    }
  });


  // Insert Reviews.
  app.post("/review", (req, res) => {
    reviewsCollection.insertOne(req.body, (err) => {
      if (err) {
        res.send(err);
      }
      else {
        res.send({
          status: 1,
          message: "successfully insert one",
        })
      }
    })
  });


  // get all review
  app.get("/review", async (req, res) => {
    const quarry = {};
    const cursor = reviewsCollection.find(quarry);
    const review = await cursor.toArray();
    res.send(review);
  })


});
app.listen(port, () => {
  console.log(`App Listening at http://localhost:${port}`);
});
