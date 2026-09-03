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
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [orderHistory, setOrderHistory] = useState([]);
  const [showOrderHistory, setShowOrderHistory] = useState(false);
  const [paymentError, setPaymentError] = useState(null);
  const [failedPaymentData, setFailedPaymentData] = useState(null);

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
      setError(null);
    } catch (error) {
      console.error("AI agent error:", error);
      setError("Sorry, something went wrong while communicating with CommercePilot.");
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
  // LOAD ORDER HISTORY
  // ----------------------------------------

  const loadOrderHistory = async () => {
    try {
      const response = await fetch(
        `${BACKEND_URL}/api/payment/orders?session_id=${SESSION_ID}`
      );

      if (!response.ok) {
        throw new Error("Failed to load order history");
      }

      const data = await response.json();
      setOrderHistory(data.orders || []);
    } catch (error) {
      console.error("Load order history error:", error);
      setError("Could not load order history");
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
              items: verifyData.items,
              created_at: verifyData.created_at,
            });

            setResponse(
              "Payment successful! Your order has been confirmed."
            );
            setSuccess("Thank you for your purchase! Order details are shown above.");
            setPaymentError(null);

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

            setPaymentError(
              `Payment verification failed: ${error.message}. Please contact support or try again.`
            );
            setFailedPaymentData({
              razorpay_payment_id: paymentResponse.razorpay_payment_id,
              razorpay_order_id: paymentResponse.razorpay_order_id,
              razorpay_signature: paymentResponse.razorpay_signature,
            });
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

          setPaymentError(
            `Payment failed: ${
              paymentFailure.error?.description ||
              "Unknown error"
            }. You can try again.`
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

      setError(
        error.message ||
          "Unable to start payment. Please check your backend and Razorpay configuration."
      );

      setCheckoutLoading(false);
    }
  };

  // ----------------------------------------
  // RETRY PAYMENT
  // ----------------------------------------

  const retryPayment = async () => {
    if (!failedPaymentData) return;

    setCheckoutLoading(true);
    setPaymentError(null);

    try {
      const verifyResponse = await fetch(
        `${BACKEND_URL}/api/payment/verify`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            session_id: SESSION_ID,
            razorpay_order_id: failedPaymentData.razorpay_order_id,
            razorpay_payment_id: failedPaymentData.razorpay_payment_id,
            razorpay_signature: failedPaymentData.razorpay_signature,
          }),
        }
      );

      if (!verifyResponse.ok) {
        const errorData = await verifyResponse.json().catch(() => null);
        throw new Error(errorData?.detail || "Payment verification failed");
      }

      const verifyData = await verifyResponse.json();

      setOrder({
        order_id: verifyData.order_id,
        total_amount: verifyData.total_amount,
        status: verifyData.status,
      });

      setSuccess("Payment verified successfully! Order confirmed.");
      setPaymentError(null);
      setFailedPaymentData(null);
      setResponse("Payment successful! Your order has been confirmed.");

      await loadCart();
    } catch (error) {
      console.error("Retry payment error:", error);
      setPaymentError(`Retry failed: ${error.message}`);
    } finally {
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


      <main className="chat-container">

        {/* ERROR ALERT */}

        {error && (
          <div className="alert alert-error">
            <span>❌ {error}</span>
            <button
              onClick={() => setError(null)}
              className="close-btn"
            >
              ✕
            </button>
          </div>
        )}

        {/* SUCCESS ALERT */}

        {success && (
          <div className="alert alert-success">
            <span>✅ {success}</span>
            <button
              onClick={() => setSuccess(null)}
              className="close-btn"
            >
              ✕
            </button>
          </div>
        )}

        {/* PAYMENT ERROR ALERT */}

        {paymentError && (
          <div className="alert alert-error">
            <div>
              <p>⚠️ {paymentError}</p>
              {failedPaymentData && (
                <button
                  onClick={retryPayment}
                  disabled={checkoutLoading}
                  className="retry-btn"
                >
                  {checkoutLoading ? "Retrying..." : "Retry Payment"}
                </button>
              )}
            </div>
            <button
              onClick={() => {
                setPaymentError(null);
                setFailedPaymentData(null);
              }}
              className="close-btn"
            >
              ✕
            </button>
          </div>
        )}

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

          <div className="order-success">

            <div className="order-header">
              <h3>✅ Order Confirmed</h3>
              <p className="order-id">Order #{order.order_id}</p>
            </div>

            <div className="order-details">
              <div className="detail-row">
                <span>Status:</span>
                <strong>{order.status.toUpperCase()}</strong>
              </div>
              
              <div className="detail-row">
                <span>Total Amount:</span>
                <strong>₹{order.total_amount.toFixed(2)}</strong>
              </div>

              {order.created_at && (
                <div className="detail-row">
                  <span>Order Date:</span>
                  <span>{new Date(order.created_at).toLocaleString()}</span>
                </div>
              )}
            </div>

            <div className="order-actions">
              <button
                onClick={() => {
                  setOrder(null);
                  setMessage("");
                  setResponse("");
                }}
              >
                Continue Shopping
              </button>
              
              <button
                onClick={() => {
                  loadOrderHistory();
                  setShowOrderHistory(true);
                }}
              >
                View Order History
              </button>
            </div>

          </div>


        )}


        {/* ORDER HISTORY */}

        {showOrderHistory && orderHistory.length > 0 && (
          <div className="order-history">
            <div className="order-history-header">
              <h3>📜 Order History</h3>
              <button
                onClick={() => setShowOrderHistory(false)}
                className="close-btn"
              >
                ✕
              </button>
            </div>

            {orderHistory.map((historyOrder) => (
              <div key={historyOrder.order_id} className="history-item">
                <div className="history-header">
                  <strong>Order #{historyOrder.order_id}</strong>
                  <span className="status-badge">{historyOrder.status}</span>
                </div>

                <div className="history-details">
                  <span>₹{historyOrder.total_amount.toFixed(2)}</span>
                  <span className="date">
                    {new Date(historyOrder.created_at).toLocaleDateString()}
                  </span>
                </div>

                {historyOrder.items.length > 0 && (
                  <div className="history-items">
                    {historyOrder.items.map((item, idx) => (
                      <div key={idx} className="history-item-detail">
                        <span>{item.product_name}</span>
                        <span>×{item.quantity}</span>
                        <span>₹{(item.price * item.quantity).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

      </main>

    </div>
  );
}

export default App;
