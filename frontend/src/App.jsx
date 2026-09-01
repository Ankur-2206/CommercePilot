import { useState, useEffect } from "react";
import "./App.css";
import { API_BASE } from "./config";

const SESSION_STORAGE_KEY = "commercepilot-session-id";

function getSessionId() {
  let sessionId = localStorage.getItem(SESSION_STORAGE_KEY);

  if (!sessionId) {
    sessionId = crypto.randomUUID();
    localStorage.setItem(SESSION_STORAGE_KEY, sessionId);
  }

  return sessionId;
}

const SESSION_ID = getSessionId();

function App() {
  const [message, setMessage] = useState("");
  const [response, setResponse] = useState("");
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [loading, setLoading] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [order, setOrder] = useState(null);

  const BACKEND_URL = API_BASE;

  // ----------------------------------------
  // AI AGENT
  // ----------------------------------------

  const sendMessage = async () => {
    if (!message.trim()) return;

    setLoading(true);
    setResponse("");
    setProducts([]);

    try {
      const response = await fetch(
        `${BACKEND_URL}/api/agent/chat?message=${encodeURIComponent(
          message
        )}`,
        {
          method: "POST",
        }
      );

      if (!response.ok) {
        throw new Error("Failed to communicate with CommercePilot");
      }

      const data = await response.json();

      setResponse(data.message);
      setProducts(data.products || []);
    } catch (error) {
      console.error("AI agent error:", error);

      setResponse(
        "Sorry, something went wrong while communicating with CommercePilot."
      );
    } finally {
      setLoading(false);
    }
  };

  // ----------------------------------------
  // LOAD CART
  // ----------------------------------------

  const loadCart = async () => {
    try {
      const response = await fetch(
        `${BACKEND_URL}/api/cart?session_id=${SESSION_ID}`
      );

      if (!response.ok) {
        throw new Error("Failed to load cart");
      }

      const data = await response.json();

      setCart(data.items || []);
    } catch (error) {
      console.error("Load cart error:", error);
    }
  };

  // ----------------------------------------
  // LOAD CART WHEN APP STARTS
  // ----------------------------------------

  useEffect(() => {
    let isCurrent = true;

    async function loadInitialCart() {
      try {
        const initialResponse = await fetch(
          `${API_BASE}/api/cart?session_id=${SESSION_ID}`
        );

        if (!initialResponse.ok) {
          throw new Error("Failed to load cart");
        }

        const data = await initialResponse.json();
        if (isCurrent) {
          setCart(data.items || []);
        }
      } catch (error) {
        console.error("Initial cart load error:", error);
      }
    }

    loadInitialCart();

    return () => {
      isCurrent = false;
    };
  }, []);

  // ----------------------------------------
  // ADD TO CART
  // ----------------------------------------

  const addToCart = async (product) => {
    try {
      const response = await fetch(
        `${BACKEND_URL}/api/cart/add?session_id=${SESSION_ID}&product_id=${product.id}&quantity=1`,
        {
          method: "POST",
        }
      );

      if (!response.ok) {
        throw new Error("Failed to add product to cart");
      }

      await loadCart();
    } catch (error) {
      console.error("Add to cart error:", error);

      alert("Could not add product to cart");
    }
  };

  // ----------------------------------------
  // UPDATE CART QUANTITY
  // ----------------------------------------

  const updateQuantity = async (productId, quantity) => {
    if (quantity < 1) {
      return;
    }

    try {
      const response = await fetch(
        `${BACKEND_URL}/api/cart/update?session_id=${SESSION_ID}&product_id=${productId}&quantity=${quantity}`,
        {
          method: "PATCH",
        }
      );

      if (!response.ok) {
        throw new Error("Failed to update cart");
      }

      await loadCart();
    } catch (error) {
      console.error("Update cart error:", error);

      alert("Could not update cart");
    }
  };

  // ----------------------------------------
  // REMOVE FROM CART
  // ----------------------------------------

  const removeFromCart = async (productId) => {
    try {
      const response = await fetch(
        `${BACKEND_URL}/api/cart/remove?session_id=${SESSION_ID}&product_id=${productId}`,
        {
          method: "DELETE",
        }
      );

      if (!response.ok) {
        throw new Error("Failed to remove product from cart");
      }

      await loadCart();
    } catch (error) {
      console.error("Remove cart error:", error);

      alert("Could not remove product from cart");
    }
  };

  // ----------------------------------------
  // RAZORPAY PAYMENT
  // ----------------------------------------

  const checkout = async () => {
    if (cart.length === 0) {
      alert("Your cart is empty.");
      return;
    }

    setCheckoutLoading(true);
    setOrder(null);

    try {
      // ----------------------------------------
      // STEP 1
      // CREATE RAZORPAY ORDER
      // ----------------------------------------

      const response = await fetch(
        `${BACKEND_URL}/api/payment/create-order?session_id=${SESSION_ID}`,
        {
          method: "POST",
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);

        throw new Error(
          errorData?.detail || "Failed to create Razorpay order"
        );
      }

      const data = await response.json();

      console.log("Razorpay order created:", data);

      // ----------------------------------------
      // STEP 2
      // CHECK RAZORPAY SDK
      // ----------------------------------------

      if (!window.Razorpay) {
        throw new Error(
          "Razorpay Checkout SDK is not loaded. Check index.html."
        );
      }

      // ----------------------------------------
      // STEP 3
      // CREATE RAZORPAY CHECKOUT OPTIONS
      // ----------------------------------------

      const options = {
        key: data.key_id,

        amount: data.amount,

        currency: data.currency,

        name: "CommercePilot",

        description: "AI-powered commerce purchase",

        order_id: data.razorpay_order_id,

        // ----------------------------------------
        // PREFILL
        // ----------------------------------------

        prefill: {
          name: "CommercePilot User",
        },

        // ----------------------------------------
        // THEME
        // ----------------------------------------

        theme: {
          color: "#3399cc",
        },

        // ----------------------------------------
        // PAYMENT SUCCESS
        // ----------------------------------------

        handler: async function (paymentResponse) {
          console.log(
            "Razorpay payment successful:",
            paymentResponse
          );

          setCheckoutLoading(true);

          try {
            // ----------------------------------------
            // STEP 4
            // VERIFY PAYMENT
            // ----------------------------------------

            const verifyResponse = await fetch(
              `${BACKEND_URL}/api/payment/verify`,
              {
                method: "POST",

                headers: {
                  "Content-Type": "application/json",
                },

                body: JSON.stringify({
                  session_id: SESSION_ID,

                  razorpay_order_id:
                    paymentResponse.razorpay_order_id,

                  razorpay_payment_id:
                    paymentResponse.razorpay_payment_id,

                  razorpay_signature:
                    paymentResponse.razorpay_signature,
                }),
              }
            );

            if (!verifyResponse.ok) {
              const errorData = await verifyResponse
                .json()
                .catch(() => null);

              throw new Error(
                errorData?.detail ||
                  "Payment verification failed"
              );
            }

            const verifyData = await verifyResponse.json();

            console.log(
              "Payment verification successful:",
              verifyData
            );

            // ----------------------------------------
            // STEP 5
            // SHOW ORDER SUCCESS
            // ----------------------------------------

            setOrder({
              order_id: verifyData.order_id,
              total_amount: verifyData.total_amount,
              status: verifyData.status,
            });

            setResponse(
              "Payment successful! Your order has been confirmed."
            );

            // ----------------------------------------
            // STEP 6
            // REFRESH CART
            // ----------------------------------------

            await loadCart();

          } catch (error) {
            console.error(
              "Payment verification error:",
              error
            );

            alert(
              "Payment was completed, but verification failed. Please contact support."
            );
          } finally {
            setCheckoutLoading(false);
          }
        },

        // ----------------------------------------
        // PAYMENT WINDOW CLOSED
        // ----------------------------------------

        modal: {
          ondismiss: function () {
            console.log("Razorpay checkout closed");

            setCheckoutLoading(false);
          },
        },
      };

      // ----------------------------------------
      // STEP 7
      // CREATE RAZORPAY INSTANCE
      // ----------------------------------------

      const razorpay = new window.Razorpay(options);

      // ----------------------------------------
      // PAYMENT FAILED
      // ----------------------------------------

      razorpay.on(
        "payment.failed",
        function (paymentFailure) {
          console.error(
            "Razorpay payment failed:",
            paymentFailure.error
          );

          alert(
            `Payment failed: ${
              paymentFailure.error?.description ||
              "Unknown error"
            }`
          );

          setCheckoutLoading(false);
        }
      );

      // ----------------------------------------
      // STEP 8
      // OPEN RAZORPAY
      // ----------------------------------------

      razorpay.open();

    } catch (error) {
      console.error("Checkout error:", error);

      alert(
        error.message ||
          "Unable to start payment. Please check your backend and Razorpay configuration."
      );

      setCheckoutLoading(false);
    }
  };

  // ----------------------------------------
  // CART TOTAL
  // ----------------------------------------

  const cartTotal = cart.reduce(
    (total, product) =>
      total + Number(product.price) * product.quantity,
    0
  );

  // ----------------------------------------
  // UI
  // ----------------------------------------

  return (
    <div className="app">

      {/* HEADER */}

      <header className="header">

        <h1>
          CommercePilot
        </h1>

        <p>
          AI-Powered Agentic Commerce
        </p>

      </header>


      <main className="chat-container">

        {/* WELCOME */}

        <div className="welcome">

          <h2>
            What are you looking for?
          </h2>

          <p>
            Tell CommercePilot what you want, and our AI agent
            will find the best products for you.
          </p>

        </div>


        {/* AI RESPONSE */}

        {response && (

          <div className="response">

            <h3>
              CommercePilot
            </h3>

            <p>
              {response}
            </p>

          </div>

        )}


        {/* PRODUCTS */}

        {products.length > 0 && (

          <div className="products">

            {products.map((product) => (

              <div
                className="product-card"
                key={product.id}
              >

                <div className="product-image">
                  🎧
                </div>


                <h3>
                  {product.name}
                </h3>


                <p>
                  {product.description}
                </p>


                <div className="product-info">

                  <span>
                    ⭐ {product.rating}
                  </span>

                  <span>
                    🔋 {product.battery_hours} hrs
                  </span>

                </div>


                <div className="product-bottom">

                  <strong>
                    ₹{product.price}
                  </strong>


                  <button
                    onClick={() =>
                      addToCart(product)
                    }
                  >
                    Add to Cart
                  </button>

                </div>

              </div>

            ))}

          </div>

        )}


        {/* CART */}

        {cart.length > 0 && (

          <div className="cart">

            <h2>
              🛒 Your Cart
            </h2>


            {cart.map((product) => (

              <div
                className="cart-item"
                key={product.id}
              >

                <div>

                  <strong>
                    {product.name}
                  </strong>


                  <p>
                    ₹{product.price} ×{" "}
                    {product.quantity}
                    {" = "}
                    ₹
                    {Number(product.price) *
                      product.quantity}
                  </p>


                  {/* QUANTITY CONTROLS */}

                  <div className="quantity-controls">

                    <button
                      onClick={() =>
                        updateQuantity(
                          product.id,
                          product.quantity - 1
                        )
                      }
                      disabled={
                        product.quantity <= 1
                      }
                    >
                      −
                    </button>


                    <span>
                      {product.quantity}
                    </span>


                    <button
                      onClick={() =>
                        updateQuantity(
                          product.id,
                          product.quantity + 1
                        )
                      }
                    >
                      +
                    </button>


                    <button
                      onClick={() =>
                        removeFromCart(
                          product.id
                        )
                      }
                    >
                      Remove
                    </button>

                  </div>

                </div>


                <strong>
                  ₹
                  {Number(product.price) *
                    product.quantity}
                </strong>

              </div>

            ))}


            {/* CART TOTAL */}

            <div className="cart-total">

              <strong>
                Total: ₹{cartTotal}
              </strong>


              <button
                onClick={checkout}
                disabled={checkoutLoading}
              >
                {checkoutLoading
                  ? "Processing Payment..."
                  : "Proceed to Checkout"}
              </button>

            </div>

          </div>

        )}


        {/* ORDER SUCCESS */}

        {order && (

          <div className="response">

            <h3>
              ✅ Payment Successful
            </h3>


            <p>
              Order ID: {order.order_id}
            </p>


            <p>
              Total: ₹{order.total_amount}
            </p>


            <p>
              Status: {order.status}
            </p>

          </div>

        )}


        {/* INPUT */}

        <div className="input-area">

          <input
            type="text"
            placeholder="Find wireless headphones under ₹3000..."
            value={message}
            onChange={(event) =>
              setMessage(event.target.value)
            }
            onKeyDown={(event) => {

              if (event.key === "Enter") {
                sendMessage();
              }

            }}
          />


          <button
            onClick={sendMessage}
            disabled={loading}
          >
            {loading
              ? "Thinking..."
              : "Send"}
          </button>

        </div>

      </main>

    </div>
  );
}

export default App;
