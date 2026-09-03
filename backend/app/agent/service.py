import json
import os

from dotenv import load_dotenv
from groq import Groq
from sqlalchemy.orm import Session

from app.agent.tools import search_products, get_related_products


load_dotenv()

client = Groq(
    api_key=os.getenv("GROQ_API_KEY")
)


SYSTEM_PROMPT = """
You are CommercePilot, an AI commerce assistant.

Your job is to help users discover products from the merchant's catalog.

Rules:

1. Understand the user's natural-language shopping requirements.
2. Use the search_products tool whenever the user is asking about products.
3. Never invent products, prices, ratings, stock, or specifications.
4. Only recommend products returned by the available tools.
5. Explain why the recommended products match the user's requirements.
6. For broad shopping intents or use cases such as gaming setup, work from home,
   travel, fitness, or audio, do not ask a clarification question. Search the
   catalog with the search_products tool using broad filters or no filters,
   then recommend the most relevant products returned by the tool. Mention
   when a requested item is not available in the catalog.
7. You can search products and find complementary products using the available tools.
8. When recommending a complementary product, only recommend products returned by get_related_products.
9. Never purchase anything or initiate a payment without explicit user confirmation.
"""


TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "search_products",
            "description": (
                "Search the merchant product catalog using shopping "
                "requirements such as category, maximum price, minimum "
                "rating, wireless requirement, and minimum battery life. "
                "For broad shopping use cases, leave filters null to inspect "
                "the full catalog and select the most relevant matches."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "category": {
                        "type": ["string", "null"],
                        "description": "Product category, such as headphones."
                    },
                    "max_price": {
                        "type": ["number", "null"],
                        "description": "Maximum acceptable price in INR."
                    },
                    "min_rating": {
                        "type": ["number", "null"],
                        "description": "Minimum product rating."
                    },
                    "wireless": {
                        "type": ["boolean", "null"],
                        "description": "Whether the product must be wireless."
                    },
                    "min_battery": {
                        "type": ["integer", "null"],
                        "description": "Minimum battery life in hours."
                    }
                },
                "required": [
                    "category",
                    "max_price",
                    "min_rating",
                    "wireless",
                    "min_battery"
                ],
                "additionalProperties": False
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_related_products",
            "description": (
                "Find complementary products that can be recommended "
                "alongside a specific product. Use this when a product "
                "has been selected or recommended and a cross-sell "
                "opportunity may increase customer value."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "product_id": {
                        "type": "integer",
                        "description": "The ID of the product."
                    }
                },
                "required": ["product_id"],
                "additionalProperties": False
            }
        }
    }
]


def serialize_products(products):
    return [
        {
            "id": product.id,
            "name": product.name,
            "description": product.description,
            "category": product.category,
            "price": float(product.price),
            "rating": float(product.rating),
            "stock": product.stock,
            "wireless": product.wireless,
            "battery_hours": product.battery_hours,
            "brand": product.brand,
            "color": product.color,
            "image_url": product.image_url,
        }
        for product in products
    ]


def run_agent(user_message: str, db: Session):

    found_products = []

    messages = [
        {
            "role": "system",
            "content": SYSTEM_PROMPT
        },
        {
            "role": "user",
            "content": user_message
        }
    ]

    max_iterations = 5

    for _ in range(max_iterations):

        response = client.chat.completions.create(
            model="openai/gpt-oss-120b",
            messages=messages,
            tools=TOOLS,
            tool_choice="auto"
        )

        assistant_message = response.choices[0].message

        # No more tools needed → final answer
        if not assistant_message.tool_calls:

            return {
                "message": assistant_message.content,
                "products": found_products
            }

        # Add assistant's tool request to conversation
        messages.append(assistant_message)

        # Execute every requested tool
        for tool_call in assistant_message.tool_calls:

            function_name = tool_call.function.name

            arguments = json.loads(
                tool_call.function.arguments
            )

            # -----------------------------
            # SEARCH PRODUCTS
            # -----------------------------

            if function_name == "search_products":

                products = search_products(
                    db=db,
                    category=arguments.get("category"),
                    max_price=arguments.get("max_price"),
                    min_rating=arguments.get("min_rating"),
                    wireless=arguments.get("wireless"),
                    min_battery=arguments.get("min_battery")
                )

                serialized = serialize_products(products)

                found_products.extend(serialized)

                tool_result = json.dumps(serialized)

            # -----------------------------
            # RELATED PRODUCTS
            # -----------------------------

            elif function_name == "get_related_products":

                related_products = get_related_products(
                    db=db,
                    product_id=arguments["product_id"]
                )

                serialized = serialize_products(related_products)

                # Add complementary products to response
                found_products.extend(serialized)

                tool_result = json.dumps(serialized)

            # -----------------------------
            # UNKNOWN TOOL
            # -----------------------------

            else:

                tool_result = json.dumps({
                    "error": f"Unknown tool: {function_name}"
                })

            # Send tool result back to LLM
            messages.append(
                {
                    "role": "tool",
                    "tool_call_id": tool_call.id,
                    "name": function_name,
                    "content": tool_result
                }
            )

    # Safety stop if agent loops too many times
    return {
        "message": (
            "I couldn't complete the request within the allowed "
            "number of agent steps."
        ),
        "products": found_products
    }