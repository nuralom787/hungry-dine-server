const express = require('express');
const cors = require('cors');
require('dotenv').config()
const port = process.env.PORT || 5000;
const jwt = require('jsonwebtoken');
const app = express();
const formData = require('form-data');
const Mailgun = require('mailgun.js');
const mailgun = new Mailgun(formData);
const mg = mailgun.client({ username: 'api', key: process.env.MAIL_GUN_API_KEY });



const stripe_key = process.env.STRIPE_SECRET_KEY
const stripe = require("stripe")(`${stripe_key}`);
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

// MIddleware.
app.use(cors());
app.use(express.json());


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.kwi75.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;



// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});



async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        // await client.connect();

        // Database And Collection.
        const UsersCollection = client.db("Hungry_Dine").collection("Users");
        const MenuCollection = client.db("Hungry_Dine").collection("Menu");
        const ReviewCollection = client.db("Hungry_Dine").collection("Reviews");
        const CartCollection = client.db("Hungry_Dine").collection("Carts");
        const PaymentsCollection = client.db("Hungry_Dine").collection("Payments");





        // ----------------------------------------
        //            Token Related API
        // ----------------------------------------





        // Create JWT Token.
        app.post('/jwt', async (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' });
            res.send({ token });
        });


        // Check Token Middleware.
        const VerifyToken = (req, res, next) => {
            // console.log(req.headers.authorization);
            if (!req.headers.authorization) {
                return res.status(401).send({ message: 'unauthorize access' });
            }
            const token = req.headers.authorization.split(' ')[1];
            jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
                if (err) {
                    return res.status(401).send({ message: 'unauthorize access' });
                }
                req.decoded = decoded;
                next();
            })
        };


        // Check User Admin Middleware.
        const VerifyAdmin = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email: email };
            const user = await UsersCollection.findOne(query);
            const isAdmin = user?.role === 'admin';
            if (!isAdmin) {
                return res.status(403).send({ message: 'forbidden access' });
            }
            next();
        };





        // ----------------------------------------
        //            Users Related API
        // ----------------------------------------





        // Get All Users.
        app.get('/users', VerifyToken, VerifyAdmin, async (req, res) => {
            const result = await UsersCollection.find().toArray();
            res.send(result);
        });



        // Get User Role.
        app.get('/users/admin/:email', VerifyToken, async (req, res) => {
            const email = req.params.email;
            if (email !== req.decoded.email) {
                return res.status(403).send({ message: 'forbidden Access' });
            }
            const query = { email: email };
            const user = await UsersCollection.findOne(query);
            let admin = false;
            if (user) {
                admin = user?.role === 'admin';
            }
            res.send({ admin });
        });


        // Insert User Data.
        app.post('/users', async (req, res) => {
            const user = req.body;
            const query = { email: user.email };
            const existing = await UsersCollection.findOne(query);
            if (existing) {
                return res.send({ message: 'User Already Exists', insertedId: null });
            }
            const result = await UsersCollection.insertOne(user);
            res.send(result);
        });


        // Update User Role.
        app.patch('/users/admin/:id', VerifyToken, VerifyAdmin, async (req, res) => {
            const id = req.params.id;
            const newRole = req.body;
            const filter = { _id: new ObjectId(id) };
            const updatedDoc = {
                $set: {
                    role: newRole.role
                }
            };
            const result = await UsersCollection.updateOne(filter, updatedDoc);
            res.send(result);
        });


        // Delete A User.
        app.delete('/users/:id', VerifyToken, VerifyAdmin, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await UsersCollection.deleteOne(query);
            res.send(result);
        });






        // -----------------------------------------
        //         Menus Related API
        // -----------------------------------------





        // Get All Menus.
        app.get('/menus', async (req, res) => {
            const result = await MenuCollection.find().toArray();
            res.send(result);
        });


        // Get An Specific Item.
        app.get('/menus/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await MenuCollection.findOne(query).toArray();
            res.send(result);
        });


        // Get Cart Menus Items.
        app.get('/menus/cart/items/:id', VerifyToken, async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const paymentRes = await PaymentsCollection.findOne(filter)
            const query = {
                _id: {
                    $in: paymentRes.menuIds.map(id => new ObjectId(id))
                }
            };
            const result = await MenuCollection.find(query).toArray();
            res.send(result);
        });


        // Post New Item.
        app.post('/menus/addItem', VerifyToken, VerifyAdmin, async (req, res) => {
            const menuItem = req.body;
            const result = await MenuCollection.insertOne(menuItem);
            res.send(result);
        });


        // Update An Menu Details.
        app.patch('/menus/upItem/:id', async (req, res) => {
            const id = req.params.id;
            const menuItem = req.body;
            const filter = { _id: new ObjectId(id) };
            const updatedDoc = {
                $set: {
                    name: menuItem.name,
                    recipe: menuItem.recipe,
                    image: menuItem.image,
                    category: menuItem.category,
                    price: menuItem.price
                }
            };
            const result = await MenuCollection.updateOne(filter, updatedDoc);
            res.send(result);

        });


        // Delete An Menu.
        app.delete('/menus/deleteItem/:id', VerifyToken, VerifyAdmin, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await MenuCollection.deleteOne(query);
            res.send(result);
        });






        // --------------------------------------------
        //          Reviews Related APIS
        // --------------------------------------------






        // Get All Reviews.
        app.get('/reviews', async (req, res) => {
            const result = await ReviewCollection.find().toArray();
            res.send(result);
        });







        // ------------------------------------------
        //           Carts Related  API
        // ------------------------------------------





        // Get Cart Item
        app.get('/carts', async (req, res) => {
            const email = req.query.email;
            const query = { email: email };
            const result = await CartCollection.find(query).toArray();
            res.send(result);
        });


        // Post Item In Carts.
        app.post('/carts', async (req, res) => {
            const cartItem = req.body;
            const result = await CartCollection.insertOne(cartItem);
            res.send(result);
        });


        // Delete Cart Item.
        app.delete('/carts/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await CartCollection.deleteOne(query)
            res.send(result);
        });






        // ------------------------------------------
        //          Payment Related API
        // ------------------------------------------






        // Get Payment History.
        app.get("/user/payment-history", VerifyToken, async (req, res) => {
            const email = req.query.email;
            const filter = { email: email };
            if (req.query.email !== req.decoded.email) {
                return res.status(403).send({ message: "forbidden access" });
            }
            const result = await PaymentsCollection.find(filter).toArray();
            res.send(result);
        });



        // Payment Intent.
        app.post("/create-payment-intent", async (req, res) => {
            const { price } = req.body;
            const amount = parseInt(price * 100);
            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: 'usd',
                payment_method_types: ['card']
            });
            res.send({
                clientSecret: paymentIntent.client_secret
            });
        });



        // Store Payment Info In Database and Delete Cart Items.
        app.post('/user/payments', async (req, res) => {
            const payment = req.body;
            const paymentResult = await PaymentsCollection.insertOne(payment);
            const query = {
                _id: {
                    $in: payment.cartIds.map(id => new ObjectId(id))
                }
            };
            const deleteResult = await CartCollection.deleteMany(query);

            // Sent Confirmation Email to User.
            mg.messages.create(process.env.MAIL_GUN_SENDING_DOMAIN, {
                from: `Excited User <mailgun@${process.env.MAIL_GUN_SENDING_DOMAIN}>`,
                to: ["alamn7150@gmail.com"],
                subject: "Order Confirmation",
                text: "Your Order Was Confirmed!",
                html: "<h1>Your Order Was Confirmed! We Contact You soon...</h1>"
            })
                .then(msg => console.log(msg)) // logs response data
                .catch(err => console.error(err)); // logs any error

            // Sent Response.
            res.send({ paymentResult, deleteResult });
        });





        // ---------------------------------------------------------
        //                     Admin Statistic
        // ---------------------------------------------------------





        // Get Admin Statistic.
        app.get("/admin/statistic", VerifyToken, VerifyAdmin, async (req, res) => {
            const result = await PaymentsCollection.aggregate([
                {
                    $group: {
                        _id: null,
                        totalRevenue: {
                            $sum: "$price"
                        }
                    }
                }
            ]).toArray();
            const revenue = result.length > 0 ? result[0].totalRevenue : 0;
            const menus = await MenuCollection.estimatedDocumentCount();
            const orders = await PaymentsCollection.estimatedDocumentCount();
            const users = await UsersCollection.estimatedDocumentCount();


            res.send({
                revenue,
                menus,
                orders,
                users
            });
        });



        // Get Admin Graph Statistics.
        app.get("/admin/graph-statistics", async (req, res) => {
            const result = await PaymentsCollection.aggregate([
                {
                    $unwind: "$menuIds"
                },
                {
                    $set: {
                        menuIds: { $toObjectId: "$menuIds" }
                    }
                },
                {
                    $lookup: {
                        from: "Menu",
                        localField: "menuIds",
                        foreignField: "_id",
                        as: "menuItems"
                    }
                },
                {
                    $unwind: "$menuItems"
                },
                {
                    $group: {
                        _id: "$menuItems.category",
                        quantity: { $sum: 1 },
                        revenue: { $sum: "$menuItems.price" }
                    }
                },
                {
                    $project: {
                        _id: 0,
                        category: "$_id",
                        quantity: "$quantity",
                        totalRevenue: "$revenue"
                    }
                }
            ]).toArray();
            res.send(result);
        });



        // Send a ping to confirm a successful connection
        // await client.db("admin").command({ ping: 1 });
        // console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);


app.get('/', async (req, res) => {
    res.send("Hungry Dine Server Running")
});

app.listen(port, () => {
    console.log("Listening On Port: ", port);
});